import { authenticateRequest, requireTenant } from '../../_lib/auth.js';
import { badRequest, json, options, readJson } from '../../_lib/http.js';
import { canSync, validateTenantPayload } from '../../_lib/syncPolicy.js';
import { canAccessBranch } from '../../../src/services/branchAccess.js';
import { conflictKeysForEvent } from '../../../src/services/syncConflictPolicy.js';
import { attachConflictPreconditions } from '../../../src/services/syncConflictPolicy.js';
import { readReviewEvidence, resolutionStatements } from '../../_lib/reviewResolution.js';
import { readAuditedReview } from '../../_lib/reviewCheckpoint.js';
import { replayReviewedLedger, reviewedLedgerState } from '../../../src/services/reviewLedgerReplay.js';
import { onRequestPost as pushEvents } from './push.js';
export const onRequestOptions = options;
// This inbox is evidence, not a posting endpoint. No outbox acknowledgement.
export async function onRequestPost({request,env}) {
  const auth=await authenticateRequest(request,env);
  if(auth.error)return auth.error;
  try {
    const {tenantId,events}=await readJson(request,256*1024);
    const denied=requireTenant(auth,tenantId);if(denied)return denied;
    if(!Array.isArray(events)||!events.length||events.length>100)return badRequest('Invalid review batch');
    const ids=new Set(),keys=new Set();
    for(const event of events){
      if(!event||typeof event.id!=='string'||!event.id||event.id.length>128||ids.has(event.id)||
        typeof event.entityId!=='string'||!event.entityId||event.entityId.length>128||
        !['create','update','delete','void','reverse'].includes(event.action)||
        !event.payload||typeof event.payload!=='object'||Array.isArray(event.payload))return badRequest('Invalid review event');
      ids.add(event.id);
      if(event.tenantId!==tenantId||!canSync(auth.principal,event.entityType,event.action)||
        !canAccessBranch(auth.principal,event.branchId)||event.branchId==='all')return json({success:false,error:'Review access denied'},403);
      validateTenantPayload(event,tenantId);
      const required=conflictKeysForEvent(event).sort();
      if(!required.length||event.conflictPolicyVersion!==1||!event.preconditions||
        JSON.stringify(Object.keys(event.preconditions).sort())!==JSON.stringify(required)||
        Object.values(event.preconditions).some(value=>value!==null&&(typeof value!=='string'||!value||value.length>128)))return badRequest('Invalid review preconditions');
      required.forEach(key=>keys.add(key));
    }
    const proposed=JSON.stringify(events),submissionKey=JSON.stringify([...ids]);
    const existing=await env.DB.prepare('SELECT id,proposed_json FROM sync_conflict_reviews WHERE tenant_id=? AND submitted_by=? AND submission_key=?')
      .bind(tenantId,auth.principal.id,submissionKey).first();
    if(existing)return existing.proposed_json===proposed?json({success:true,reviewId:existing.id,posted:false}):json({success:false,error:'Review identity conflict'},409);
    const heads={},serverEvents=[],seen=new Set();let stale=false;
    for(const key of keys){
      heads[key]=(await env.DB.prepare('SELECT last_event_id FROM sync_conflict_heads WHERE tenant_id=? AND conflict_key=?').bind(tenantId,key).first())?.last_event_id??null;
      const firstForKey=events.find(event=>Object.hasOwn(event.preconditions,key));
      if(firstForKey.preconditions[key]!==heads[key])stale=true;
      if(heads[key]&&!seen.has(heads[key])){
        const row=await env.DB.prepare('SELECT id,branch_id,entity_type,entity_id,action,payload_json FROM sync_events_v2 WHERE tenant_id=? AND id=?').bind(tenantId,heads[key]).first();
        if(row){seen.add(row.id);serverEvents.push({id:row.id,branchId:row.branch_id,entityType:row.entity_type,entityId:row.entity_id,action:row.action,payload:JSON.parse(row.payload_json)});}
      }
    }
    if(!stale)return json({success:false,error:'No stale mutation to review'},409);
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO sync_conflict_reviews(id,tenant_id,submitted_by,submission_key,proposed_json,server_json,heads_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id,submitted_by,submission_key) DO NOTHING')
      .bind(id,tenantId,auth.principal.id,submissionKey,proposed,JSON.stringify(serverEvents),JSON.stringify(heads)).run();
    const saved=await env.DB.prepare('SELECT id,proposed_json FROM sync_conflict_reviews WHERE tenant_id=? AND submitted_by=? AND submission_key=?').bind(tenantId,auth.principal.id,submissionKey).first();
    if(saved?.proposed_json!==proposed)return json({success:false,error:'Review identity conflict'},409);
    return json({success:true,reviewId:saved.id,posted:false});
  }catch{return badRequest('Unable to retain conflict review');}
}
export async function onRequestGet({request,env}) {
  const auth=await authenticateRequest(request,env);if(auth.error)return auth.error;
  const tenantId=new URL(request.url).searchParams.get('tenantId');
  const denied=requireTenant(auth,tenantId);if(denied)return denied;
  if(auth.principal.type!=='tenant'||!['company_owner','super_admin'].includes(auth.principal.role))return json({success:false,error:'Company owner review required'},403);
  const {results}=await env.DB.prepare("SELECT r.id,r.submitted_by,r.proposed_json,r.server_json,r.heads_json,r.status,r.created_at,d.choice FROM sync_conflict_reviews r LEFT JOIN sync_review_decisions d ON d.review_id=r.id WHERE r.tenant_id=? AND r.status='pending' ORDER BY r.created_at,r.id LIMIT 50").bind(tenantId).all();
  if(!results.length)return json({success:true,reviews:[]});
  const keys=results.flatMap(row=>JSON.parse(row.proposed_json).flatMap(conflictKeysForEvent));
  const snapshot=await readReviewEvidence(env,tenantId,keys);
  return json({success:true,reviews:results.map(row=>{
    const proposedEvents=JSON.parse(row.proposed_json),keys=new Set(proposedEvents.flatMap(conflictKeysForEvent));
    const ids=new Set([...keys].map(key=>snapshot.heads[key]).filter(Boolean));
    return {id:row.id,submittedBy:row.submitted_by,proposedEvents,serverEvents:snapshot.history.filter(event=>ids.has(event.id)),
      originalServerEvents:JSON.parse(row.server_json),heads:snapshot.heads,status:row.status,createdAt:row.created_at,decision:row.choice||null};
  })});
}

export async function onRequestPatch({request,env}) {
  const auth=await authenticateRequest(request,env);if(auth.error)return auth.error;
  try {
    const {tenantId,reviewId,choice,execute=false,expectedHeads,checkpointProtocol}=await readJson(request,256*1024);
    const denied=requireTenant(auth,tenantId);if(denied)return denied;
    if(auth.principal.type!=='tenant'||!['company_owner','super_admin'].includes(auth.principal.role))return json({success:false,error:'Company owner review required'},403);
    if(typeof reviewId!=='string'||reviewId.length>128||!['local','server'].includes(choice))return badRequest('Invalid review decision');
    if(execute){
      const resolved=await env.DB.prepare('SELECT choice,receipt_json FROM sync_review_resolutions WHERE tenant_id=? AND review_id=?').bind(tenantId,reviewId).first();
      if(resolved)return resolved.choice===choice?json({success:true,choice,posted:true,status:'resolved',receipt:JSON.parse(resolved.receipt_json)}):json({success:false,error:'Decision already executed'},409);
      const row=await env.DB.prepare("SELECT proposed_json FROM sync_conflict_reviews WHERE id=? AND tenant_id=? AND status='pending'").bind(reviewId,tenantId).first();
      if(!row||!expectedHeads||typeof expectedHeads!=='object'||Array.isArray(expectedHeads))return badRequest('Review snapshot required');
      const snapshot=await readAuditedReview(env,tenantId,auth.principal.id,JSON.stringify(['decision',reviewId,choice,expectedHeads]),checkpointProtocol);
      const normalize=heads=>JSON.stringify(Object.entries(heads).sort(([a],[b])=>a.localeCompare(b)));
      if(normalize(expectedHeads)!==normalize(snapshot.heads))return json({success:false,error:'Review changed; refresh before deciding'},409);
      if(!snapshot.ready)return json({success:true,posted:false,status:'validating',processedCount:snapshot.processedCount,totalCount:snapshot.totalCount},202);
      const events=JSON.parse(row.proposed_json),heads={...snapshot.heads},groups=new Map();
      const replacements=choice==='local'?events.map((event,index)=>{
        if(event.groupId&&!groups.has(event.groupId))groups.set(event.groupId,crypto.randomUUID());
        return attachConflictPreconditions({...event,id:`review:${reviewId}:${index}`,timestamp:Date.now(),
          ...(event.groupId?{groupId:groups.get(event.groupId)}:{})},heads);
      }):[];
      // Validate full financial replay before any acceptance. Unsupported old
      // records block review, retaining every source rather than guessing.
      const history=[...snapshot.history,...replacements.map((event,index)=>({...event,sequence:snapshot.cursor+index+1}))];
      const ledger=replayReviewedLedger(history,tenantId,{branches:snapshot.branches,checkpoint:snapshot.ledger||null});
      reviewedLedgerState(ledger,tenantId,snapshot.cursor,snapshot.branches[0]?.id);
      const receipt={tenantId,reviewId,choice,events,acceptedEventIds:replacements.map(event=>event.id),
        ...(snapshot.jobId?{checkpointJobId:snapshot.jobId}:{})};
      const commit={tenantId,reviewId,choice,actorId:auth.principal.id,heads:snapshot.heads,receipt};
      if(replacements.length){
        const posted=await pushEvents({request:new Request(request.url,{method:'POST',headers:request.headers,
          body:JSON.stringify({tenantId,events:replacements})}),env,reviewCommit:commit});
        if(!posted.ok)return posted;
      }else await env.DB.batch(resolutionStatements(env,commit));
      return json({success:true,choice,posted:true,status:'resolved',receipt});
    }
    // Check heads inside the INSERT, not with a race-prone read then write.
    await env.DB.prepare(`INSERT INTO sync_review_decisions(review_id,decided_by,choice)
      SELECT r.id,?,? FROM sync_conflict_reviews r WHERE r.id=? AND r.tenant_id=? AND r.status='pending'
      AND NOT EXISTS(SELECT 1 FROM json_each(r.heads_json) h
        WHERE h.value IS NOT (SELECT last_event_id FROM sync_conflict_heads WHERE tenant_id=r.tenant_id AND conflict_key=h.key))
      ON CONFLICT(review_id) DO NOTHING`).bind(auth.principal.id,choice,reviewId,tenantId).run();
    const saved=await env.DB.prepare('SELECT d.choice FROM sync_review_decisions d JOIN sync_conflict_reviews r ON r.id=d.review_id WHERE r.id=? AND r.tenant_id=?').bind(reviewId,tenantId).first();
    if(saved?.choice!==choice)return json({success:false,error:'Review changed or decision already recorded; refresh the review'},409);
    return json({success:true,choice,posted:false,status:'awaiting_reconciliation'});
  }catch(error){return json({success:false,error:String(error?.message).includes('SYNC_REVIEW_STALE')?'Review changed; refresh before deciding':'Review cannot be safely reconciled; sources retained'},409);}
}

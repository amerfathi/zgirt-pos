import {sourceEvent,readReviewSnapshot} from './reviewResolution.js';
import {replayReviewedLedger,reviewedLedgerState} from '../../src/services/reviewLedgerReplay.js';
import {readLegacyProductProofs} from './legacyProductReference.js';

const PAGE=200;
const branch=row=>({id:row.id,tenantId:row.tenant_id,name:row.name,code:row.code||'',phone:row.phone||'',
  address:row.address||'',managerName:row.manager_name||'',isMain:Boolean(row.is_main),status:row.status});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))
  .map(byte=>byte.toString(16).padStart(2,'0')).join('');

// Authenticated manual review only. Client input never supplies a projection.
// Each request replays at most PAGE sources, and never splits an atomic group.
// A new tenant revision uses a new job; no partially checked state is installed.
export async function readAuditedReview(env,tenantId,actorId,requestKey,checkpointProtocol){
  const [count,heads,branches]=await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) n,COALESCE(MAX(sequence),0) cursor FROM sync_events_v2 WHERE tenant_id=?').bind(tenantId),
    env.DB.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id=? ORDER BY conflict_key').bind(tenantId),
    env.DB.prepare('SELECT * FROM branches WHERE tenant_id=? ORDER BY id').bind(tenantId)
  ]);
  if(count.results[0].n<=2000)return {...await readReviewSnapshot(env,tenantId),ready:true,jobId:null,ledger:null,
    processedCount:count.results[0].n,totalCount:count.results[0].n};
  if(checkpointProtocol!==2)throw Error('Client upgrade required for bounded review');
  const snapshot={heads:Object.fromEntries(heads.results.map(row=>[row.conflict_key,row.last_event_id])),
    branches:branches.results.map(branch),cursor:count.results[0].cursor,jobId:null,ledger:null,history:[],
    processedCount:0,totalCount:count.results[0].n};
  const header=JSON.stringify(snapshot),total=count.results[0].n;
  // Changing replay policy requires a new version. Pausing past an hour must
  // not restart a valid job or let an old algorithm supply a new checkpoint.
  const id=await digest(JSON.stringify(['review-checkpoint-v2:1',tenantId,actorId,requestKey,header]));
  let job=await env.DB.prepare('SELECT * FROM sync_review_checkpoint_jobs WHERE id=? AND tenant_id=? AND actor_id=?')
    .bind(id,tenantId,actorId).first();
  if(!job){
    const ledger=replayReviewedLedger([],tenantId,{branches:snapshot.branches});
    await env.DB.prepare(`INSERT INTO sync_review_checkpoint_jobs
      (id,tenant_id,actor_id,target_cursor,processed_cursor,processed_count,total_count,header_json,ledger_json)
      SELECT ?,?,?,?,0,0,?,?,? WHERE COALESCE((SELECT MAX(sequence) FROM sync_events_v2 WHERE tenant_id=?),0)=?
      ON CONFLICT(id) DO NOTHING`).bind(id,tenantId,actorId,snapshot.cursor,total,header,JSON.stringify(ledger),tenantId,snapshot.cursor).run();
    job=await env.DB.prepare('SELECT * FROM sync_review_checkpoint_jobs WHERE id=? AND tenant_id=? AND actor_id=?')
      .bind(id,tenantId,actorId).first();
  }
  if(!job)throw Error('Review changed; refresh before deciding');
  if(job.status!=='ready'){
    const rows=await env.DB.prepare(`SELECT * FROM sync_events_v2 WHERE tenant_id=? AND sequence>? AND sequence<=?
      ORDER BY sequence LIMIT 201`).bind(tenantId,job.processed_cursor,job.target_cursor).all();
    let page=rows.results.slice(0,PAGE);
    if(rows.results.length>PAGE&&page.at(-1).group_id&&page.at(-1).group_id===rows.results[PAGE].group_id){
      const group=page.at(-1).group_id;page=page.slice(0,page.findIndex(row=>row.group_id===group));
    }
    if(!page.length)throw Error('Invalid checkpoint source boundary');
    const cursor=page.at(-1).sequence,processed=job.processed_count+page.length;
    const events=page.map(sourceEvent),legacy=events.filter(event=>event.entityType==='product'&&!event.branchId);
    if(legacy.length){
      const proofs=await readLegacyProductProofs(env,tenantId,legacy.map(event=>({productId:event.entityId,parentId:null})),job.target_cursor);
      for(const [index,event] of legacy.entries()){
        if(!proofs[index])throw Error('Ambiguous legacy product branch');
        event.branchId=proofs[index].branchId;event.payload.branchId=proofs[index].branchId;
      }
    }
    const ledger=replayReviewedLedger(events,tenantId,{checkpoint:JSON.parse(job.ledger_json)});
    const ready=cursor===job.target_cursor;
    if(ready){
      if(processed!==job.total_count)throw Error('Incomplete reviewed checkpoint');
      reviewedLedgerState(ledger,tenantId,cursor,snapshot.branches[0]?.id);
    }
    await env.DB.prepare(`UPDATE sync_review_checkpoint_jobs SET processed_cursor=?,processed_count=?,ledger_json=?,status=?
      WHERE id=? AND tenant_id=? AND actor_id=? AND processed_cursor=? AND status='validating'
      AND COALESCE((SELECT MAX(sequence) FROM sync_events_v2 WHERE tenant_id=?),0)=target_cursor`)
      .bind(cursor,processed,JSON.stringify(ledger),ready?'ready':'validating',id,tenantId,actorId,job.processed_cursor,tenantId).run();
    job=await env.DB.prepare('SELECT * FROM sync_review_checkpoint_jobs WHERE id=? AND tenant_id=? AND actor_id=?')
      .bind(id,tenantId,actorId).first();
    const current=await env.DB.prepare('SELECT COALESCE(MAX(sequence),0) cursor FROM sync_events_v2 WHERE tenant_id=?').bind(tenantId).first();
    if(current.cursor!==snapshot.cursor)throw Error('Review changed; refresh before deciding');
  }
  if(job.status!=='ready')return {...snapshot,ready:false,processedCount:job.processed_count,totalCount:job.total_count};
  return {...snapshot,ready:true,jobId:id,ledger:JSON.parse(job.ledger_json),history:[],processedCount:job.processed_count};
}

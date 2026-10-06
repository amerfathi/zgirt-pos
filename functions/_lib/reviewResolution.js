export function resolutionStatements(env, commit) {
  return [env.DB.prepare(`INSERT INTO sync_review_resolutions
    (review_id,tenant_id,decided_by,choice,expected_heads_json,receipt_json) VALUES(?,?,?,?,?,?)`)
    .bind(commit.reviewId,commit.tenantId,commit.actorId,commit.choice,JSON.stringify(commit.heads),JSON.stringify(commit.receipt)),
  env.DB.prepare("UPDATE sync_conflict_reviews SET status='resolved' WHERE id=? AND tenant_id=?")
    .bind(commit.reviewId,commit.tenantId)];
}

export function sourceEvent(row){
  return {id:row.id,tenantId:row.tenant_id,branchId:row.branch_id,sequence:row.sequence,groupId:row.group_id,
    entityType:row.entity_type,entityId:row.entity_id,action:row.action,payload:JSON.parse(row.payload_json),
    conflictPolicyVersion:row.conflict_policy_version,preconditions:row.preconditions_json?JSON.parse(row.preconditions_json):null};
}

// Listing evidence does not need a financial replay. Fetch only the current
// competitors of the bounded pending inbox, in the same transaction as heads.
// Execution/recovery still require the independently validated complete ledger.
export async function readReviewEvidence(env,tenantId,keys){
  const [heads,events]=await env.DB.batch([
    env.DB.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id=? ORDER BY conflict_key').bind(tenantId),
    env.DB.prepare(`SELECT event.* FROM sync_events_v2 event WHERE event.tenant_id=?
      AND event.id IN(SELECT head.last_event_id FROM sync_conflict_heads head
        WHERE head.tenant_id=? AND head.conflict_key IN(SELECT value FROM json_each(?)))
      ORDER BY event.sequence`).bind(tenantId,tenantId,JSON.stringify([...new Set(keys)]))
  ]);
  return {heads:Object.fromEntries(heads.results.map(row=>[row.conflict_key,row.last_event_id])),
    history:events.results.map(sourceEvent)};
}

// A bounded, consistent snapshot, used only for manual review/recovery, never
// normal background polling. Larger histories fail closed, not partially replay.
export async function readReviewSnapshot(env,tenantId){
  const [events,heads,branches]=await env.DB.batch([
    env.DB.prepare('SELECT * FROM sync_events_v2 WHERE tenant_id=? ORDER BY sequence LIMIT 2001').bind(tenantId),
    env.DB.prepare('SELECT conflict_key,last_event_id FROM sync_conflict_heads WHERE tenant_id=? ORDER BY conflict_key').bind(tenantId),
    env.DB.prepare('SELECT * FROM branches WHERE tenant_id=? ORDER BY id').bind(tenantId)
  ]);
  if(events.results.length>2000)throw new Error('Review history requires a larger audited checkpoint');
  return {history:events.results.map(sourceEvent),heads:Object.fromEntries(heads.results.map(row=>[row.conflict_key,row.last_event_id])),
    branches:branches.results.map(row=>({id:row.id,tenantId:row.tenant_id,name:row.name,code:row.code||'',phone:row.phone||'',
      address:row.address||'',managerName:row.manager_name||'',isMain:Boolean(row.is_main),status:row.status})),
    cursor:events.results.at(-1)?.sequence||0};
}

import {sourceEvent} from './reviewResolution.js';
import {proveLegacyProduct} from '../../src/services/legacyProductProof.js';

// Indexed identity reads plus SQL existence checks over every reference in the
// frozen tenant prefix. No arbitrary history cutoff, branch guessing or source
// rewrite. Many requested proofs use two D1 batches, not two calls per item.
export async function readLegacyProductProofs(env,tenantId,references,cursor){
  const inputs=await env.DB.batch(references.flatMap(ref=>[
    env.DB.prepare(`SELECT * FROM sync_events_v2 WHERE tenant_id=? AND entity_type='product'
      AND entity_id=? AND action='create' AND sequence<=? ORDER BY sequence LIMIT 2`).bind(tenantId,ref.productId,cursor),
    env.DB.prepare(`SELECT * FROM sync_events_v2 WHERE tenant_id=? AND entity_type='invoice' AND action='create'
      AND sequence<=? AND (? IS NULL OR id=?)
      AND EXISTS(SELECT 1 FROM json_each(payload_json,'$.items') item WHERE json_extract(item.value,'$.productId')=?)
      ORDER BY sequence LIMIT 1`).bind(tenantId,cursor,ref.parentId||null,ref.parentId||null,ref.productId)
  ]));
  const plans=references.map((ref,index)=>{
    const originals=inputs[index*2].results,parentRow=inputs[index*2+1].results[0];
    if(originals.length!==1||!parentRow)return null;
    const source=sourceEvent(originals[0]),parent=sourceEvent(parentRow);
    return proveLegacyProduct([source,parent],parent.id,ref.productId);
  });
  const valid=plans.filter(Boolean);
  if(!valid.length)return plans;
  const checks=await env.DB.batch(valid.map(proof=>env.DB.prepare(`SELECT 1 bad FROM sync_events_v2
    WHERE tenant_id=? AND sequence<=? AND (
      (entity_type='product' AND entity_id=? AND id<>? AND
        (action<>'update' OR sequence<=? OR branch_id IS NOT ? OR
          (COALESCE(json_extract(payload_json,'$.branchId'),'')<>'' AND json_extract(payload_json,'$.branchId') IS NOT ?)))
      OR ((json_extract(payload_json,'$.productId')=? OR json_extract(payload_json,'$.sourceProductId')=?
        OR json_extract(payload_json,'$.destinationProductId')=? OR
        EXISTS(SELECT 1 FROM json_each(payload_json,'$.items') item WHERE json_extract(item.value,'$.productId')=?))
        AND (branch_id IS NOT ? OR COALESCE(json_extract(payload_json,'$.fromBranchId'),'')<>''
          OR COALESCE(json_extract(payload_json,'$.toBranchId'),'')<>''))
    ) LIMIT 1`).bind(tenantId,cursor,proof.source.entityId,proof.source.id,proof.source.sequence,proof.branchId,proof.branchId,
      proof.source.entityId,proof.source.entityId,proof.source.entityId,proof.source.entityId,proof.branchId)));
  let checked=0;
  return plans.map(proof=>!proof?null:checks[checked++].results.length?null:proof);
}

export async function readLegacyProductProof(env,tenantId,productId,cursor){
  return (await readLegacyProductProofs(env,tenantId,[{productId,parentId:null}],cursor))[0];
}

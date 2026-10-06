// Local-only storage recovery harness. No production backend, real browser storage.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const modules=new Set(['atomicStore.js','tenantStorage.js','authSession.js','branchEvents.js','durableAggregate.js','legacyMigrationAudit.js','businessEffects.js','invoiceInventory.js','liquidityMigrationAudit.js','backupValidation.js','syncConflictPolicy.js',
  'cashDrawerJournal.js','cashShiftEngine.js','cashMovement.js','offlineUnlock.js','verifiedOfflineGrant.js','offlineShiftGrantPolicy.js',
  'missingDependency.js','independentSales.js','reviewLedgerReplay.js','branchAccess.js','legacyProductProof.js',
  'invoiceMutationPolicy.js','offlineGrantStore.js','offlineDeviceIdentity.js']);
const html=`<!doctype html><html lang="en"><title>Braka atomic storage verification</title>
<h1>Isolated atomic storage verification</h1><p id="status">Loading</p>
<button id="commit">Commit sale fixture</button><button id="fail">Fail before commit</button>
<pre id="result"></pre><script type="module">
import {AtomicStore} from '/atomicStore.js';import {SYNC_HEADS_STATE_KEY} from '/syncConflictPolicy.js';
const user={id:'browser-fixture',tenantId:'isolated-test'};
window.store=new AtomicStore(user,{invoices:[],stock:20,debt:0,[SYNC_HEADS_STATE_KEY]:{}});
window.ready=await store.acquire();
const display=()=>document.querySelector('#result').textContent=JSON.stringify({ready,record:store.value},null,2);
document.querySelector('#status').textContent=ready?'Writer ready':'Second window is read-only';
document.querySelector('#commit').onclick=()=>{store.transact(()=>{
 if(store.read('invoices').length)return;
 store.set('invoices',[{id:'sale'}]);store.set('stock',17);store.set('debt',15);
 store.enqueue({id:'browser-event',tenantId:user.tenantId,entityId:'sale',entityType:'invoice',action:'create',payload:{id:'sale'}});
});display();};
document.querySelector('#fail').onclick=()=>{try{store.transact(()=>{store.set('stock',-999);throw Error('Injected interruption');});}catch(e){document.querySelector('#status').textContent=e.message;}display();};
display();
</script></html>`;
const server=createServer(async(req,res)=>{
  const name=req.url.slice(1);
  if(req.url==='/'){res.setHeader('content-type','text/html');res.end(html);return;}
  if(req.url==='/config/offlineGrantPublicKey.js'){
    res.setHeader('content-type','application/javascript');
    res.end(await readFile(new URL('../src/config/offlineGrantPublicKey.js',import.meta.url)));return;
  }
  if(req.url==='/data/initialData.js'){
    res.setHeader('content-type','application/javascript');
    res.end(await readFile(new URL('../src/data/initialData.js',import.meta.url)));return;
  }
  if(!modules.has(name)){res.writeHead(404);res.end();return;}
  res.setHeader('content-type','application/javascript');
  res.end(await readFile(new URL('../src/services/'+name,import.meta.url)));
});
server.listen(0,'127.0.0.1',()=>{
  const address=server.address();
  if(!address||typeof address==='string') throw Error('Missing TCP test server port');
  console.log(`Atomic harness: http://127.0.0.1:${address.port}`);
});

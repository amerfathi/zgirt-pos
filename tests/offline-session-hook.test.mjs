import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {issueSignedOfflineGrant} from '../functions/_lib/offlineGrantSignature.js';
import {seedAggregate} from './aggregate-fixture.mjs';

const storage=()=>({items:new Map(),getItem(key){return this.items.get(key)??null;},
  setItem(key,value){this.items.set(key,String(value));},removeItem(key){this.items.delete(key);},
  clear(){this.items.clear();},key(index){return [...this.items.keys()][index]??null;},get length(){return this.items.size;}});

for(const expire of [false,true])test(expire ?
  'expired local cashier authorization closes the writer without erasing saved financial data' :
  'internet restoration does not revoke a valid local cashier grant through an unauthenticated cloud 401',async()=>{
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true,locks:{async request(key,options,callback){return callback({});}}}});
  let reloads=0;
  const listeners=new Map();
  Object.defineProperty(globalThis,'window',{configurable:true,value:{
    addEventListener(name,fn){listeners.set(name,[...(listeners.get(name)||[]),fn]);},
    removeEventListener(name,fn){listeners.set(name,(listeners.get(name)||[]).filter(item=>item!==fn));},
    location:{origin:'https://test.invalid',reload(){reloads++;}}}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{addEventListener(){},removeEventListener(){},visibilityState:'hidden'}});
  const bundled=await build({stdin:{contents:"export {useAppStore} from './src/store/useAppStore.js';export {setOfflineSession,getSessionUser,getSessionToken,setSessionToken} from './src/services/authSession.js';export {enrollOfflineGrant,unlockOfflineGrant} from './src/services/offlineUnlock.js';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',packages:'external',define:{'import.meta.env':'{}'}});
  const loaded={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),loaded,loaded.exports);
  const {useAppStore,setOfflineSession,getSessionUser,getSessionToken,setSessionToken,enrollOfflineGrant,unlockOfflineGrant}=loaded.exports;
  const issuer=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const eventKey=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pin=await crypto.subtle.exportKey('jwk',issuer.publicKey);
  const grant=await issueSignedOfflineGrant(await crypto.subtle.exportKey('jwk',issuer.privateKey),{
    tenantId:'A',cashierId:'local-cashier',deviceId:'local-device',branchIds:['main'],drawerIds:['drawer'],
    onlineVerifiedAt:new Date(Date.now()-9*60*60*1000).toISOString(),principalType:'user',credentialVersion:0,
    offlineIdentity:{role:'cashier',permissions:{canSell:true,canAccessSettings:false},syncScopeVersion:0},
    eventPublicJwk:await crypto.subtle.exportKey('jwk',eventKey.publicKey)});
  const input={tenantId:'A',cashierId:'local-cashier',deviceId:'local-device',branchId:'main',password:'fixture-only',pinnedPublicJwk:pin};
  const record=await enrollOfflineGrant({...input,envelope:grant,eventPrivateJwk:await crypto.subtle.exportKey('jwk',eventKey.privateKey)});
  setOfflineSession(await unlockOfflineGrant(record,input),'main');
  seedAggregate(localStorage,getSessionUser(),{products_v3:[],invoices_v3:[],cash_shifts_v1:[],branches_v1:[{id:'main',tenantId:'A',name:'Main',isMain:true}],active_branch_id_v1:'main'});
  const before=localStorage.getItem('braka:A:local-cashier:atomic_v1'),requested=[],originalFetch=globalThis.fetch,OriginalDate=globalThis.Date;
  globalThis.fetch=async url=>{requested.push(String(url));return Response.json({success:false,error:'No server session'},{status:401});};
  let app,root;function Harness(){app=useAppStore({durableRepository:null});return null;}
  try {
    await act(async()=>{root=TestRenderer.create(React.createElement(Harness));await new Promise(resolve=>setTimeout(resolve,30));});
    assert.equal(app.currentUser?.id,'local-cashier');
    assert.equal(getSessionUser()?.isOfflineSession,true);
    assert.equal(getSessionToken(),'');
    assert.equal(reloads,0);
    assert.equal(requested.some(url=>url.endsWith('/api/auth/me')),false);
    assert.equal(localStorage.getItem('braka:A:local-cashier:atomic_v1'),before);
    if(expire) {
      const clock=OriginalDate.now()+16*60*60*1000;
      globalThis.Date=new Proxy(OriginalDate,{
        construct(target,args){return Reflect.construct(target,args.length?args:[clock]);},
        get(target,key){return key==='now'?()=>clock:Reflect.get(target,key);}
      });
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
      await act(async()=>{for(const fn of listeners.get('focus')||[]){fn();fn();}await new Promise(resolve=>setTimeout(resolve,30));});
      assert.equal(app.currentUser,null);
      assert.equal(getSessionUser(),null);
      assert.equal(getSessionToken(),'');
      assert.equal(reloads,1);
      assert.equal(localStorage.getItem('braka:A:local-cashier:atomic_v1'),before);
    }
  } finally {
    globalThis.Date=OriginalDate;
    await act(async()=>{root?.unmount();});setSessionToken(null);globalThis.fetch=originalFetch;
    delete globalThis.window;delete globalThis.document;
  }
});

// Owner-authorized disposable tenants only. Never prints credentials or tokens.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {hashPassword} from '../functions/_lib/passwords.js';
import {attachConflictPreconditions} from '../src/services/syncConflictPolicy.js';
import {requestReviewedOperation} from '../src/services/reviewProgress.js';
const directory='scratch/artifacts/live-large-review',file=directory+'/private-fixture.json';
if(process.argv[2]==='--prepare'){
  await mkdir(directory,{recursive:true});
  try{await access(file);throw Error('Fixture already prepared; never overwrite it');}catch(error){if(error.code!=='ENOENT')throw error;}
  const prefix='LIVEQA-'+crypto.randomUUID().slice(0,8).toUpperCase();
  const config={password:crypto.randomUUID()+'Aa!',companies:{CA:prefix+'-CA',CB:prefix+'-CB'}};
  const hash=await hashPassword(config.password),q=value=>"'"+String(value).replaceAll("'","''")+"'",sql=[];
  for(const company of Object.values(config.companies)){
    sql.push(`INSERT INTO tenants(id,store_code,company_name,username,password_hash,status,role,allowed_branches,expires_at,notes)
      VALUES(${q(company)},${q(company)},'Bounded review QA',${q('owner-'+company)},${q(hash)},'active','company_owner',2,datetime('now','+2 days'),'Disposable bounded-review fixture');`);
    for(const index of [1,2])sql.push(`INSERT INTO branches(id,tenant_id,name,code,is_main,status)
      VALUES(${q(company+'-branch-'+index)},${q(company)},${q('QA '+index)},${q('QA'+index)},${index===1?1:0},'active');`);
  }
  await writeFile(file,JSON.stringify(config),{mode:0o600});
  await writeFile(directory+'/provision.sql',sql.join('\n'),{mode:0o600});
  console.log(JSON.stringify({prepared:true,companies:2,credentialsPrinted:false}));
}else{
  const origin=process.env.BRAKA_REVIEW_ORIGIN||'https://qa-2614.khodar-pos.pages.dev';
  assert.match(origin,/^https:\/\/(qa-2614\.)?khodar-pos\.pages\.dev$/);
  const config=JSON.parse(await readFile(file,'utf8'));
  for(const company of Object.values(config.companies))assert.match(company,/^LIVEQA-[A-F0-9]{8}-C[AB]$/);
  const tenantId=config.companies.CA,branchId=tenantId+'-branch-1',productId=tenantId+'-p',customerId=tenantId+'-c';
  let token;
  const send=(path,method='GET',body,bearer=token)=>fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const call=async(path,method='GET',body,bearer=token)=>{
    const response=await send(path,method,body,bearer),raw=await response.text();
    let data;
    try{data=JSON.parse(raw);}catch{throw Error(path+': HTTP '+response.status+' non-JSON; edge resource error='+/\b1102\b/.test(raw));}
    assert.equal(response.status,200,path+': '+response.status+' '+(data.error||''));return data;
  };
  const login=async company=>(await call('/api/tenants/lookup','POST',{storeCode:company,username:'owner-'+company,password:config.password},undefined)).session.token;
  const readComplete=async()=>{
    let page,cursor=0;const events=[];
    do{page=await call('/api/sync/pull?tenantId='+tenantId+'&cursor='+cursor+'&limit=1000');cursor=page.nextCursor;events.push(...page.events);}while(page.hasMore);
    assert.ok(page.conflictHeads,'Only the terminal pull page supplies current heads');
    return {...page,events};
  };
  token=await login(tenantId);
  if(process.argv[2]==='--status'){
    const history=await readComplete();
    console.log(JSON.stringify({acceptedSources:history.events.length,acceptedHistory:history.events.filter(row=>row.id.startsWith(tenantId+'-history-')).length}));
  }else if(['--seed','--resume-seed'].includes(process.argv[2])){
    const seedSnapshot=await readComplete();
    if(process.argv[2]==='--seed')assert.equal(seedSnapshot.events.length,0,'Never restart an interrupted seed blindly');
    const heads={...seedSnapshot.conflictHeads};
    const source=(id,type,payload,action='create',scope=branchId)=>attachConflictPreconditions({id,tenantId,branchId:scope,entityType:type,entityId:payload.id||'settings',action,timestamp:Date.now(),payload:{tenantId,...(scope?{branchId:scope}:{}),...payload}},heads);
    const recorded=new Set(seedSnapshot.events.map(row=>row.id));
    if(recorded.size){
      assert.ok(['product','customer','invoice','receipt'].every(suffix=>recorded.has(tenantId+'-'+suffix)),'Financial seed incomplete; inspect before continuing');
    }else{
      const events=[source(tenantId+'-product','product',{id:productId,name:'Carrot',currentStockKg:20,branchStock:{[branchId]:20},costPerKg:2,defaultPricePerKg:5}),
      source(tenantId+'-customer','customer',{id:customerId,name:'QA customer',balance:0}),
      source(tenantId+'-invoice','invoice',{id:tenantId+'-invoice',customerId,status:'active',saleType:'credit',finalTotal:15,paidAmount:0,remainingDebt:15,items:[{productId,netWeight:3,pricePerKg:5}]}),
      source(tenantId+'-receipt','customer_payment',{id:tenantId+'-receipt',customerId,amount:5,method:'cash'})];
      await call('/api/sync/push','POST',{tenantId,events});
    }
    const acceptedHistory=seedSnapshot.events.filter(row=>row.id.startsWith(tenantId+'-history-'));
    assert.ok(acceptedHistory.every(row=>row.entityType==='settings'&&row.action==='update'&&row.payload.tenantId===tenantId&&Object.keys(row.payload).length===1));
    for(let index=0;index<acceptedHistory.length;index++)assert.ok(recorded.has(tenantId+'-history-'+index),'Non-contiguous accepted prefix');
    const size=10;
    for(let start=acceptedHistory.length;start<2100;start+=size){
      const batch=Array.from({length:Math.min(size,2100-start)},(_,index)=>source(tenantId+'-history-'+(start+index),'settings',{},'update',null));
      await call('/api/sync/push','POST',{tenantId,events:batch});
      if((start+size)%100===0)console.log(JSON.stringify({acceptedHistory:start+size}));
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    console.log(JSON.stringify({seeded:true,acceptedSources:2104,isolatedTenant:true}));
  }else{
    const other=await login(config.companies.CB);
    assert.equal((await send('/api/sync/conflicts?tenantId='+tenantId,'GET',undefined,other)).status,403);
    const snapshot=await readComplete();
    const make=(id,price)=>attachConflictPreconditions({id,tenantId,branchId,entityType:'product',entityId:productId,action:'update',timestamp:Date.now(),payload:{id:productId,defaultPricePerKg:price}},{...snapshot.conflictHeads});
    const local=make('large-live-local-'+crypto.randomUUID(),12),remote=make('large-live-remote-'+crypto.randomUUID(),11);
    await call('/api/sync/push','POST',{tenantId,events:[remote]});
    const saved=await call('/api/sync/conflicts','POST',{tenantId,events:[local]});
    const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    let validating=0;
    try{
      const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
      const errors=[];page.on('pageerror',error=>errors.push(error instanceof Error?error.message:String(error)));
      page.on('response',response=>{if(response.url().endsWith('/api/sync/conflicts')&&response.request().method()==='PATCH'&&response.status()===202)validating++;});
      await page.goto(origin+'/?login=true&tab=settings',{waitUntil:'networkidle2'});
      const click=text=>page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(row=>row.textContent.trim()===text);if(!button)throw Error('Missing '+text);button.click();},text);
      await page.locator('button[title="تغيير كود المتجر"]').click();await page.locator('input[placeholder="مثال: BRK-101"]').fill(tenantId);await click('تثبيت');
      await page.locator('input[placeholder*="أدخل اسم المستخدم"]').fill('owner-'+tenantId);await page.locator('input[type="password"]').fill(config.password);await page.locator('form button[type="submit"]').click();
      await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(row=>row.textContent.includes('السحابة والنسخ الاحتياطي')),{timeout:45000});
      await page.evaluate(()=>[...document.querySelectorAll('button')].find(row=>row.textContent.includes('السحابة والنسخ الاحتياطي')).click());
      await click('تحميل المراجعات');await page.waitForSelector(`input[name="review-${saved.reviewId}"]`);
      const article=await page.evaluateHandle(id=>[...document.querySelectorAll('section[aria-label="مراجعة تعارضات البيانات"] article')].find(row=>row.querySelector(`input[name="review-${id}"]`)),saved.reviewId);
      await article.evaluate(row=>{const radio=row.querySelectorAll('input[type="radio"]')[1];if(!(radio instanceof HTMLInputElement))throw Error('Missing choice');radio.click();[...row.querySelectorAll('button')].find(button=>button.textContent==='اعتماد المصدر المختار').click();});
      const finished=page.waitForResponse(response=>response.url().endsWith('/api/sync/conflicts')&&response.request().method()==='PATCH'&&response.status()!==202,{timeout:90000});
      await article.evaluate(row=>[...row.querySelectorAll('button')].find(button=>button.textContent==='تأكيد الاعتماد والتسوية').click());
      const response=await finished,data=await response.json();assert.equal(response.status(),200,JSON.stringify(data));assert.equal(data.posted,true);assert.ok(validating>0);
      await page.waitForFunction(id=>!document.querySelector(`input[name="review-${id}"]`),{},saved.reviewId);
      const recovery=await requestReviewedOperation(()=>send('/api/sync/resolutions','POST',{tenantId,events:[local],checkpointProtocol:2}));
      assert.equal(recovery.response.status,200);assert.equal(recovery.data.protocol,'owner-reviewed-checkpoint-v2');
      const product=recovery.data.checkpoint.products.find(row=>row.id===productId),customer=recovery.data.checkpoint.customers.find(row=>row.id===customerId);
      assert.equal(product.currentStockKg,17);assert.equal(product.defaultPricePerKg,12);assert.equal(customer.balance,10);
      assert.equal(recovery.data.history.length,1);assert.deepEqual(errors,[]);
      await page.screenshot({path:directory+'/owner-reviewed-live.png',fullPage:true});
      console.log(JSON.stringify({ownerUiApproved:true,validatingResponses:validating,stock:17,debt:10,price:12,recovery:true,crossTenantDenied:true,pageErrors:errors}));
    }finally{await browser.close();}
  }
}

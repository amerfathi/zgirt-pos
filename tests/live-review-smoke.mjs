// Explicitly authorized disposable QA tenants only. Never prints credentials.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {attachConflictPreconditions} from '../src/services/syncConflictPolicy.js';
const config=JSON.parse(await readFile('scratch/artifacts/live-multi-company/private-fixture-config.json','utf8'));
const origin=process.env.BRAKA_REVIEW_ORIGIN||'https://qa-2614.khodar-pos.pages.dev';
if(!/^https:\/\/(qa-2614\.)?khodar-pos\.pages\.dev$/.test(origin)||Object.values(config.companies).some(id=>!/^LIVEQA-[A-F0-9]{8}-C[AB]$/.test(id)))throw Error('Unsafe QA scope');
const tenantId=config.companies.CA,branchId=tenantId+'-branch-1',productId=branchId+'-product';
let token;
const call=async(path,method='GET',body)=>{
  const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();assert.equal(response.status,200,`${path}: ${response.status} ${data.error||''}`);return data;
};
token=(await call('/api/tenants/lookup','POST',{storeCode:tenantId,username:'owner-'+tenantId,password:config.password})).session.token;
const snapshot=await call('/api/sync/pull?tenantId='+tenantId);
const make=(id,price)=>attachConflictPreconditions({id,tenantId,branchId,entityType:'product',entityId:productId,action:'update',timestamp:Date.now(),payload:{id:productId,defaultPricePerKg:price}},{...snapshot.conflictHeads});
const local=make('qa-review-local-'+crypto.randomUUID(),12),remote=make('qa-review-server-'+crypto.randomUUID(),11);
await call('/api/sync/push','POST',{tenantId,events:[remote]});
const saved=await call('/api/sync/conflicts','POST',{tenantId,events:[local]});
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
await mkdir('scratch/artifacts/release-2.6.14',{recursive:true});
try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
  const errors=[];page.on('pageerror',error=>errors.push(error instanceof Error?error.message:String(error)));
  await page.goto(origin+'/?login=true&tab=settings',{waitUntil:'networkidle2'});
  const click=async text=>page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(row=>row.textContent.trim()===text);if(!button)throw Error('Missing control: '+text);button.click();},text);
  await page.locator('button[title="تغيير كود المتجر"]').click();await page.locator('input[placeholder="مثال: BRK-101"]').fill(tenantId);await click('تثبيت');
  await page.locator('input[placeholder*="أدخل اسم المستخدم"]').fill('owner-'+tenantId);await page.locator('input[type="password"]').fill(config.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('input[type="password"]'),{timeout:30000});
  try {
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(row=>row.textContent.includes('السحابة والنسخ الاحتياطي')));
  } catch(error) {
    await page.screenshot({path:'scratch/artifacts/release-2.6.14/owner-review-navigation-failure.png',fullPage:true});
    throw error;
  }
  await page.evaluate(()=>[...document.querySelectorAll('button')].find(row=>row.textContent.includes('السحابة والنسخ الاحتياطي')).click());
  await click('تحميل المراجعات');await page.waitForSelector('section[aria-label="مراجعة تعارضات البيانات"] article');
  await page.screenshot({path:'scratch/artifacts/release-2.6.14/owner-review-before.png',fullPage:true});
  const article=await page.evaluateHandle(id=>[...document.querySelectorAll('section[aria-label="مراجعة تعارضات البيانات"] article')].find(row=>row.querySelector(`input[name="review-${id}"]`)),saved.reviewId);
  await article.evaluate(row=>{const radio=row.querySelectorAll('input[type="radio"]')[1];if(!(radio instanceof HTMLInputElement))throw Error('Choice absent');radio.click();[...row.querySelectorAll('button')].find(button=>button.textContent==='اعتماد المصدر المختار').click();});
  const result=page.waitForResponse(response=>response.url().endsWith('/api/sync/conflicts')&&response.request().method()==='PATCH');
  await article.evaluate(row=>[...row.querySelectorAll('button')].find(button=>button.textContent==='تأكيد الاعتماد والتسوية').click());
  const response=await result,data=await response.json();assert.equal(response.status(),200,JSON.stringify(data));assert.equal(data.posted,true);
  await page.waitForFunction(id=>!document.querySelector(`input[name="review-${id}"]`),{},saved.reviewId);
  const recovered=await call('/api/sync/resolutions','POST',{tenantId,events:[local]});assert.equal(recovered.ready,true);
  assert.equal(recovered.checkpoint.products.find(row=>row.id===productId).defaultPricePerKg,12);
  await page.screenshot({path:'scratch/artifacts/release-2.6.14/owner-review-after.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({ownerUiApproved:true,sourcePreserved:true,canonicalPrice:12,receiptRecovery:true,pageErrors:errors}));
}finally{
  await browser.close();
  const latest=await call('/api/sync/pull?tenantId='+tenantId);
  const reset=attachConflictPreconditions({...local,id:'qa-review-price-reset-'+crypto.randomUUID(),payload:{id:productId,defaultPricePerKg:10}},{...latest.conflictHeads});
  await call('/api/sync/push','POST',{tenantId,events:[reset]});
}

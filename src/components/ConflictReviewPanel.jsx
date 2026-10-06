import React, { useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../config/appVersion';
import { apiFetch, getSessionToken } from '../services/authSession';
import { cloudflareSync } from '../services/cloudflareSync';
import { requestReviewedOperation } from '../services/reviewProgress';

const types={product:'صنف',invoice:'فاتورة بيع',expense:'مصروف',purchase:'شراء',customer:'عميل',supplier:'مورد',settings:'إعدادات',customer_payment:'تحصيل عميل',supplier_payment:'سداد مورد'};
const fields={name:'الاسم',price:'السعر',sellingPrice:'سعر البيع',pricePerKg:'سعر الكيلو',amount:'المبلغ',finalTotal:'الإجمالي',paidAmount:'المدفوع',remainingDebt:'المتبقي',currentStockKg:'المخزون',notes:'ملاحظات',status:'الحالة',balance:'الرصيد',items:'بنود الفاتورة',branchStock:'كميات الفروع'};
function Source({events}) {
  return <div className="space-y-3">{events.map(event=><div key={event.id}>
    <p className="font-semibold">{types[event.entityType]||'سجل'}: {event.payload?.name||event.entityId}</p>
    <dl className="mt-2 space-y-1 text-sm">{Object.entries(event.payload||{}).filter(([key])=>fields[key]).map(([key,value])=><div key={key} className="flex flex-wrap justify-between gap-2">
      <dt className="text-slate-600">{fields[key]}</dt><dd className="max-w-full break-words">{typeof value==='object'?JSON.stringify(value):String(value??'—')}</dd>
    </div>)}</dl>
    <details className="mt-2 text-sm"><summary className="cursor-pointer">تفاصيل السجل كاملة</summary><pre dir="ltr" className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3">{JSON.stringify(event.payload,null,2)}</pre></details>
  </div>)}</div>;
}

export default function ConflictReviewPanel({user,branches=[]}) {
  const [reviews,setReviews]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[choices,setChoices]=useState({}),[confirm,setConfirm]=useState(null);
  const activeRequest=useRef(0);
  const [progress,setProgress]=useState(null);
  useEffect(()=>()=>{activeRequest.current++;},[user?.id,user?.tenantId]);
  const allowed=user&&!user.isStaff&&['company_owner','super_admin'].includes(user.role);
  async function request(method,body){
    const token=getSessionToken(),sequence=++activeRequest.current;
    setBusy(true);setError('');setProgress(null);
    try{
      const url=`${getApiBaseUrl()}/api/sync/conflicts${method==='GET'?`?tenantId=${encodeURIComponent(user.tenantId)}`:''}`;
      const result=await requestReviewedOperation(()=>apiFetch(url,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify({...body,tenantId:user.tenantId,checkpointProtocol:2})}:{})}),
        {isCurrent:()=>token===getSessionToken()&&sequence===activeRequest.current,onProgress:setProgress});
      if(!result)return;
      const {response,data}=result;
      if(token!==getSessionToken()||sequence!==activeRequest.current)return;
      if(!response.ok||!data.success)throw new Error(data.error==='Review cannot be safely reconciled; sources retained'
        ?'تعذر تسوية هذه المجموعة بأمان؛ بقيت المصادر كاملة دون تغيير. يلزم فحص السجلات المرتبطة.'
        :response.status===409?'تغيرت بيانات المراجعة أو سبق تسجيل قرار؛ حدّث القائمة قبل المتابعة.':'تعذر تحميل المراجعة أو حفظ الاختيار. تحقق من الاتصال وصلاحية حساب المالك.');
      if(response.status===202)return;
      setProgress(null);
      if(method==='GET')setReviews(data.reviews);
      else {setReviews(rows=>rows.filter(row=>row.id!==body.reviewId));setConfirm(null);void cloudflareSync.syncNow(user.tenantId);}
    }catch(cause){if(token===getSessionToken()&&sequence===activeRequest.current)setError(cause.message);}
    finally{if(sequence===activeRequest.current)setBusy(false);}
  }
  if(!allowed)return null;
  return <section dir="rtl" aria-label="مراجعة تعارضات البيانات" className="rounded-2xl border border-primary-100 bg-white p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold text-navy-850">مراجعة تعارضات البيانات</h3>
      <button type="button" disabled={busy} onClick={()=>request('GET')} className="rounded-xl border border-primary-200 px-4 py-2 text-sm text-primary-700 disabled:opacity-50">{busy?'جارٍ التحميل…':'تحميل المراجعات'}</button></div>
    <p className="text-sm text-slate-600">تعديلات تحتاج اختيارك. تُحفظ المصادر كاملة، ولا يُطبق الاختيار على الأرصدة قبل التحقق والتسوية. بعد الاعتماد يستلم الجهاز النتيجة عند المزامنة.</p>
    {error&&<p role="alert" className="text-sm text-navy-850">{error}</p>}
    {progress&&<p role="status" className="text-sm text-slate-600">جارٍ التحقق من السجل: {progress.processedCount} من {progress.totalCount} حركة. لم يُعتمد القرار بعد؛ يمكنك متابعة التحقق إذا توقف الاتصال.</p>}
    {reviews?.length===0&&<p role="status" className="text-sm">لا توجد مراجعات معلقة في القائمة الحالية.</p>}
    {reviews?.map(review=><article key={review.id} className="border-t border-slate-200 pt-4 space-y-3">
      <p className="text-sm">الفرع: {[...new Set(review.proposedEvents.map(event=>branches.find(branch=>branch.id===event.branchId)?.name||event.branchId||'إعدادات الشركة'))].join('، ')} · أرسله: {review.submittedBy}</p>
      <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl bg-primary-50 p-4"><h4 className="mb-3 font-bold">التعديل المرسل من الجهاز</h4><Source events={review.proposedEvents}/></div>
        <div className="rounded-xl border border-slate-200 p-4"><h4 className="mb-3 font-bold">سجلات الخادم عند تحميل هذه المراجعة</h4><Source events={review.serverEvents}/></div></div>
      <p className="text-xs text-slate-600">قد يشمل التعارض حركات مترابطة وليس تعديلًا للحقل نفسه فقط. الاختيار يخص المجموعة كاملة.</p>
      <fieldset disabled={busy} className="space-y-3"><legend className="text-sm font-semibold">اختيار المصدر للمراجعة</legend>
        {['server','local'].map(choice=><label key={choice} className="me-4 inline-flex items-center gap-2 text-sm"><input type="radio" name={`review-${review.id}`} disabled={Boolean(review.decision)&&review.decision!==choice} checked={(choices[review.id]||review.decision)===choice} onChange={()=>{setChoices(previous=>({...previous,[review.id]:choice}));setConfirm(null);}}/>{choice==='server'?'الإبقاء على سجلات الخادم':'اختيار تعديل الجهاز'}</label>)}
        <div>{confirm===review.id?<div className="space-y-2"><p className="text-sm">سيُعتمد المصدر المختار بعد التحقق من الحسابات، وتُحفظ النسخة الأخرى للاسترداد. هل تؤكد؟</p><button type="button" onClick={()=>request('PATCH',{reviewId:review.id,choice:choices[review.id]||review.decision,execute:true,expectedHeads:review.heads})} className="rounded-lg bg-navy-850 px-4 py-2 text-sm text-white">تأكيد الاعتماد والتسوية</button><button type="button" onClick={()=>setConfirm(null)} className="px-4 py-2 text-sm">رجوع</button></div>:<button type="button" disabled={!choices[review.id]&&!review.decision} onClick={()=>setConfirm(review.id)} className="rounded-lg bg-navy-850 px-4 py-2 text-sm text-white disabled:opacity-50">اعتماد المصدر المختار</button>}</div>
      </fieldset>
    </article>)}
  </section>;
}

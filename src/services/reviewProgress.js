// Continue authenticated manual validation, not ordinary background polling.
// A 202 is progress only: never an acknowledgement or an installable ledger.
/** @param {()=>Promise<Response>} request
 * @param {{isCurrent?:()=>boolean,onProgress?:(value:any)=>void,maxSteps?:number}} options */
export async function requestReviewedOperation(request,{isCurrent=()=>true,onProgress=(_value)=>{},maxSteps=40}={}){
  for(let step=0;step<maxSteps;step++){
    if(!isCurrent())return null;
    const response=await request(),data=await response.json();
    if(!isCurrent())return null;
    if(response.status!==202)return {response,data};
    if(!data?.success||data.status!=='validating'||data.ready===true||data.posted===true||data.checkpoint||
      !Number.isSafeInteger(data.processedCount)||data.processedCount<1||!Number.isSafeInteger(data.totalCount)||data.totalCount<data.processedCount)
      throw Error('Invalid review progress');
    onProgress(data);
    if(step===maxSteps-1)return {response,data};
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Invalid review request bound');
}

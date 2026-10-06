import { json } from '../../_lib/http.js';
function compare(a,b) {
  const x=a.split('.').map(Number), y=b.split('.').map(Number);
  for(let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]>y[i]?1:-1;
  return 0;
}
export async function onRequestGet({request,env}) {
  if(!env?.DB) return json({success:false,error:'Release service unavailable'},503);
  const url=new URL(request.url);
  const platform=url.searchParams.get('platform') || 'web';
  const current=url.searchParams.get('current') || '0.0.0';
  if(!['web','windows','android','ios'].includes(platform) || !/^\d+\.\d+\.\d+$/.test(current)) return json({success:false,error:'Invalid platform/version'},400);
  const {results}=await env.DB.prepare("SELECT * FROM app_releases WHERE platform=? AND status='published'").bind(platform).all();
  const row=results.filter(r=>/^\d+\.\d+\.\d+$/.test(r.version)).sort((a,b)=>compare(b.version,a.version))[0];
  if(!row) return json({success:false,error:'No published release'},404);
  const available=compare(row.version,current)>0;
  return json({success:true,platform,currentVersion:current,latestVersion:row.version,minimumVersion:row.minimum_version,
    isUpdateAvailable:available,isRequired:compare(current,row.minimum_version)<0,updateType:available?row.update_type:'none',
    releaseNotes:JSON.parse(row.release_notes || '[]'),downloadUrl:row.download_url,fileSizeBytes:row.file_size_bytes,
    signedManifest:row.signed_manifest ? JSON.parse(row.signed_manifest) : null,publishedAt:row.published_at});
}

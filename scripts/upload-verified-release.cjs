const fs=require('node:fs');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {verifyManifest,verifyFile}=require('../electron/update-security.cjs');
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8'});
async function main(){
 const runId=process.env.RELEASE_RUN_ID,version=process.env.RELEASE_VERSION;
 const repo=process.env.GH_REPO;
 if(!/^\d+$/.test(runId||'')||!/^\d+\.\d+\.\d+$/.test(version||'')||repo!=='amerfathi/khodar-pos')throw Error('Invalid release input');
 const run=JSON.parse(gh('run','view',runId,'--json','conclusion,event,name,headSha,headBranch'));
 if(run.conclusion!=='success'||run.event!=='workflow_dispatch'||run.name!=='Production release'||run.headBranch!=='main'||!/^[a-f0-9]{40}$/.test(run.headSha))throw Error('Untrusted or unsuccessful producing build');
 const source=JSON.parse(gh('api',`repos/${repo}/contents/package.json?ref=${run.headSha}`));
 if(JSON.parse(Buffer.from(source.content,'base64').toString()).version!==version)throw Error('Version does not match producing commit');
 console.log(`Validated build ${runId} source ${run.headSha} version ${version}`);
 if(process.env.BRAKA_UPLOAD_RELEASE_ASSET!=='true')return;
 const releases=JSON.parse(gh('api',`repos/${repo}/releases`));
 const release=releases.find(row=>row.tag_name===`v${version}`);
 if(!release?.draft||release.target_commitish!==run.headSha)throw Error('Expected source-bound draft release');
 gh('run','download',runId,'--name','windows-release','--dir','verified-release');
 const path='verified-release/dist-electron/KhodarPOS-Setup.exe';
 const manifest=JSON.parse(fs.readFileSync('verified-release/windows-manifest.json','utf8'));
 verifyManifest(manifest,fs.readFileSync('electron/release-public-key.pem'),'0.0.0');
 if(manifest.version!==version)throw Error('Manifest version mismatch');
 await verifyFile(path,manifest);
 const manifestHash=crypto.createHash('sha256').update(fs.readFileSync('verified-release/windows-manifest.json')).digest('hex');
 const publishedManifest=release.assets.find(asset=>asset.name==='windows-manifest.json');
 if(publishedManifest?.state!=='uploaded'||publishedManifest.digest!==`sha256:${manifestHash}`)throw Error('Draft manifest does not match verified build');
 const existing=release.assets.find(asset=>asset.name==='KhodarPOS-Setup.exe');
 if(existing){
  if(existing.state!=='uploaded'||existing.size!==manifest.size||existing.digest!==`sha256:${manifest.sha256}`)throw Error('Existing asset mismatch; refusing overwrite');
 }else gh('release','upload',`v${version}`,path);
 console.log('Verified Windows asset uploaded; release remains draft for final publication verification.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

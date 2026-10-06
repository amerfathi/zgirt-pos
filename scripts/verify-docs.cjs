// Documentation checks only; this does not certify application behavior.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const canonical=['README.md','docs/INDEX.md','docs/releases/2.6.14.md','deployment/production/README.md',
 ...fs.readdirSync('docs/current').filter(name=>name.endsWith('.md')).map(name=>'docs/current/'+name)];
const secrets=[/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
 /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/,/\bsk-[A-Za-z0-9_-]{20,}/,
 /\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/,
 /\b(?:password|secret|token)\s*[=:]\s*["'][^"']{12,}["']/i];
let links=0;
const indexTargets=new Set();
for(const file of canonical.concat(['AI_HANDOFF_CURRENT.md'])){
 const text=fs.readFileSync(file,'utf8');
 assert.ok(!secrets.some(pattern=>pattern.test(text)),`Credential pattern in ${file}`);
 if(!canonical.includes(file))continue;
 for(const match of text.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)){
  const href=match[1];if(/^(?:https?:|mailto:|#)/.test(href))continue;
  const target=path.normalize(path.join(path.dirname(file),decodeURIComponent(href.split('#')[0])));
  assert.ok(fs.existsSync(target),`Missing local documentation link in ${file}: ${href}`);
  if(file==='docs/INDEX.md')indexTargets.add(target.replaceAll('\\','/'));
  links++;
 }
}
const tracked=execFileSync('git',['ls-files','*.md'],{encoding:'utf8'}).trim().split('\n');
for(const file of tracked){if(['README.md','docs/INDEX.md'].includes(file))continue;
 assert.ok(indexTargets.has(file),`Tracked document missing from index: ${file}`);
 if(!['AI_HANDOFF_CURRENT.md','RELEASE_BLOCKERS.md','docs/release-2.6.14-verification.md'].includes(file)&&
     !canonical.includes(file))assert.ok(fs.readFileSync(file,'utf8').includes('سجل تاريخي محفوظ للأدلة'),`Historical document not marked: ${file}`);
}
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
assert.equal(version,'2.6.14','Refresh documentation checkpoint for a new application release');
assert.ok(fs.readFileSync('README.md','utf8').includes(version));
assert.match(fs.readFileSync('src/config/appVersion.js','utf8'),/APP_VERSION = '2\.6\.14'/);
assert.match(fs.readFileSync('android/app/build.gradle','utf8'),/versionName "2\.6\.14"/);
assert.match(fs.readFileSync('src/services/backupValidation.js','utf8'),/data\.version !== 4/);
console.log(JSON.stringify({documentationChecks:'passed',canonicalDocuments:canonical.length,
 trackedDocuments:tracked.length,localLinksChecked:links,credentialPatternsFound:false,
 applicationVersion:version,backupVersion:4}));

const fs=require('fs'),path=require('path');
function applyInfo(root,info){
if(!info)return;
if(!info.title?.trim())throw Error('테마 이름을 입력하세요.');
if(!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(info.packageId||''))throw Error('앱 식별자는 영문자로 시작하는 부분을 점으로 연결하세요. 예: KongeuniThema.NewThema');
if(typeof info.version!=='string'||!info.version.trim()||/[\u0000-\u001f]/.test(info.version))throw Error('버전 표시명을 입력하세요. 예: Kongeuni 또는 1.0.0 Kongeuni');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","\\'");
const theme=path.join(root,'src/main/theme');for(const dir of fs.readdirSync(theme).filter(n=>n.startsWith('values'))){const file=path.join(theme,dir,'strings.xml');if(fs.existsSync(file))fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/(<string name="(?:theme_title|app_name)">)[^<]*(<\/string>)/g,(_,a,b)=>a+esc(info.title)+b))}
const kotlinString=s=>JSON.stringify(s).replaceAll('$','\\$');
const build=path.join(root,'build.gradle.kts');fs.writeFileSync(build,fs.readFileSync(build,'utf8').replace(/applicationId = "(?:\\.|[^"\\])*"/,()=>`applicationId = ${kotlinString(info.packageId)}`).replace(/versionName = "(?:\\.|[^"\\])*"/,()=>`versionName = ${kotlinString(info.version)}`));
}
module.exports={applyInfo};

const fs=require('fs'),path=require('path'),os=require('os');
function selectJava(){
const jdks=path.join(os.homedir(),'.jdks');
const candidates=[process.env.JAVA_HOME,...(fs.existsSync(jdks)?fs.readdirSync(jdks).map(n=>path.join(jdks,n)):[]),'C:\\Program Files\\Android\\Android Studio\\jbr'].filter(Boolean);
for(const home of candidates){try{const release=fs.readFileSync(path.join(home,'release'),'utf8');if(/JAVA_VERSION="21[.\"]/.test(release)&&fs.existsSync(path.join(home,'bin/java.exe')))return home}catch{}}
throw Error('이 템플릿은 JDK 21이 필요합니다. Java 25는 현재 Gradle과 호환되지 않습니다. JDK 21을 설치하고 JAVA_HOME으로 지정해주세요.');
}
module.exports={selectJava};

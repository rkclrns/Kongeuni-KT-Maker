const fs=require('fs'),path=require('path');
const square=(data,nativeImage,label,min)=>{
if(!/^data:image\/png;base64,/.test(data))throw Error(`${label}은 PNG여야 합니다.`);
const image=nativeImage.createFromDataURL(data),size=image.getSize();
if(image.isEmpty()||size.width!==size.height||size.width<min)throw Error(`${label}은 ${min}px 이상의 정사각형이어야 합니다.`);
return image;
};
// icon: legacy square launcher icon. adaptive: { foreground, background } layers for Android 8+.
function applyIcon(root,data,nativeImage,adaptive={}){
const res=path.join(root,'src/main/res'),drawable=path.join(res,'drawable');
const fg=adaptive.foreground?square(adaptive.foreground,nativeImage,'적응형 아이콘 전경',108):null;
const bg=adaptive.background?square(adaptive.background,nativeImage,'적응형 아이콘 배경',108):null;
if(!data&&!fg&&!bg)return;
if(data){
const image=square(data,nativeImage,'테마 아이콘',48);
for(const [density,px] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){const dir=path.join(res,'mipmap-'+density);fs.mkdirSync(dir,{recursive:true});for(const name of ['ic_launcher.png','ic_launcher_round.png'])fs.writeFileSync(path.join(dir,name),image.resize({width:px,height:px,quality:'best'}).toPNG())}
// Without explicit layers, the adaptive icon shows the selected icon with a safe inset, not the old Apeach.
fs.mkdirSync(drawable,{recursive:true});fs.writeFileSync(path.join(drawable,'studio_launcher_foreground.xml'),'<inset xmlns:android="http://schemas.android.com/apk/res/android" android:drawable="@drawable/studio_launcher_icon" android:inset="18%" />');fs.writeFileSync(path.join(drawable,'studio_launcher_icon.png'),image.resize({width:432,height:432,quality:'best'}).toPNG());
}
fs.mkdirSync(drawable,{recursive:true});
if(fg)fs.writeFileSync(path.join(drawable,'studio_adaptive_foreground.png'),fg.resize({width:432,height:432,quality:'best'}).toPNG());
if(bg)fs.writeFileSync(path.join(drawable,'studio_adaptive_background.png'),bg.resize({width:432,height:432,quality:'best'}).toPNG());
const foreground=fg?'@drawable/studio_adaptive_foreground':data?'@drawable/studio_launcher_foreground':'@mipmap/ic_launcher_foreground';
const background=bg?'@drawable/studio_adaptive_background':data?'@android:color/white':'@mipmap/ic_launcher_background';
const adaptiveDir=path.join(res,'mipmap-anydpi-v26');fs.mkdirSync(adaptiveDir,{recursive:true});
for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])fs.writeFileSync(path.join(adaptiveDir,name),`<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="${background}"/><foreground android:drawable="${foreground}"/></adaptive-icon>`);
}
module.exports={applyIcon};

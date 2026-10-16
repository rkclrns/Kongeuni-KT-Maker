const fs=require('fs'),path=require('path');
function applyIcon(root,data,nativeImage){
if(!data)return;if(!/^data:image\/png;base64,/.test(data))throw Error('테마 아이콘은 PNG여야 합니다.');
const image=nativeImage.createFromDataURL(data),size=image.getSize();if(image.isEmpty()||size.width!==size.height||size.width<48)throw Error('테마 아이콘은 48px 이상의 정사각형이어야 합니다.');
const res=path.join(root,'src/main/res');
for(const [density,px] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){const dir=path.join(res,'mipmap-'+density);fs.mkdirSync(dir,{recursive:true});for(const name of ['ic_launcher.png','ic_launcher_round.png'])fs.writeFileSync(path.join(dir,name),image.resize({width:px,height:px,quality:'best'}).toPNG())}
// Adaptive launcher resources override density PNGs on modern Android. Point
// their foreground to the selected icon with a safe inset, not the old Apeach.
const drawable=path.join(res,'drawable');fs.mkdirSync(drawable,{recursive:true});fs.writeFileSync(path.join(drawable,'studio_launcher_foreground.xml'),'<inset xmlns:android="http://schemas.android.com/apk/res/android" android:drawable="@drawable/studio_launcher_icon" android:inset="18%" />');fs.writeFileSync(path.join(drawable,'studio_launcher_icon.png'),image.resize({width:432,height:432,quality:'best'}).toPNG());
const adaptive=path.join(res,'mipmap-anydpi-v26');fs.mkdirSync(adaptive,{recursive:true});for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])fs.writeFileSync(path.join(adaptive,name),'<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@android:color/white"/><foreground android:drawable="@drawable/studio_launcher_foreground"/></adaptive-icon>');
}
module.exports={applyIcon};

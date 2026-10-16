const fs=require('fs'),path=require('path');
function applyProfiles(buildDir,editor={}){
 const root=path.join(buildDir,'src/main/theme/drawable-xxhdpi');
 const fallback=fs.readFileSync(path.join(root,'theme_profile_01_image.png'));
 const count=Math.min(3,Math.max(1,Number(editor.profileCount)||1));
 for(let i=1;i<=count;i++){const name=`theme_profile_0${i}_image.png`,src=editor.images?.[name];const buffer=typeof src==='string'&&src.startsWith('data:image/png;base64,')?Buffer.from(src.split(',')[1],'base64'):fallback;fs.writeFileSync(path.join(root,name),buffer)}
 return count;
}
module.exports={applyProfiles};

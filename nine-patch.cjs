const fs=require('fs'),path=require('path');
const {PNG}=require('pngjs');
function normalize(buffer){
 const src=PNG.sync.read(buffer),w=src.width,h=src.height;
 if(w<3||h<3)throw Error('나인패치 이미지는 3×3px 이상이어야 합니다.');
 const at=(x,y)=>(y*w+x)*4;
 const black=(x,y)=>{const i=at(x,y);return src.data[i+3]>128&&src.data[i]+src.data[i+1]+src.data[i+2]<100};
 const xs=[],ys=[];for(let x=1;x<w-1;x++)if(black(x,0))xs.push(x);for(let y=1;y<h-1;y++)if(black(0,y))ys.push(y);
 const transparentCorners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].every(([x,y])=>src.data[at(x,y)+3]===0);
 const framed=transparentCorners&&xs.length&&ys.length;
 let valid=!!framed;for(let x=0;x<w;x++)for(const y of [0,h-1]){const i=at(x,y);if(src.data[i+3]!==0&&!(src.data[i]===0&&src.data[i+1]===0&&src.data[i+2]===0&&src.data[i+3]===255))valid=false}
 for(let y=0;y<h;y++)for(const x of [0,w-1]){const i=at(x,y);if(src.data[i+3]!==0&&!(src.data[i]===0&&src.data[i+1]===0&&src.data[i+2]===0&&src.data[i+3]===255))valid=false}
 if(valid)return {buffer,changed:false};
 // A framed PNG keeps its interior and marker coordinates. An ordinary PNG
 // keeps every pixel; a new transparent marker border is added around it.
 const out=new PNG({width:framed?w:w+2,height:framed?h:h+2});
 PNG.bitblt(src,out,framed?1:0,framed?1:0,framed?w-2:w,framed?h-2:h,1,1);
 const dot=(x,y)=>{const i=(y*out.width+x)*4;out.data[i]=out.data[i+1]=out.data[i+2]=0;out.data[i+3]=255};
 if(framed){for(let x=1;x<w-1;x++){if(black(x,0))dot(x,0);if(black(x,h-1))dot(x,h-1)}for(let y=1;y<h-1;y++){if(black(0,y))dot(0,y);if(black(w-1,y))dot(w-1,y)}}
 else {const cx=Math.floor((out.width-1)/2),cy=Math.floor((out.height-1)/2);dot(cx,0);dot(0,cy);for(let x=1;x<out.width-1;x++)dot(x,out.height-1);for(let y=1;y<out.height-1;y++)dot(out.width-1,y)}
 return {buffer:PNG.sync.write(out),changed:true};
}
function normalizeTree(root){const changed=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.9.png')){const result=normalize(fs.readFileSync(f));if(result.changed){fs.writeFileSync(f,result.buffer);changed.push(path.relative(root,f))}}}}walk(root);return changed}
function preserveMarkers(buffer,previousBuffer){
 const next=PNG.sync.read(normalize(buffer).buffer),previous=PNG.sync.read(normalize(previousBuffer).buffer);
 const w=next.width,h=next.height,pw=previous.width,ph=previous.height;
 const black=(x,y)=>{const i=(y*pw+x)*4;return previous.data[i+3]===255&&previous.data[i]===0&&previous.data[i+1]===0&&previous.data[i+2]===0};
 // Keep the replacement artwork intact. Only its one-pixel marker frame is
 // replaced; coordinates stay identical unless the new canvas is smaller.
 for(let x=0;x<w;x++)for(const y of [0,h-1])next.data.fill(0,(y*w+x)*4,(y*w+x)*4+4);
 for(let y=0;y<h;y++)for(const x of [0,w-1])next.data.fill(0,(y*w+x)*4,(y*w+x)*4+4);
 const dot=(x,y)=>{const i=(y*w+x)*4;next.data[i]=next.data[i+1]=next.data[i+2]=0;next.data[i+3]=255};
 for(let x=1;x<pw-1;x++){const target=Math.min(w-2,x);if(black(x,0))dot(target,0);if(black(x,ph-1))dot(target,h-1)}
 for(let y=1;y<ph-1;y++){const target=Math.min(h-2,y);if(black(0,y))dot(0,target);if(black(pw-1,y))dot(w-1,target)}
 return PNG.sync.write(next);
}
module.exports={normalize,normalizeTree,preserveMarkers};

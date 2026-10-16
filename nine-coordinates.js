(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.nineCoordinates=factory()})(typeof window==='object'?window:globalThis,function(){
const keys=['x1','x2','y1','y2','p1','p2','p3','p4'];
function validate(values,width,height){if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3)throw Error('원본 이미지 크기 정보가 올바르지 않습니다.');const result={};for(const key of keys){const n=values?.[key],limit=['x1','x2','p1','p2'].includes(key)?width-2:height-2;if(!Number.isInteger(n)||n<1||n>limit)throw Error('붙여넣을 좌표가 현재 이미지 범위를 벗어납니다. 원본 이미지 크기와 좌표를 확인해주세요.');result[key]=n}for(const [a,b] of [['x1','x2'],['y1','y2'],['p1','p2'],['p3','p4']])if(result[a]>result[b])throw Error('영역 시작 좌표가 끝 좌표보다 큽니다.');return result}
function pack(width,height,values){return JSON.stringify({format:'ktalk-nine-patch-v1',width,height,coordinates:validate(values,width,height)},null,2)}
function unpack(text,width,height){let data;try{data=JSON.parse(text)}catch{throw Error('복사한 나인패치 좌표를 찾을 수 없습니다. 먼저 좌표 전체 복사를 눌러주세요.')}if(data?.format!=='ktalk-nine-patch-v1')throw Error('나인패치 좌표 형식이 아닙니다.');validate(data.coordinates,data.width,data.height);return validate(data.coordinates,width??data.width,height??data.height)}
return {pack,unpack};
});

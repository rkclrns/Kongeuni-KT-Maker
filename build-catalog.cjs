const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'android-template/src/main/theme');
const labels=['상단 제목·아이콘','섹션 제목','목록 이름','목록 이름 · 누름','마지막 메시지','마지막 메시지 · 누름','친구 상태 메시지','친구 상태 메시지 · 누름','서비스 아이콘·글자','서비스 아이콘·글자 · 누름','둘러보기 탭 · 기본','둘러보기 탭 · 선택','메인 화면 배경','채팅방 배경','암호 화면 배경','상단 헤더 배경','목록 셀 배경','목록 셀 배경 · 누름','목록 구분선','보조 콘텐츠 배경','하단 탭 배경','탭 배너 배지 · 구버전','탭 배너 배지','공유 안내 글자','공유 이동 버튼 글자','공유 안내 배경','알림 글자','알림 배경','알림 배경 · 누름','암호 안내 글자','숫자 키 글자','숫자 키 글자 · 누름','숫자 키 영역 배경','숫자 키 배경 · 누름','패턴 잠금 연결선','보낸 말풍선 글자','받은 말풍선 글자','안 읽은 사람 수','입력창 글자','입력창 배경','입력창 메뉴 아이콘','입력창 메뉴 버튼 배경','전송 화살표','전송 버튼 배경'];
const colors=[...fs.readFileSync(path.join(root,'values/colors.xml'),'utf8').matchAll(/<color name="([^"]+)">([^<]+)<\/color>/g)].map((m,i)=>({key:m[1],value:m[2],label:labels[i]}));
if(colors.length!==labels.length)throw Error('Color labels mismatch');
const images={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.png')&&!images[e.name])images[e.name]='data:image/png;base64,'+fs.readFileSync(p).toString('base64')}}walk(root);
// Prefer phone xxhdpi over tablet/other density variants for previews.
for(const e of fs.readdirSync(path.join(root,'drawable-xxhdpi'))){if(e.endsWith('.png'))images[e]='data:image/png;base64,'+fs.readFileSync(path.join(root,'drawable-xxhdpi',e)).toString('base64')}
fs.writeFileSync(path.join(__dirname,'resource-catalog.js'),'window.resourceCatalog='+JSON.stringify({colors,images})+';');

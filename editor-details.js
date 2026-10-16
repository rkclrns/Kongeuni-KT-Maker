(() => {
const E=window.themeEditor,C=window.resourceCatalog;
const cssColor=v=>v.length===9?'#'+v.slice(3)+v.slice(1,3):v;
E.applyColors=()=>C.colors.forEach(c=>document.documentElement.style.setProperty('--'+c.key,cssColor(E.state.colors[c.key]||c.value)));
E.imageLabel=n=>{const tabs={friends:'친구',chats:'채팅',now:'지금',shopping:'쇼핑',more:'더보기',call:'통화',piccoma:'픽코마'};if(n.includes('maintab_ico'))return '하단 '+(tabs[n.split('_')[3]]||n.split('_')[3])+' 탭 · '+(n.includes('focused')?'선택':'기본');if(n.includes('maintab_cell'))return '하단 탭 전체 뒷배경 · 9패치';if(n.includes('bubble'))return (n.includes('_me_')?'보낸':'받은')+' 말풍선 · '+(n.includes('_01_')?'첫 메시지':'연속 메시지')+' · 9패치';if(/passcode_0/.test(n))return '암호 표시 '+n.match(/passcode_0(\d)/)[1]+' · '+(n.includes('checked')?'입력됨':'비어 있음');if(n.includes('add'))return '친구 추가 버튼 · '+(n.includes('pressed')?'누름':'기본');if(n.includes('profile'))return '기본 프로필 이미지';if(n.includes('splash'))return '시작 화면 이미지';if(n.includes('chatroom_background'))return '채팅방 배경 이미지';if(n.includes('passcode_background'))return '잠금화면 배경 이미지';if(n.includes('background'))return '메인 화면 배경 이미지';return '추가 리소스 · '+n};
function show(title,keys=[],images=[]){E.select(title,images);keys.forEach(k=>E.colorEditor(k));const hint=document.createElement('p');hint.className='hint';hint.textContent='색상: #RRGGBB / #AARRGGBB (앞 2자리 투명도). 배경 이미지는 배경색 위에 표시됩니다. 누름 색상은 마우스를 누르고 있을 때 표시됩니다.';E.panel.append(hint)}
const allKeys=C.colors.map(c=>c.key),group=part=>allKeys.filter(k=>k.includes(part));
const toolbar=document.createElement('div');toolbar.className='catalog-toolbar';toolbar.innerHTML='<button>전체 색상 (44)</button><button>전체 이미지</button>';document.querySelector('.inspector').prepend(toolbar);
toolbar.children[0].onclick=()=>show('공식 템플릿 전체 색상',allKeys);
toolbar.children[1].onclick=()=>show('공식 템플릿 전체 이미지',[],Object.keys(C.images));
const originalSelect=E.select; // Keep catalog controls available even when legacy selections hide siblings.
new MutationObserver(()=>{toolbar.style.display='flex'}).observe(E.panel,{childList:true});
function bind(selector,title,keys,images=[]){document.querySelectorAll(selector).forEach(el=>el.addEventListener('click',e=>{if(el.matches('.person,.chat-item')&&e.target.tagName==='IMG')return;e.stopPropagation();show(title,keys,typeof images==='function'?images(el):images)}))}
bind('.main-bg','메인 배경',['theme_background_color','theme_header_cell_color'],['theme_background_image.png']);
bind('.chat-bg','채팅방 배경',['theme_chatroom_background_color'],['theme_chatroom_background_image.png']);
bind('.passcode-bg','잠금 배경',['theme_passcode_background_color'],['theme_passcode_background_image.png']);
bind('.header,.chat-header','상단 제목·아이콘',['theme_header_color','theme_header_cell_color']);
bind('.person,.chat-item','목록 셀 · 기본 / 누름',[...group('theme_title_'),...group('theme_paragraph_'),...group('theme_description_'),...group('theme_body_cell_')]);
bind('.section-title','섹션 제목',['theme_section_title_color']);
bind('.notice-card','알림 · 기본 / 누름',group('theme_notification_'));
bind('.sharebar','공유 안내',group('theme_direct_share_'));
bind('.chips','상단 선택 탭·배지',[...group('theme_feature_browse_'),...group('bannerbadge')]);
bind('.banner','보조 콘텐츠',['theme_body_secondary_cell_color','theme_title_color','theme_description_color']);
bind('.keypad button','암호 숫자 키 · 기본 / 누름',group('theme_passcode_keypad_'));
bind('.passcode-content>h2,.passcode-content>small','암호 안내',['theme_passcode_color','theme_passcode_pattern_line_color']);
const svg=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const servicePaths=[
'M3 8h18v5H3z M5 13v8h14v-8 M12 8v13 M12 8C2 8 5 0 9 4z M12 8c10 0 7-8 3-4z',
'M12 21S1 14 2 7C3 1 9 2 12 6c3-4 9-5 10 1 1 7-10 14-10 14z M12 7v13 M4 11h16',
'M5 20L19 4 M8 6a3 3 0 1 0-6 0 3 3 0 0 0 6 0 M22 18a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
'M22 11a10 9 0 1 0-15 8l-2 4 7-3a10 9 0 0 0 10-9 M8 9h.1 M16 9h.1 M8 13q4 5 8 0',
'M3 4h18v14H9l-5 4v-4H3z M6 8v6h3 M12 8v6 M15 8l2 6 2-6',
'M9 3h6v4l5 13H4L9 7z M9 7h6',
'M12 2l10 6v8l-10 6-10-6V8z M7 16V8l5 5 5-5v8',
'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M7 15l3-5 4 3 4-6',
'M2 5h20v15H2z M9 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0 M4 17q3-5 6 0 M13 10h6 M13 14h6',
'M3 5h18v17H3z M7 2v6 M17 2v6 M3 10h18 M8 15l3 3 5-6',
'M7 5h10q4 0 5 14l-4 1-4-4h-4l-4 4-4-1Q3 5 7 5z M7 9v6 M4 12h6 M16 10h.1 M19 13h.1',
'M3 5h18v17H3z M7 2v6 M17 2v6 M7 14h10 M13 10l4 4-4 4'];
document.querySelectorAll('.service-grid>div').forEach((el,i)=>{el.insertAdjacentHTML('afterbegin',svg(servicePaths[i]));el.tabIndex=0;el.setAttribute('role','button')});
bind('.service-grid','더보기 서비스 · 앱 고정 아이콘',group('theme_feature_primary_'));
const input=document.querySelector('.inputbar');input.innerHTML=`<button class="input-menu" aria-label="첨부 메뉴">${svg('M12 5v14 M5 12h14')}</button><input aria-label="메시지 미리보기" value="카카오톡 테마"><button class="input-smile" aria-label="이모티콘">${svg('M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0 M8 9h.1 M16 9h.1 M7 14q5 6 10 0')}</button><button class="input-send" aria-label="전송">${svg('M4 3l17 9-17 9 4-9z M8 12h13')}</button>`;
const chatButtons=document.querySelectorAll('.chat-header .header-icon');chatButtons[1].innerHTML=svg('M5 3l4 4-2 3q2 5 7 7l3-2 4 4-3 3C9 22 2 15 2 6z');chatButtons[1].ariaLabel='통화';chatButtons[2].innerHTML=svg('M3 5h18 M3 12h18 M3 19h18');chatButtons[2].ariaLabel='메뉴';
document.querySelectorAll('#more .header-icon')[1].innerHTML=svg('M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6 M7 7h3v3H7z M14 7h3v3h-3z M7 14h3v3H7z M14 14h3v3h-3z');
bind('.inputbar','채팅 입력창 · 6개 색상',group('theme_chatroom_input_bar_'));
// The official tab-cell image is a stretchable 9-patch, not a flat white bar.
E.refreshTabs=async()=>{const source=new Image();source.src=E.url('theme_maintab_cell_image.9.png');await source.decode();const c=document.createElement('canvas');c.width=source.width-2;c.height=source.height-2;const ctx=c.getContext('2d');ctx.drawImage(source,1,1,c.width,c.height,0,0,c.width,c.height);document.querySelectorAll('.tabbar').forEach(bar=>{bar.style.backgroundImage=`url("${c.toDataURL()}")`;bar.style.backgroundSize='100% 100%'})};
bind('.tabbar','하단 탭 배경',['theme_maintab_cell_color'],['theme_maintab_cell_image.9.png']);
// Capture icon selection before the bar background handler, preserving selected-state behavior.
document.querySelectorAll('.tabbar img').forEach(img=>img.addEventListener('click',e=>{e.stopPropagation();E.colorEditor('theme_maintab_cell_color');E.imageEditor('theme_maintab_cell_image.9.png')}));
document.querySelectorAll('.nav[data-screen]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.screen;const keys=id==='chatroom'?['theme_chatroom_background_color']:id==='passcode'?['theme_passcode_background_color']:id==='splash'?[]:['theme_background_color','theme_header_cell_color'];keys.forEach(E.colorEditor)}));
E.applyColors();E.refreshTabs().catch(console.error);show('메인 화면 배경',['theme_background_color','theme_header_cell_color'],['theme_background_image.png']);
})();

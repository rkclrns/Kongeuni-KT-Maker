const profile = 'assets/theme_profile_01_image.png';
const tabs = ['friends','chats','now','shopping','more'];
const people = ['업데이트한 친구','추천친구','채널','라이언','춘식이'];
const chats = [['어피치','오늘의 한마디루','2'],['춘식이','메시지 내용','8'],['탄천 러닝함께해요 34','러닝이 최고죠','10'],['뭔가 독서 모임 3','오늘 모임도 즐거웠어요',''],['동네 친구들 13','사진 고마워','']];

document.querySelector('#friend-list').innerHTML = people.map((name,i)=>`<div class="person"><img data-slot="profile" src="${profile}"><div><b>${name}</b><small>${i?'새로운 친구를 만나보세요!':'새 소식이 있어요'}</small></div></div>`).join('');
document.querySelector('#chat-list').innerHTML = chats.map(([name,msg,badge])=>`<div class="chat-item"><img data-slot="profile" src="${profile}"><div><b>${name}</b><small>${msg}</small></div>${badge?`<span class="badge">${badge}</span>`:'<time>어제</time>'}</div>`).join('');

function makeTabs(selected){return tabs.map(name=>`<img src="assets/theme_maintab_ico_${name}${name===selected?'_focused':''}_image.png">`).join('')}
document.querySelector('#friends-tabs').innerHTML=makeTabs('friends');
document.querySelector('#chats-tabs').innerHTML=makeTabs('chats');
document.querySelector('#now-tabs').innerHTML=makeTabs('now');
document.querySelector('#more-tabs').innerHTML=makeTabs('more');
document.querySelector('#now-list').innerHTML = chats.slice(0,4).map(([name,msg],i)=>`<div class="chat-item"><img data-slot="profile" src="${profile}"><div><b>${['지금 뜨는 커뮤니티','해외 여행 사진방','수도권 날씨 실시간 대화방','설레는 라이언'][i]}</b><small>${msg}</small></div><time>${i+1}분 전</time></div>`).join('');
document.querySelector('.service-grid').innerHTML=['선물하기','받은선물','톡딜','이모티콘','라이브쇼핑','브랜드톡','메이커스','펀드','모바일신분증','캘린더','게임','예약하기'].map(x=>`<div>${x}</div>`).join('');
document.querySelector('#pass-bullets').innerHTML=[1,2,3,4].map((n,i)=>`<img src="assets/theme_passcode_0${n}${i<2?'_checked':''}_image.png">`).join('');
document.querySelector('.keypad').innerHTML=['1','2','3','4','5','6','7','8','9','','0','⌫'].map(x=>`<span>${x}</span>`).join('');

const known = ['friends','chats','chatroom','notification','now','more','passcode','splash'];
let currentScreen='friends';
document.querySelectorAll('.nav[data-screen]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active')); button.classList.add('active');
  document.querySelectorAll('.screen').forEach(x=>x.classList.add('hidden'));
  const id=button.dataset.screen;
  currentScreen=id;
  if(known.includes(id)) document.querySelector('#'+id).classList.remove('hidden');
  document.querySelector('#panel-title').textContent=button.textContent+' 배경';
  const asset = id==='passcode'?'theme_passcode_background_image.png':id==='splash'?'theme_splash_image.png':id==='chatroom'||id==='notification'?'theme_chatroom_background_image.png':'theme_background_image.png';
  document.querySelector('#screen-asset-name').textContent=asset;
  document.querySelector('#replace-screen-bg img').src='assets/'+asset;
}));

document.querySelector('#main-color').addEventListener('input',e=>{
  document.documentElement.style.setProperty('--theme',e.target.value);
  e.target.closest('label').querySelector('code').textContent=e.target.value.toUpperCase();
});

document.querySelector('#replace-bg').addEventListener('click',async()=>{
  const url=await window.studio.pickImage(); if(!url)return;
  document.querySelectorAll('[data-slot="main-bg"]').forEach(x=>x.src=url);
  document.querySelector('#replace-bg img').src=url;
});
document.querySelector('#replace-profile').addEventListener('click',async()=>{
  const url=await window.studio.pickImage(); if(!url)return;
  document.querySelectorAll('[data-slot="profile"]').forEach(x=>x.src=url);
  document.querySelector('#replace-profile img').src=url;
});
document.querySelector('#replace-screen-bg').addEventListener('click',async()=>{
  const url=await window.studio.pickImage(); if(!url)return;
  const slot=currentScreen==='passcode'?'passcode-bg':currentScreen==='splash'?'splash-bg':currentScreen==='chatroom'||currentScreen==='notification'?'chat-bg':'main-bg';
  document.querySelectorAll(`[data-slot="${slot}"]`).forEach(x=>x.src=url);
  document.querySelector('#replace-screen-bg img').src=url;
});

// Android (Galaxy APK) and iPhone (.ktheme) are separate tabs: each shows only its own build button.
const platforms={
  android:{version:'Android 26.1.0',badge:'Android',note:'바꾸고 싶은 화면 요소를 클릭하세요'},
  ios:{version:'iOS · .ktheme',badge:'iPhone',note:'같은 편집 내용을 아이폰용 .ktheme 파일로 변환합니다 · 일부 안드로이드 전용 항목은 반영되지 않을 수 있어요'}
};
let currentPlatform='android';
function setPlatform(name){
  if(!platforms[name])name='android';
  currentPlatform=name;
  const info=platforms[name];
  document.querySelectorAll('.platform-tab').forEach(tab=>{const on=tab.dataset.platform===name;tab.classList.toggle('active',on);tab.setAttribute('aria-selected',String(on));});
  document.querySelector('#android-shell').hidden=name!=='android';
  document.querySelector('#ios-shell').hidden=name!=='ios';
  document.querySelector('#build-apk').hidden=name!=='android';
  document.querySelector('#build-ktheme').hidden=name!=='ios';
  document.querySelector('#platform-version').textContent=info.version;
  document.querySelector('#platform-note').textContent=info.note;
  document.body.dataset.platform=name;
  if(name==='ios')window.iosEditor?.activate();
}
document.querySelectorAll('.platform-tab').forEach(tab=>tab.addEventListener('click',()=>setPlatform(tab.dataset.platform)));

function projectData(){
  const slots={};
  ['main-bg','chat-bg','passcode-bg','splash-bg','profile'].forEach(slot=>{
    const image=document.querySelector(`[data-slot="${slot}"]`); if(image)slots[slot]=image.src;
  });
  return {schema:'ktalk-theme-studio',version:1,platform:currentPlatform,color:document.querySelector('#main-color').value.toUpperCase(),slots,editor:window.themeEditor?JSON.parse(JSON.stringify(window.themeEditor.state)):undefined,ios:window.iosEditor?.exportState()??null};
}
function applyProject(data){
  if(!data||data.schema!=='ktalk-theme-studio')return alert('지원하지 않는 프로젝트 파일입니다.');
  if(data.color){document.querySelector('#main-color').value=data.color;document.documentElement.style.setProperty('--theme',data.color);document.querySelector('.color-row code').textContent=data.color;}
  Object.entries(data.slots||{}).forEach(([slot,url])=>document.querySelectorAll(`[data-slot="${slot}"]`).forEach(x=>x.src=url));
  if(data.editor)window.themeEditor.restore(data.editor);
  window.iosEditor?.restore(data.ios??null);
  setPlatform(data.platform||'android');
}
document.querySelector('#save-project').addEventListener('click',async()=>{if(await window.studio.saveProject(projectData()))alert('프로젝트를 저장했습니다.');});
document.querySelector('#open-project').addEventListener('click',async()=>{const data=await window.studio.openProject();if(data)applyProject(data);});
document.querySelector('#build-apk').addEventListener('click',async()=>{
  const button=document.querySelector('#build-apk');
  if(button.disabled)return;
  button.disabled=true;
  button.textContent='APK 만드는 중…';
  button.setAttribute('aria-busy','true');
  let result, failure;
  try {
    result=await window.studio.buildApk(projectData());
  } catch(error) {
    failure=error;
  } finally {
    // Restore the editor before a modal alert blocks renderer execution.
    button.disabled=false;
    button.textContent='APK 만들기';
    button.removeAttribute('aria-busy');
  }
  if(failure)alert(`APK 빌드 실패\n\n${failure.message}`);
  else if(result&&!result.canceled)alert(`APK를 만들었습니다.\n${result.path}`);
});

document.querySelector('#build-ktheme').addEventListener('click',async()=>{
  const button=document.querySelector('#build-ktheme');
  if(button.disabled)return;
  button.disabled=true;
  button.textContent='아이폰 테마 만드는 중…';
  button.setAttribute('aria-busy','true');
  let result, failure;
  try {
    result=await window.studio.buildKtheme(projectData());
  } catch(error) {
    failure=error;
  } finally {
    button.disabled=false;
    button.textContent='아이폰 테마(.ktheme) 만들기';
    button.removeAttribute('aria-busy');
  }
  if(failure)alert(`iOS 테마 만들기 실패\n\n${String(failure.message).replace(/^Error invoking remote method '[^']+': (Error: )?/,'')}`);
  else if(result&&!result.canceled)alert(`iOS 테마(.ktheme)를 만들었습니다.\n${result.path}${result.warnings?.length?'\n\n참고: '+result.warnings.join('\n'):''}\n\n아이폰에서 파일 앱이나 메일로 .ktheme 파일을 열고 카카오톡으로 공유하면 적용할 수 있습니다.`);
});

const profile = 'assets/theme_profile_01_image.png';
const tabs = ['friends','chats','now','shopping','more'];
const people = ['������Ʈ�� ģ��','��õģ��','ä��','���̾�','�����'];
const chats = [['����ġ','������ �Ѹ����','2'],['�����','�޽��� ����','8'],['źõ �����Բ��ؿ� 34','������ �ְ���','10'],['���� ���� ���� 3','���� ���ӵ� ��ſ����',''],['���� ģ���� 13','���� ������','']];

document.querySelector('#friend-list').innerHTML = people.map((name,i)=>`<div class="person"><img data-slot="profile" src="${profile}"><div><b>${name}</b><small>${i?'���ο� ģ���� ����������!':'�� �ҽ��� �־��'}</small></div></div>`).join('');
document.querySelector('#chat-list').innerHTML = chats.map(([name,msg,badge])=>`<div class="chat-item"><img data-slot="profile" src="${profile}"><div><b>${name}</b><small>${msg}</small></div>${badge?`<span class="badge">${badge}</span>`:'<time>����</time>'}</div>`).join('');

function makeTabs(selected){return tabs.map(name=>`<img src="assets/theme_maintab_ico_${name}${name===selected?'_focused':''}_image.png">`).join('')}
document.querySelector('#friends-tabs').innerHTML=makeTabs('friends');
document.querySelector('#chats-tabs').innerHTML=makeTabs('chats');
document.querySelector('#now-tabs').innerHTML=makeTabs('now');
document.querySelector('#more-tabs').innerHTML=makeTabs('more');
document.querySelector('#now-list').innerHTML = chats.slice(0,4).map(([name,msg],i)=>`<div class="chat-item"><img data-slot="profile" src="${profile}"><div><b>${['���� �ߴ� Ŀ�´�Ƽ','�ؿ� ���� ������','������ ���� �ǽð� ��ȭ��','������ ���̾�'][i]}</b><small>${msg}</small></div><time>${i+1}�� ��</time></div>`).join('');
document.querySelector('.service-grid').innerHTML=['�����ϱ�','��������','���','�̸�Ƽ��','���̺����','�귣����','����Ŀ��','�ݵ�','����Ͻź���','Ķ����','����','�����ϱ�'].map(x=>`<div>${x}</div>`).join('');
document.querySelector('#pass-bullets').innerHTML=[1,2,3,4].map((n,i)=>`<img src="assets/theme_passcode_0${n}${i<2?'_checked':''}_image.png">`).join('');
document.querySelector('.keypad').innerHTML=['1','2','3','4','5','6','7','8','9','','0','?'].map(x=>`<span>${x}</span>`).join('');

const known = ['friends','chats','chatroom','notification','now','more','passcode','splash'];
let currentScreen='friends';
document.querySelectorAll('.nav[data-screen]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active')); button.classList.add('active');
  document.querySelectorAll('.screen').forEach(x=>x.classList.add('hidden'));
  const id=button.dataset.screen;
  currentScreen=id;
  if(known.includes(id)) document.querySelector('#'+id).classList.remove('hidden');
  document.querySelector('#panel-title').textContent=button.textContent+' ���';
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

function projectData(){
  const slots={};
  ['main-bg','chat-bg','passcode-bg','splash-bg','profile'].forEach(slot=>{
    const image=document.querySelector(`[data-slot="${slot}"]`); if(image)slots[slot]=image.src;
  });
  return {schema:'ktalk-theme-studio',version:1,color:document.querySelector('#main-color').value.toUpperCase(),slots,editor:window.themeEditor?JSON.parse(JSON.stringify(window.themeEditor.state)):undefined};
}
function applyProject(data){
  if(!data||data.schema!=='ktalk-theme-studio')return alert('�������� �ʴ� ������Ʈ �����Դϴ�.');
  if(data.color){document.querySelector('#main-color').value=data.color;document.documentElement.style.setProperty('--theme',data.color);document.querySelector('.color-row code').textContent=data.color;}
  Object.entries(data.slots||{}).forEach(([slot,url])=>document.querySelectorAll(`[data-slot="${slot}"]`).forEach(x=>x.src=url));
  if(data.editor)window.themeEditor.restore(data.editor);
}
document.querySelector('#save-project').addEventListener('click',async()=>{if(await window.studio.saveProject(projectData()))alert('������Ʈ�� �����߽��ϴ�.');});
document.querySelector('#open-project').addEventListener('click',async()=>{const data=await window.studio.openProject();if(data)applyProject(data);});
document.querySelector('#build-apk').addEventListener('click',async()=>{
  const button=document.querySelector('#build-apk');
  if(button.disabled)return;
  button.disabled=true;
  button.textContent='APK ����� �ߡ�';
  button.setAttribute('aria-busy','true');
  let result, failure;
  try {
    result=await window.studio.buildApk(projectData());
  } catch(error) {
    failure=error;
  } finally {
    // Restore the editor before a modal alert blocks renderer execution.
    button.disabled=false;
    button.textContent='APK �����';
    button.removeAttribute('aria-busy');
  }
  if(failure)alert(`APK ���� ����\n\n${failure.message}`);
  else if(result&&!result.canceled)alert(`APK�� ��������ϴ�.\n${result.path}`);
});

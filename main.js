const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { fileURLToPath } = require('url');

if (process.env.KTALK_TEST_DATA) app.setPath('userData', process.env.KTALK_TEST_DATA);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#eef2f7',
    title: 'Kongeuni KT Maker',
    icon: path.join(__dirname,'assets','app-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('render-process-gone', (_e, details) => {
    fs.appendFileSync(path.join(app.getPath('userData'), 'errors.log'), JSON.stringify(details)+'\n');
  });
  if (process.env.KTALK_CAPTURE) {
    win.webContents.once('did-finish-load', async () => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const image = await win.webContents.capturePage();
      fs.writeFileSync(process.env.KTALK_CAPTURE, image.toPNG());
      app.quit();
    });
  }
}

ipcMain.handle('pick-image', async (_event, resourceName, previousImage) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PNG 이미지', extensions: ['png'] }]
  });
  if(result.canceled)return null;
  let buffer=fs.readFileSync(result.filePaths[0]);
  if(typeof resourceName==='string'&&resourceName.endsWith('.9.png')){
    const nine=require('./nine-patch.cjs');
    buffer=typeof previousImage==='string'&&previousImage.startsWith('data:image/png;base64,')
      ?nine.preserveMarkers(buffer,Buffer.from(previousImage.split(',')[1],'base64'))
      :nine.normalize(buffer).buffer;
  }
  return 'data:image/png;base64,'+buffer.toString('base64');
});

ipcMain.handle('copy-nine-coordinates',(_event,text)=>{
  require('./nine-coordinates.js').unpack(text);
  require('electron').clipboard.writeText(text);
});
ipcMain.handle('paste-nine-coordinates',()=>require('electron').clipboard.readText());

ipcMain.handle('save-project', async (_event, data) => {
  const result = await dialog.showSaveDialog({ defaultPath: '카카오톡테마.ktstudio', filters: [{ name: 'KTalk Studio 프로젝트', extensions: ['ktstudio'] }] });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
  return true;
});

ipcMain.handle('open-project', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'KTalk Studio 프로젝트', extensions: ['ktstudio'] }] });
  if (result.canceled) return null;
  return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
});

function copyProject(source, destination) {
  fs.cpSync(source, destination, { recursive: true, filter: p => !['.gradle', '.idea', 'build'].includes(path.basename(p)) });
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options); let output = '';
    child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(output) : reject(new Error(output || `빌드 종료 코드 ${code}`)));
  });
}

function findFile(root, suffix) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) { const found = findFile(full, suffix); if (found) return found; }
    else if (entry.name.endsWith(suffix)) return full;
  }
  return null;
}

ipcMain.handle('build-apk', async (_event, data) => {
  const backupDir=path.join(app.getPath('userData'),'project-backups');
  fs.mkdirSync(backupDir,{recursive:true});
  const backupPath=path.join(backupDir,`before-build-${Date.now()}.ktstudio`);
  fs.writeFileSync(backupPath,JSON.stringify(data,null,2),'utf8');
  const result = await dialog.showSaveDialog({ defaultPath: '카카오톡테마.apk', filters: [{ name: 'Android APK', extensions: ['apk'] }] });
  if (result.canceled || !result.filePath) return { canceled: true };
  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktalk-theme-'));
  copyProject(path.join(__dirname, 'android-template'), buildDir);
  require('./theme-info.cjs').applyInfo(buildDir, data.editor?.info);
  require('./theme-icon.cjs').applyIcon(buildDir, data.editor?.info?.icon, require('electron').nativeImage);
  const colorsPath = path.join(buildDir, 'src', 'main', 'theme', 'values', 'colors.xml');
  let colors = fs.readFileSync(colorsPath, 'utf8');
  colors = colors.replace(/(<color name="theme_background_color">)([^<]+)(<\/color>)/, `$1${data.color}$3`);
  fs.writeFileSync(colorsPath, colors, 'utf8');
  if (data.editor?.colors) {
    colors = colors.replace(/(<color name="([^"]+)">)([^<]+)(<\/color>)/g, (match,open,key,value,close) => /^#[\da-f]{6}([\da-f]{2})?$/i.test(data.editor.colors[key] || '') ? open+data.editor.colors[key]+close : match);
    fs.writeFileSync(colorsPath, colors, 'utf8');
  }
  if (data.editor?.images) {
    const root = path.join(buildDir,'src','main','theme');
    const walk = dir => { for(const e of fs.readdirSync(dir,{withFileTypes:true})) { const f=path.join(dir,e.name); if(e.isDirectory())walk(f); else if(/^data:image\/png;base64,/.test(data.editor.images[e.name]||''))fs.writeFileSync(f,Buffer.from(data.editor.images[e.name].split(',')[1],'base64')); } };
    walk(root);
  }
  const slotFiles = { 'main-bg':'theme_background_image.png', 'chat-bg':'theme_chatroom_background_image.png', 'passcode-bg':'theme_passcode_background_image.png', 'splash-bg':'theme_splash_image.png', profile:'theme_profile_01_image.png' };
  for (const [slot, url] of Object.entries(data.slots || {})) {
    if (data.editor?.images?.[slotFiles[slot]]) continue;
    if (!slotFiles[slot] || typeof url !== 'string' || !url.startsWith('file:')) continue;
    const source = fileURLToPath(url); if (!fs.existsSync(source)) continue;
    const targets = [];
    const walk = dir => { for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const f=path.join(dir,e.name); if(e.isDirectory())walk(f); else if(e.name===slotFiles[slot])targets.push(f); } };
    walk(path.join(buildDir,'src','main'));
    for (const target of targets) fs.copyFileSync(source,target);
  }
  require('./profile-resources.cjs').applyProfiles(buildDir,data.editor);
  require('./nine-patch.cjs').normalizeTree(path.join(buildDir,'src','main','theme'));
  const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  fs.writeFileSync(path.join(buildDir, 'local.properties'), `sdk.dir=${sdk.replaceAll('\\','/')}\n`, 'utf8');
  const javaHome = require('./java-runtime.cjs').selectJava();
  const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, GRADLE_USER_HOME: path.join(app.getPath('userData'), 'gradle') };
  try {
    await run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug --no-daemon --stacktrace'], { cwd: buildDir, env, windowsHide: true });
  } catch(error) {
    const logPath=path.join(backupDir,`build-error-${Date.now()}.log`);
    fs.writeFileSync(logPath,`JAVA_HOME=${javaHome}\n${error.message}`,'utf8');
    const lines=error.message.split(/\r?\n/);
    const index=lines.findIndex(l=>/\* What went wrong:/.test(l));
    const resourceErrors=lines.filter(l=>/error:|failed to compile|e: file:/i.test(l)).slice(0,12);
    const summary=resourceErrors.length?resourceErrors.join('\n'):index>=0?lines.slice(index,index+14).join('\n'):lines.slice(-18).join('\n');
    throw new Error(`작업 내용은 자동 백업되었습니다.\n${backupPath}\n\n빌드 오류 기록:\n${logPath}\n\n${summary}`);
  }
  const apk = findFile(path.join(buildDir, 'build', 'outputs', 'apk'), '.apk');
  if (!apk) throw new Error('빌드 결과 APK를 찾지 못했습니다.');
  fs.copyFileSync(apk, result.filePath);
  return { path: result.filePath };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

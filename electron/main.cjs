const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'براكه - كاشير ومحاسبة',
    icon: path.join(__dirname, 'icon.png'),
    frame: false, // Seamless frameless window (no white Windows titlebar)
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Window control IPC events from custom titlebar
  ipcMain.on('window-minimize', event => {
    if (trustedSender(event)) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', event => {
    if (!trustedSender(event)) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', event => {
    if (trustedSender(event)) mainWindow.close();
  });

  ipcMain.handle('window-is-maximized', event => {
    return trustedSender(event) ? mainWindow.isMaximized() : false;
  });

  // Keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
    if (input.key === 'F5' && input.type === 'keyDown') {
      mainWindow.reload();
      event.preventDefault();
    }
  });

  // Secure external link navigation: Open in user's default external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^(https?:|mailto:|tel:)/.test(url)) void shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// In-App Desktop Auto-Update Engine (Direct Download & Install)
// -------------------------------------------------------------
const fs = require('node:fs');
const https = require('node:https');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { validateDownloadUrl, verifyManifest, verifyFile } = require('./update-security.cjs');
const { launchInstallerAfterAppExit } = require('./update-installer.cjs');
let activeAbort = null;
let verifiedUpdate = null;
function trustedSender(event) {
  return mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame;
}
function download(url, signal, redirects = 0) {
  validateDownloadUrl(url, redirects > 0);
  if (redirects > 5) throw new Error('Too many redirects');
  return new Promise((resolve,reject) => {
    const req=https.get(url,{signal,timeout:30000},res=>{
      if ([301,302,303,307,308].includes(res.statusCode)) {
        res.resume();
        try { resolve(download(new URL(res.headers.location,url).href,signal,redirects+1)); } catch(error) { reject(error); }
      } else if(res.statusCode===200) resolve(res);
      else { res.resume();reject(new Error('Update download failed')); }
    });
    req.on('timeout',()=>req.destroy(new Error('Update download timed out')));
    req.on('error',reject);
  });
}
ipcMain.handle('download-update', async (event) => {
  if (!trustedSender(event) || activeAbort) return {success:false,error:'Update request denied'};
  let partial;
  try {
    activeAbort = new AbortController();
    const response = await fetch('https://khodar-pos.pages.dev/api/releases/latest?platform=windows&current='+app.getVersion(), {signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok) throw new Error('Release service unavailable');
    const text = await response.text();
    if(text.length>65536) throw new Error('Manifest too large');
    const data=JSON.parse(text);
    // The pinned public key is supplied by the release owner. Missing key fails closed.
    const publicKey=await fs.promises.readFile(path.join(__dirname,'release-public-key.pem'),'utf8');
    const manifest=verifyManifest(data.signedManifest,publicKey,app.getVersion());
    const dir=await fs.promises.mkdtemp(path.join(app.getPath('temp'),'braka-update-'));
    partial=path.join(dir,'installer.partial');
    const stream=await download(manifest.url,activeAbort.signal);
    let count=0;
    const meter=new Transform({transform(chunk,encoding,callback){
      count+=chunk.length;
      if(count>manifest.size) return callback(new Error('Update exceeds signed size'));
      if(mainWindow) mainWindow.webContents.send('download-progress',{receivedBytes:count,totalBytes:manifest.size,percent:Math.floor(count*100/manifest.size)});
      callback(null,chunk);
    }});
    await pipeline(stream,meter,fs.createWriteStream(partial,{flags:'wx'}),{signal:activeAbort.signal});
    await verifyFile(partial,manifest);
    const installer=path.join(dir,'KhodarPOS-Setup.exe');
    await fs.promises.rename(partial,installer);
    verifiedUpdate={installer,manifest};
    return {success:true,filePath:installer};
  } catch(error) {
    if(partial) await fs.promises.unlink(partial).catch(()=>{});
    return {success:false,error:error.message};
  } finally {activeAbort=null;}
});
ipcMain.on('cancel-download-update',event=>{
  if(trustedSender(event)) activeAbort?.abort();
});
ipcMain.handle('install-update', async event=>{
  if(!trustedSender(event) || !verifiedUpdate) return {success:false,error:'No verified update'};
  try {
    await verifyFile(verifiedUpdate.installer,verifiedUpdate.manifest);
    // Wait outside this process so NSIS cannot race our graceful Electron shutdown.
    await launchInstallerAfterAppExit(verifiedUpdate.installer, process.pid, {
      helperPath: path.join(process.resourcesPath, 'Braka.UpdateHelper.exe'),
      expectedHash: verifiedUpdate.manifest.sha256,
      journalDirectory: path.join(app.getPath('userData'), 'update-logs'),
    });
    return {success:true};
  } catch(error) {return {success:false,error:error.message};}
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

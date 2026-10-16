const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  pickImage: async (resourceName, previousImage) => {
    const file = await ipcRenderer.invoke('pick-image', resourceName, previousImage);
    return file;
  },
  saveProject: data => ipcRenderer.invoke('save-project', data),
  openProject: () => ipcRenderer.invoke('open-project'),
  buildApk: data => ipcRenderer.invoke('build-apk', data),
  copyNineCoordinates: text => ipcRenderer.invoke('copy-nine-coordinates', text),
  pasteNineCoordinates: () => ipcRenderer.invoke('paste-nine-coordinates')
});

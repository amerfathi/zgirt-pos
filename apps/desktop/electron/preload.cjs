const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zgirtDesktop', {
  platform: 'windows',
  version: '1.0.0',
  printReceipt: (receiptData) => ipcRenderer.invoke('print-receipt', receiptData)
});

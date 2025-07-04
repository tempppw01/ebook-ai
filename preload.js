const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // For text selection context menu
  showContextMenu: (selectedText) => ipcRenderer.send('show-context-menu', selectedText),
  onSummarizeWithAI: (callback) => ipcRenderer.on('summarize-with-ai', (event, ...args) => callback(...args)),

  // For book item context menu
  showBookContextMenu: (bookId) => ipcRenderer.send('show-book-context-menu', bookId),
  onDeleteBook: (callback) => ipcRenderer.on('delete-book', (event, ...args) => callback(...args))
});

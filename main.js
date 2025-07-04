const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

let mainWindow; // Declare mainWindow in a broader scope

function createWindow () {
  // 创建浏览器窗口。
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // We need a preload script for context menu
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // 加载 index.html
  mainWindow.loadFile('index.html');

  // 打开开发者工具（可选）
  // mainWindow.webContents.openDevTools();
}

// 创建中文菜单模板
const template = [
  {
    label: '文件',
    submenu: [
      { label: '导入书籍', click: () => { /* TODO: Trigger import action in renderer */ } },
      { type: 'separator' },
      { label: '退出', role: 'quit' }
    ]
  },
  {
    label: '编辑',
    submenu: [
      { label: '剪切', role: 'cut' },
      { label: '复制', role: 'copy' },
      { label: '粘贴', role: 'paste' }
    ]
  },
  {
    label: '视图',
    submenu: [
      { label: '重新加载', role: 'reload' },
      { label: '强制重新加载', role: 'forceReload' },
      { label: '开发者工具', role: 'toggleDevTools' },
      { type: 'separator' },
      { label: '实际大小', role: 'resetZoom' },
      { label: '放大', role: 'zoomIn' },
      { label: '缩小', role: 'zoomOut' },
      { type: 'separator' },
      { label: '切换全屏', role: 'togglefullscreen' }
    ]
  },
  {
    label: '窗口',
    submenu: [
      { label: '最小化', role: 'minimize' },
      { label: '关闭', role: 'close' }
    ]
  },
  {
    label: '帮助',
    submenu: [
      { label: '关于', click: () => { /* TODO: Show about dialog */ } }
    ]
  }
];

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(() => {
  createWindow();

  // 设置应用程序菜单
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Handle context menu request from renderer process
  ipcMain.on('show-context-menu', (event, selectedText) => {
    console.log('Main process received "show-context-menu" for text:', selectedText);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '用 AI 总结',
        click: () => {
          // Send the selected text back to the renderer process to handle the AI call
          if (mainWindow) {
            mainWindow.webContents.send('summarize-with-ai', selectedText);
          }
        }
      },
      { type: 'separator' },
      { label: '复制', role: 'copy' },
    ]);
    contextMenu.popup(BrowserWindow.fromWebContents(event.sender));
  });

  // Handle context menu request for books in the library
  ipcMain.on('show-book-context-menu', (event, bookId) => {
    console.log('Main process received "show-book-context-menu" for book ID:', bookId);
    const bookContextMenu = Menu.buildFromTemplate([
      {
        label: '删除',
        click: () => {
          // Send the book ID back to the renderer process to handle deletion
          if (mainWindow) {
            mainWindow.webContents.send('delete-book', bookId);
          }
        }
      },
      { type: 'separator' },
      { label: '复制', role: 'copy' }, // Keep copy for consistency, though less useful here
    ]);
    bookContextMenu.popup(BrowserWindow.fromWebContents(event.sender));
  });


  app.on('activate', function () {
    // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 当所有窗口都被关闭时退出。
app.on('window-all-closed', function () {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') app.quit();
});

// 在这个文件中，你可以包含应用程序剩余的所有部分的主进程代码。
// 也可以拆分成几个文件，然后用 require 导入。

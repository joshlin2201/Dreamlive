const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1a1a2e'
  });

  const startURL = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'index.html')}`;

  mainWindow.loadURL(startURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Get audio files from the audio directory
  ipcMain.handle('get-audio-files', async () => {
    try {
      const audioPath = isDev
        ? path.join(__dirname, 'public/audio')
        : path.join(process.resourcesPath, 'audio');

      if (!fs.existsSync(audioPath)) {
        fs.mkdirSync(audioPath, { recursive: true });
      }

      const files = fs.readdirSync(audioPath);
      const audioFiles = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext);
        })
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map(file => ({
          name: file,
          path: path.join(audioPath, file)
        }));

      return audioFiles;
    } catch (error) {
      console.error('Error reading audio files:', error);
      return [];
    }
  });

  // Select custom audio folder
  ipcMain.handle('select-audio-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Get files from custom folder
  ipcMain.handle('get-audio-files-from-path', async (event, folderPath) => {
    try {
      if (!fs.existsSync(folderPath)) {
        return [];
      }

      const files = fs.readdirSync(folderPath);
      const audioFiles = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext);
        })
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map(file => ({
          name: file,
          path: path.join(folderPath, file)
        }));

      return audioFiles;
    } catch (error) {
      console.error('Error reading audio files from path:', error);
      return [];
    }
  });

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

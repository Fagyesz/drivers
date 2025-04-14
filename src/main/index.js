/**
 * Main Process Entry Point
 * 
 * This file is the entry point for the Electron main process.
 * It initializes the application, creates the main window, and sets up event handlers.
 */

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { initIpcHandlers, sendNotification } = require('./ipc-handlers');
const database = require('./database');
const { APP_INFO } = require('../shared/constants');
const logger = require('../renderer/utils/logger').main;

// Keep a global reference of the window object to avoid garbage collection
let mainWindow = null;

/**
 * Create the main application window
 */
function createMainWindow() {
  logger.info('Creating main window');
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../../assets/app-ico.ico'),
    title: APP_INFO.NAME
  });
  
  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, '../../index.html'));
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  
  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Create application menu
  createAppMenu();
  
  logger.info('Main window created');
}

/**
 * Create the application menu
 */
function createAppMenu() {
  logger.debug('Creating application menu');
  
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Data',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('switch-tab', 'import-tab');
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Dashboard',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('switch-tab', 'dashboard-tab');
            }
          }
        },
        {
          label: 'Vehicles',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('switch-tab', 'vehicles-tab');
            }
          }
        },
        {
          label: 'People',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('switch-tab', 'people-tab');
            }
          }
        },
        {
          label: 'Rounds',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('switch-tab', 'rounds-tab');
            }
          }
        },
        {
          label: 'Alerts',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('switch-tab', 'alerts-tab');
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://example.com/docs');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://example.com/support');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            // Show about dialog
            app.showAboutPanel();
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Initialize the application
 */
async function initializeApp() {
  logger.info('Initializing application');
  
  try {
    // Initialize database
    await database.initDatabase();
    
    // Initialize IPC handlers
    initIpcHandlers();
    
    // Set up About panel info
    app.setAboutPanelOptions({
      applicationName: APP_INFO.NAME,
      applicationVersion: APP_INFO.VERSION,
      version: APP_INFO.VERSION,
      copyright: `© ${new Date().getFullYear()} ${APP_INFO.AUTHOR}`,
      website: APP_INFO.HOMEPAGE,
      iconPath: path.join(__dirname, '../../assets/app-ico.ico')
    });
    
    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Error initializing application', { error: error.message });
    
    // Show error in main window if it exists
    if (mainWindow) {
      sendNotification(mainWindow, 'Error initializing application: ' + error.message, 'error');
    }
  }
}

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.warn('Another instance is already running. Quitting.');
  app.quit();
} else {
  // Focus the main window if a second instance is attempted
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
  
  // Create window when Electron is ready
  app.whenReady().then(() => {
    createMainWindow();
    initializeApp();
  });
  
  // Quit when all windows are closed, except on macOS
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
  
  // Handle app about to quit
  app.on('before-quit', async () => {
    logger.info('Application is about to quit');
    
    try {
      // Close database connection
      await database.closeDatabase();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database', { error: error.message });
    }
  });
} 
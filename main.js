const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ElectronStore = require('electron-store');
// Initialize store correctly
const store = new ElectronStore();
// Import database with the correct class
const DriverAlertsDatabase = require('./src/database');

// Import logger and issue manager
const logger = require('./src/logger');
const issueManager = require('./src/issues');

// Initialize database with the correct path
const database = new DriverAlertsDatabase(path.join(app.getPath('userData'), 'database', 'driverAlerts.db'));

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets/app-ico.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    backgroundColor: '#f8f8f8',
    minWidth: 800,
    minHeight: 600
  });

  mainWindow.loadFile('index.html');
  
  // Show window when ready to avoid flicker
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Open the DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Log any errors from the renderer
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    logger.error('Failed to load renderer:', { errorCode, errorDescription });
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
  
  // Create application menu
  createApplicationMenu();
}

// Create the application menu with Help
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Data',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate-to-tab', 'import-tab');
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    
    // View menu
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
    
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/DriverAlerts');
          }
        },
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/DriverAlerts/docs');
          }
        },
        {
          label: 'Community Discussions',
          click: async () => {
            await shell.openExternal('https://github.com/DriverAlerts/discussions');
          }
        },
        {
          label: 'Search Issues',
          click: async () => {
            await shell.openExternal('https://github.com/DriverAlerts/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'FAQ',
          click: () => {
            createFaqWindow();
          }
        },
        {
          label: 'Report an Issue',
          click: () => {
            createIssueLoggerWindow();
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Create FAQ window
function createFaqWindow() {
  const faqWindow = new BrowserWindow({
    width: 900,
    height: 700,
    parent: mainWindow,
    modal: false,
    icon: path.join(__dirname, 'assets/app-ico.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  faqWindow.loadFile('src/faq.html');
  
  // Log window creation
  logger.info('FAQ window opened');
}

// Create issue logger window
function createIssueLoggerWindow() {
  const issueLoggerWindow = new BrowserWindow({
    width: 800,
    height: 700,
    parent: mainWindow,
    modal: false,
    icon: path.join(__dirname, 'assets/app-ico.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  issueLoggerWindow.loadFile('src/issue-logger.html');
  
  // Log window creation
  logger.info('Issue logger window opened');
}

// Initialize the app right away
app.whenReady().then(() => {
  createWindow();
  console.log('Application started');
  logger.info('Application started', { version: app.getVersion() });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// IPC handlers for file selection
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
    ]
  });
  if (canceled) {
    return '';
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('get-app-data-path', () => {
  return app.getPath('userData');
});

// Database API handlers for the main entities

// People operations
ipcMain.handle('get-people', async () => {
  try {
    return await database.getPeople();
  } catch (error) {
    console.error('Error getting people:', error);
    return [];
  }
});

ipcMain.handle('get-person-by-id', async (event, id) => {
  try {
    return await database.getPersonById(id);
  } catch (error) {
    console.error('Error getting person by ID:', error);
    return null;
  }
});

ipcMain.handle('create-person', async (event, personData) => {
  try {
    const id = await database.createPerson(personData);
    return { id, ...personData };
  } catch (error) {
    console.error('Error creating person:', error);
    throw error;
  }
});

ipcMain.handle('update-person', async (event, { id, personData }) => {
  try {
    const success = await database.updatePerson(id, personData);
    return { success };
  } catch (error) {
    console.error('Error updating person:', error);
    throw error;
  }
});

ipcMain.handle('delete-person', async (event, id) => {
  try {
    const success = await database.deletePerson(id);
    return { success };
  } catch (error) {
    console.error('Error deleting person:', error);
    throw error;
  }
});

// Vehicle operations
ipcMain.handle('get-vehicles', async () => {
  try {
    return await database.getVehicles();
  } catch (error) {
    console.error('Error getting vehicles:', error);
    return [];
  }
});

ipcMain.handle('get-vehicle-by-id', async (event, id) => {
  try {
    return await database.getVehicleById(id);
  } catch (error) {
    console.error('Error getting vehicle by ID:', error);
    return null;
  }
});

ipcMain.handle('create-vehicle', async (event, vehicleData) => {
  try {
    const id = await database.createVehicle(vehicleData);
    return { id, ...vehicleData };
  } catch (error) {
    console.error('Error creating vehicle:', error);
    throw error;
  }
});

ipcMain.handle('update-vehicle', async (event, { id, vehicleData }) => {
  try {
    const success = await database.updateVehicle(id, vehicleData);
    return { success };
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw error;
  }
});

ipcMain.handle('delete-vehicle', async (event, id) => {
  try {
    const success = await database.deleteVehicle(id);
    return { success };
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    throw error;
  }
});

// Rounds operations
ipcMain.handle('get-rounds', async () => {
  try {
    return await database.getRounds();
  } catch (error) {
    console.error('Error getting rounds:', error);
    return [];
  }
});

ipcMain.handle('get-round-by-id', async (event, id) => {
  try {
    return await database.getRoundById(id);
  } catch (error) {
    console.error('Error getting round by ID:', error);
    return null;
  }
});

// Alerts operations
ipcMain.handle('get-alerts', async () => {
  try {
    return await database.getAlerts();
  } catch (error) {
    console.error('Error getting alerts:', error);
    return [];
  }
});

// Count operations for dashboard
ipcMain.handle('get-count', async (event, table) => {
  try {
    return await database.countRecords(table);
  } catch (error) {
    console.error(`Error getting count for ${table}:`, error);
    return 0;
  }
});

// Import operations
ipcMain.handle('import-vehicle-movements', async (event, data) => {
  try {
    return await database.importVehicleMovements(data);
  } catch (error) {
    console.error('Error importing vehicle movements:', error);
    throw error;
  }
});

ipcMain.handle('import-stop-events', async (event, data) => {
  try {
    return await database.importStopEvents(data);
  } catch (error) {
    console.error('Error importing stop events:', error);
    throw error;
  }
});

ipcMain.handle('import-time-records', async (event, data) => {
  try {
    return await database.importTimeRecords(data);
  } catch (error) {
    console.error('Error importing time records:', error);
    throw error;
  }
});

// Vehicle-round connections
ipcMain.handle('get-vehicle-rounds', async (event, platenumber) => {
  try {
    return await database.getVehicleRounds(platenumber);
  } catch (error) {
    console.error('Error getting vehicle rounds:', error);
    return [];
  }
});

// Insert demo data for testing
ipcMain.handle('insert-demo-data', async () => {
  try {
    console.log("Inserting demo data...");
    const result = await database.insertDemoData();
    return { success: result };
  } catch (error) {
    console.error('Error inserting demo data:', error);
    return { success: false, error: error.message };
  }
});

// New IPC handlers for logging and issues

// Handle issue logging
ipcMain.handle('log-issue', async (event, issueData) => {
  try {
    const result = await issueManager.logIssue(issueData);
    logger.info('Issue logged', { issueId: result.issueId });
    return result;
  } catch (error) {
    logger.error('Error logging issue:', error);
    return { success: false, error: error.message };
  }
});

// Get system info
ipcMain.handle('get-system-info', () => {
  return {
    os: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    chromiumVersion: process.versions.chrome,
    nodeVersion: process.versions.node
  };
});

// Get recent logs
ipcMain.handle('get-recent-logs', (event, count = 100) => {
  return logger.getRecentLogs(count);
}); 
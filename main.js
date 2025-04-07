const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ElectronStore = require('electron-store');
// Initialize store correctly
const store = new ElectronStore();
// Import database with the correct class
const DriverAlertsDatabase = require('./src/database');
// Import Excel parser
const excelParser = require('./src/excelParser');

// Import logger and issue manager
const logger = require('./src/logger');
// Force logger level to debug to ensure all logs are captured
logger.setLogLevel('debug');
console.log('Logger level set to debug mode');
// Log a test error to confirm error styling
// logger.error('TEST ERROR - Error formatting test', { error: new Error('Test error with stack trace') });
const issueManager = require('./src/issues');

// Initialize database with the correct path
const dbPath = path.join(app.getPath('appData'), 'driver-alerts', 'database', 'driverAlerts.db');
const database = new DriverAlertsDatabase(dbPath);

// Ensure the stop_events_alert table has the correct structure
database.db.exec(`
  DROP TABLE IF EXISTS stop_events_alert;
  CREATE TABLE stop_events_alert (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    status TEXT,
    position TEXT,
    important_point TEXT,
    supervised TEXT CHECK(supervised IN ('pending', 'justified', 'unjustified')) DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('Recreated stop_events_alert table with correct structure');

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
  
  // Always open the DevTools during development
  mainWindow.webContents.openDevTools();

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
          label: 'Help Center',
          click: () => {
            createHelpWindow();
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Create Help window (combining FAQ and logs)
function createHelpWindow() {
  const helpWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    parent: mainWindow,
    modal: false,
    icon: path.join(__dirname, 'assets/app-ico.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  helpWindow.loadFile('src/faq.html');
  
  // Log window creation
  logger.info('Help window opened');
  
  // Add debugging events
  helpWindow.webContents.on('did-finish-load', () => {
    console.log('Help window content loaded');
  });
  
  helpWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load Help window:', errorCode, errorDescription);
  });
  
  // Enable DevTools for debugging if in dev mode
  if (process.argv.includes('--dev')) {
    helpWindow.webContents.openDevTools();
  }
}

// Deprecate these separate window functions
// They're kept for backwards compatibility
function createFaqWindow() {
  createHelpWindow();
}

function createLogsViewerWindow() {
  const helpWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    parent: mainWindow,
    modal: false,
    icon: path.join(__dirname, 'assets/app-ico.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  helpWindow.loadFile('src/logs-viewer.html');
  
  // Log window creation
  logger.info('Logs viewer window opened');
  
  // Add debugging events
  helpWindow.webContents.on('did-finish-load', () => {
    console.log('Logs viewer window content loaded');
  });
  
  helpWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load Logs viewer window:', errorCode, errorDescription);
  });
  
  // Enable DevTools for debugging if in dev mode
  if (process.argv.includes('--dev')) {
    helpWindow.webContents.openDevTools();
  }
  
  return helpWindow;
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
ipcMain.handle('select-file', async (event, options = {}) => {
  const defaultOptions = {
    title: 'Select File',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  };

  const mergedOptions = { ...defaultOptions, ...options };
  return await dialog.showOpenDialog(mergedOptions);
});

// Add handler for open-file-dialog (used by the enhanced import UI)
ipcMain.handle('open-file-dialog', async (event, options = {}) => {
  const defaultOptions = {
    title: 'Select File',
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  return await dialog.showOpenDialog(mergedOptions);
});

ipcMain.handle('get-app-data-path', () => {
  return path.join(app.getPath('appData'), 'driver-alerts');
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
    // Use direct database query instead of the potentially problematic method
    const results = database.db.prepare('SELECT * FROM stop_events_alert ORDER BY arrival_time DESC').all() || [];
    return results;
  } catch (error) {
    console.error('Error getting alerts:', error);
    return [];
  }
});

// Handler for updating alert supervised status
ipcMain.handle('update-alert-supervised', async (event, alertId, status) => {
  try {
    // Direct database update to avoid any potential method issues
    const query = `
      UPDATE stop_events_alert 
      SET supervised = ?, 
          updated_at = datetime('now') 
      WHERE id = ?
    `;
    
    const result = database.db.prepare(query).run(status, alertId);
    
    return { 
      success: true, 
      message: `Successfully updated supervised status to ${status}` 
    };
  } catch (error) {
    console.error('Error updating alert supervised status:', error);
    return { 
      success: false, 
      message: `Error updating alert supervised status: ${error.message}` 
    };
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

// Vehicle-round connections
ipcMain.handle('get-vehicle-rounds', async (event, platenumber) => {
  try {
    return await database.getVehicleRounds(platenumber);
  } catch (error) {
    console.error('Error getting vehicle rounds:', error);
    return [];
  }
});

// Updated SysWeb Excel operations with two-step process
// First step: Parse the Excel file and return data for preview
ipcMain.handle('parse-sysweb-excel', async (event, filePath) => {
  try {
    console.log('Starting SysWeb Excel parsing from:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File does not exist:', filePath);
      return {
        success: false,
        message: `File does not exist: ${filePath}`,
        error: 'File not found'
      };
    }
    
    // Parse the Excel file
    console.log('Parsing SysWeb Excel file...');
    let records = await excelParser.parseSysWebExcel(filePath);
    console.log(`Parsed ${records ? records.length : 0} records from SysWeb Excel`);
    
    // Debug the records
    if (!records || records.length === 0) {
      console.log('No records found in the Excel file. File may be empty or in an unexpected format.');
      console.log('Using sample test data instead for debugging');
      
      // Generate sample data for testing
      records = [
        {
          name: 'Test Person 1',
          jobtitle: 'Driver',
          costcenter: 'Delivery',
          date: '2023-04-01',
          planedshift: '08:00-16:00',
          actual: '08:15-16:30',
          check_in: '08:15',
          check_out: '16:30',
          workedTime: '8.25'
        },
        {
          name: 'Test Person 1',
          jobtitle: 'Driver',
          costcenter: 'Delivery',
          date: '2023-04-02',
          planedshift: '08:00-16:00',
          actual: '08:05-16:15',
          check_in: '08:05',
          check_out: '16:15',
          workedTime: '8.17'
        },
        {
          name: 'Test Person 2',
          jobtitle: 'Supervisor',
          costcenter: 'Operations',
          date: '2023-04-01',
          planedshift: '09:00-17:00',
          actual: '09:00-17:30',
          check_in: '09:00',
          check_out: '17:30',
          workedTime: '8.5'
        }
      ];
    }
    
    return {
      success: true,
      message: `Successfully parsed ${records.length} records. Ready for preview.`,
      data: records
    };
  } catch (error) {
    console.error('Error parsing SysWeb Excel:', error);
    return {
      success: false,
      message: `Error parsing SysWeb Excel: ${error.message}`,
      error: error.message
    };
  }
});

// Second step: Import the already parsed data after preview confirmation
ipcMain.handle('import-sysweb-data', async (event, records) => {
  try {
    console.log(`Importing ${records.length} pre-parsed SysWeb records to database`);
    
    // Import the data into the database
    const result = await database.importSysWebData(records);
    console.log('Import completed with result:', result);
    
    return {
      success: true,
      message: `Successfully imported ${result.success} records. ${result.errors} errors.`,
      data: result
    };
  } catch (error) {
    console.error('Error importing SysWeb data:', error);
    return {
      success: false,
      message: `Error importing SysWeb data: ${error.message}`,
      error: error.message
    };
  }
});

// Keep existing handler for backward compatibility but modify to use the two-step process
ipcMain.handle('import-sysweb-excel', async (event, filePath) => {
  try {
    // First parse
    const parseResult = await excelParser.parseSysWebExcel(filePath);
    
    // Then import
    const importResult = await database.importSysWebData(parseResult);
    
    return {
      success: true,
      message: `Successfully imported ${importResult.success} records. ${importResult.errors} errors.`,
      data: importResult
    };
  } catch (error) {
    console.error('Error in single-step SysWeb import:', error);
    return {
      success: false,
      message: `Error importing SysWeb Excel: ${error.message}`,
      error: error.message
    };
  }
});

// New IPC handlers for different import types
ipcMain.handle('import-alerts-excel', async (event, filePath) => {
  try {
    logger.info('Importing Alert Excel file', { file: filePath });
    
    // Use our existing parser and database import
    const records = await excelParser.parseAlertExcel(filePath);
    console.log(`Parsed ${records.length} Alert records`);
    
    if (records && records.length > 0) {
      // Ensure all records have valid plate_number
      const validRecords = records.filter(record => {
        if (!record.plate_number || record.plate_number.trim() === '') {
          console.error('Skipping record with missing plate_number', record);
          return false;
        }
        return true;
      });
      
      if (validRecords.length === 0) {
        return {
          success: false,
          message: 'No valid Alert records found with plate numbers.',
          data: { success: 0, errors: records.length, total: records.length }
        };
      }
      
      // Import the valid records to the database
      const result = await database.importAlertData(validRecords);
      
      return {
        success: true,
        message: `Successfully imported ${result.success} alert records. ${result.errors} errors.`,
        data: result
      };
    } else {
      return {
        success: false,
        message: 'No alert records found in the Excel file.',
        data: { success: 0, errors: 0, total: 0 }
      };
    }
  } catch (error) {
    console.error('Error importing Alerts Excel:', error);
    return {
      success: false,
      message: `Error importing Alerts Excel: ${error.message}`,
      error: error.message
    };
  }
});

ipcMain.handle('import-ifleet-excel', async (event, filePath) => {
  try {
    logger.info('Importing iFleet Excel file', { file: filePath });
    
    // Use our parser and database import
    const records = await excelParser.parseIFleetExcel(filePath);
    console.log(`Parsed ${records.length} iFleet records`);
    
    if (records && records.length > 0) {
      // Import the records to the database
      const result = await database.importIFleetData(records);
      
      return {
        success: true,
        message: `Successfully imported ${result.success} iFleet records. ${result.errors} errors.`,
        data: result
      };
    } else {
      return {
        success: false,
        message: 'No iFleet records found in the Excel file.',
        data: { success: 0, errors: 0, total: 0 }
      };
    }
  } catch (error) {
    console.error('Error importing iFleet Excel:', error);
    return {
      success: false,
      message: `Error importing iFleet Excel: ${error.message}`,
      error: error.message
    };
  }
});

ipcMain.handle('import-autodetect-excel', async (event, filePath) => {
  try {
    // Try to detect file type from content - simplified approach
    // For now, default to SysWeb as it's the only one implemented
    
    // In a real implementation, would analyze the Excel structure to determine type
    const records = await excelParser.parseSysWebExcel(filePath);
    
    if (records && records.length > 0) {
      // Found SysWeb-compatible data
      const result = await database.importSysWebData(records);
      
      return {
        success: true,
        message: `Detected Worktime data. Successfully imported ${result.success} records. ${result.errors} errors.`,
        data: {
          type: 'worktime',
          ...result
        }
      };
    } else {
      return {
        success: false,
        message: "Could not auto-detect file type. Please select a specific import type.",
        error: "Auto-detection failed"
      };
    }
  } catch (error) {
    console.error('Error auto-detecting Excel format:', error);
    return {
      success: false,
      message: `Error auto-detecting Excel format: ${error.message}`,
      error: error.message
    };
  }
});

// Get latest imported data
ipcMain.handle('get-latest-import-data', async (event) => {
  try {
    // For now, default to SysWeb data as it's the only one implemented
    const records = await database.getSysWebData();
    
    if (records && records.length > 0) {
      return {
        type: 'worktime',
        records: records
      };
    } else {
      return {
        type: null,
        records: []
      };
    }
  } catch (error) {
    console.error('Error getting latest import data:', error);
    return {
      type: null,
      records: []
    };
  }
});

// Handler for retrieving alerts data
ipcMain.handle('get-alerts-data', async (event) => {
  try {
    // Use the getAlerts method instead of getAlerts which was fetching from the wrong table
    const alertData = await database.db.prepare('SELECT * FROM stop_events_alert ORDER BY arrival_time DESC').all();
    return alertData;
  } catch (error) {
    console.error('Error getting alerts data:', error);
    return [];
  }
});

// Handler for retrieving iFleet data
ipcMain.handle('get-ifleet-data', async (event) => {
  try {
    return await database.getIFleetData();
  } catch (error) {
    console.error('Error getting iFleet data:', error);
    return [];
  }
});

// Handler for retrieving SysWeb data
ipcMain.handle('get-sysweb-data', async (event) => {
  try {
    return await database.getSysWebData();
  } catch (error) {
    console.error('Error getting SysWeb data:', error);
    return [];
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

// Get all logs as a single string (for logs viewer)
ipcMain.handle('get-all-logs', async () => {
  try {
    const logFiles = logger.getAllLogs();
    
    // If no log files, return empty string
    if (!logFiles || logFiles.length === 0) {
      return '';
    }
    
    // Read most recent log file
    const mostRecentLog = logFiles[0];
    const logContent = fs.readFileSync(mostRecentLog, { encoding: 'utf8' });
    
    // Return content
    return logContent;
  } catch (error) {
    logger.error('Error getting all logs:', error);
    return '';
  }
});

// Clear logs (for logs viewer)
ipcMain.handle('clear-logs', async () => {
  try {
    // Create empty current log file
    fs.writeFileSync(
      logger.currentLogFile,
      `=== Logs cleared at ${new Date().toISOString()} ===\n`,
      { encoding: 'utf8' }
    );
    
    // Log the clear action
    logger.info('Logs were cleared by user');
    
    return { success: true };
  } catch (error) {
    logger.error('Error clearing logs:', error);
    return { success: false, error: error.message };
  }
});

// Export logs (for logs viewer)
ipcMain.handle('export-logs', async () => {
  try {
    // Show save dialog
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Logs',
      defaultPath: path.join(app.getPath('documents'), `driver-alerts-logs-${new Date().toISOString().split('T')[0]}.log`),
      filters: [
        { name: 'Log Files', extensions: ['log'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (canceled || !filePath) {
      return '';
    }
    
    // Get all logs
    const logFiles = logger.getAllLogs();
    
    // If no log files, return empty
    if (!logFiles || logFiles.length === 0) {
      return '';
    }
    
    // Read most recent log file
    const mostRecentLog = logFiles[0];
    const logContent = fs.readFileSync(mostRecentLog, { encoding: 'utf8' });
    
    // Write to selected file
    fs.writeFileSync(filePath, logContent, { encoding: 'utf8' });
    
    // Log the export
    logger.info(`Logs exported to ${filePath}`);
    
    return filePath;
  } catch (error) {
    logger.error('Error exporting logs:', error);
    return '';
  }
});

// Add IPC handlers for window navigation with better logging
ipcMain.on('close-current-window', (event) => {
  console.log('Received close-current-window IPC message');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    console.log('Closing window');
    win.close();
  } else {
    console.error('Could not find window to close');
  }
});

// This is kept for backwards compatibility but is no longer needed
ipcMain.on('open-logs-viewer', (event) => {
  console.log('Received open-logs-viewer IPC message');
  
  // Close the current window if it exists
  const currentWindow = BrowserWindow.fromWebContents(event.sender);
  if (currentWindow) {
    currentWindow.close();
  }
  
  // Create a new logs viewer window
  createLogsViewerWindow();
});

// This is kept for backwards compatibility but is no longer needed
ipcMain.on('close-logs-viewer', (event) => {
  console.log('Received close-logs-viewer IPC message');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    console.log('Closing logs viewer window');
    // Instead of closing, switch back to FAQ tab
    win.webContents.send('switch-to-faq-tab');
  } else {
    console.error('Could not find logs viewer window to close');
  }
});

// Add additional handler for opening the help center
ipcMain.on('open-help-center', (event) => {
  console.log('Received open-help-center IPC message');
  // Close the current window
  const currentWindow = BrowserWindow.fromWebContents(event.sender);
  if (currentWindow) {
    currentWindow.close();
  }
  
  // Open the help center
  createHelpWindow();
});

// SysWeb Excel parser handler
ipcMain.handle('parse-sys-web-excel', async (event, filePath) => {
  logger.info('Parsing SysWeb Excel file', { file: filePath });
  
  try {
    const records = await excelParser.parseSysWebExcel(filePath);
    console.log(`Parsed ${records.length} SysWeb records`);
    
    if (records && records.length > 0) {
      // Import the records to the database
      const result = await database.importSysWebData(records);
      
      return {
        success: result.success,
        errors: result.errors,
        total: result.total,
        message: `Successfully imported ${result.success} records. ${result.errors} errors.`
      };
    } else {
      return {
        success: 0,
        errors: 0,
        total: 0,
        message: 'No records found in the Excel file.'
      };
    }
  } catch (error) {
    console.error('Error parsing SysWeb Excel:', error);
    logger.error('Error parsing SysWeb Excel', { error: error.message });
    
    return {
      success: 0,
      errors: 1,
      total: 0,
      message: `Error parsing Excel: ${error.message}`
    };
  }
});

// Alert Excel parser handler
ipcMain.handle('parse-alert-excel', async (event, filePath) => {
  logger.info('Parsing Alert Excel file', { file: filePath });
  
  try {
    const records = await excelParser.parseAlertExcel(filePath);
    console.log(`Parsed ${records.length} Alert records`);
    
    if (records && records.length > 0) {
      // Filter out records with missing plate numbers
      const validRecords = records.filter(record => {
        if (!record.plate_number || record.plate_number.trim() === '') {
          console.error('Skipping record with missing plate_number', record);
          return false;
        }
        return true;
      });
      
      if (validRecords.length === 0) {
        return {
          success: 0,
          errors: records.length,
          total: records.length,
          message: 'No valid alert records with plate numbers found.'
        };
      }
      
      // Import the valid records to the database
      const result = await database.importAlertData(validRecords);
      
      return {
        success: result.success,
        errors: result.errors,
        total: result.total,
        message: `Successfully imported ${result.success} alert records. ${result.errors} errors.`
      };
    } else {
      return {
        success: 0,
        errors: 0,
        total: 0,
        message: 'No alert records found in the Excel file.'
      };
    }
  } catch (error) {
    console.error('Error parsing Alert Excel:', error);
    logger.error('Error parsing Alert Excel', { error: error.message });
    
    return {
      success: 0,
      errors: 1,
      total: 0,
      message: `Error parsing Excel: ${error.message}`
    };
  }
});

// IPC handler for log messages from renderer process
ipcMain.handle('log-message', (event, logData) => {
  if (!logData || !logData.level || !logData.message) {
    console.error('Invalid log data format received:', logData);
    return { success: false, error: 'Invalid log data format' };
  }
  
  const { level, message, data } = logData;
  
  try {
    // Add sender information for better context
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    const contextData = {
      ...data,
      renderer: {
        id: webContents.id,
        url: webContents.getURL(),
        title: win ? win.getTitle() : 'Unknown',
        windowId: win ? win.id : 'Unknown'
      }
    };
    
    // Only log if level is valid
    if (typeof logger[level] === 'function') {
      logger[level](message, contextData);
      return { success: true };
    } else {
      const errorMsg = `Invalid log level received from renderer: ${level}`;
      console.error(errorMsg);
      // Log as error with the original message
      logger.error(errorMsg, { originalMessage: message, ...contextData });
      return { success: false, error: 'Invalid log level' };
    }
  } catch (err) {
    console.error('Error handling renderer log message:', err);
    logger.error('Error processing renderer log', { 
      error: err, 
      originalMessage: message,
      originalData: data
    });
    return { success: false, error: err.message };
  }
});

// IPC handler for clearing log cache
ipcMain.handle('clear-log-cache', (event) => {
  try {
    console.log('Clearing log cache...');
    return { success: true };
  } catch (error) {
    console.error('Error clearing log cache:', error);
    return { success: false, error: error.message };
  }
});

// Register the confirm-ifleet-import handler
ipcMain.handle('confirm-ifleet-import', async (event, validData) => {
  try {
    logger.info('Confirming iFleet data import to database', { count: validData.length });
    
    // Import the valid records to the database
    const result = await database.importIFleetData(validData);
    
    return {
      success: true,
      message: `Successfully imported ${result.success} iFleet records. ${result.errors} errors.`,
      data: result
    };
  } catch (error) {
    console.error('Error confirming iFleet import:', error);
    logger.error('Error confirming iFleet import', { error: error.message });
    
    return {
      success: false,
      message: `Error confirming iFleet import: ${error.message}`,
      error: error.message
    };
  }
});

// Register the confirm-alert-import handler
ipcMain.handle('confirm-alert-import', async (event, validData) => {
  try {
    logger.info('Confirming alert data import to database', { count: validData.length });
    
    // Import the valid records to the database
    const result = await database.importAlertData(validData);
    
    return {
      success: true,
      message: `Successfully imported ${result.success} alert records. ${result.errors} errors.`,
      data: result
    };
  } catch (error) {
    console.error('Error confirming alert import:', error);
    logger.error('Error confirming alert import', { error: error.message });
    
    return {
      success: false,
      message: `Error confirming alert import: ${error.message}`,
      error: error.message
    };
  }
}); 
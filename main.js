const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ElectronStore = require('electron-store');
// Initialize store correctly
const store = new ElectronStore();
// Import database with the correct class
const DriverAlertsDatabase = require('./src/database');

// Initialize database with the correct path
const database = new DriverAlertsDatabase(path.join(app.getPath('userData'), 'database', 'driverAlerts.db'));

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Log any errors from the renderer
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Initialize the app right away
app.whenReady().then(() => {
  createWindow();
  console.log('Application started');
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
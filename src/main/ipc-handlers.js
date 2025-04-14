/**
 * IPC Handler
 * 
 * Manages all IPC communication between main and renderer processes.
 * Registers handlers for IPC events from the renderer.
 */

const { ipcMain } = require('electron');
const database = require('./database');
const logger = require('../renderer/utils/logger').createLogger('IPCHandler');
const { IPC_CHANNELS } = require('../shared/constants');

/**
 * Initialize IPC event handlers
 */
function initIpcHandlers() {
  logger.info('Initializing IPC handlers');
  
  // === Database Operations ===
  
  // Get all people
  ipcMain.handle(IPC_CHANNELS.GET_PEOPLE, async () => {
    try {
      logger.debug('IPC: Get people request received');
      return await database.getPeople();
    } catch (error) {
      logger.error('Error handling get-people IPC', { error: error.message });
      throw error;
    }
  });
  
  // Get all vehicles
  ipcMain.handle(IPC_CHANNELS.GET_VEHICLES, async () => {
    try {
      logger.debug('IPC: Get vehicles request received');
      return await database.getVehicles();
    } catch (error) {
      logger.error('Error handling get-vehicles IPC', { error: error.message });
      throw error;
    }
  });
  
  // Get all rounds
  ipcMain.handle(IPC_CHANNELS.GET_ROUNDS, async () => {
    try {
      logger.debug('IPC: Get rounds request received');
      return await database.getRounds();
    } catch (error) {
      logger.error('Error handling get-rounds IPC', { error: error.message });
      throw error;
    }
  });
  
  // Get alerts filtered by status
  ipcMain.handle(IPC_CHANNELS.GET_ALERTS, async (event, status = 'pending') => {
    try {
      logger.debug('IPC: Get alerts request received', { status });
      return await database.getAlerts(status);
    } catch (error) {
      logger.error('Error handling get-alerts IPC', { error: error.message, status });
      throw error;
    }
  });
  
  // Update alert status
  ipcMain.handle(IPC_CHANNELS.UPDATE_ALERT_STATUS, async (event, id, status) => {
    try {
      logger.debug('IPC: Update alert status request received', { id, status });
      
      if (!id || !status) {
        throw new Error('Alert ID and status are required');
      }
      
      const result = await database.updateAlertStatus(id, status);
      return result.changes > 0;
    } catch (error) {
      logger.error('Error handling update-alert-status IPC', { error: error.message, id, status });
      throw error;
    }
  });
  
  // Update alert importance
  ipcMain.handle(IPC_CHANNELS.UPDATE_ALERT_IMPORTANT, async (event, id, important) => {
    try {
      logger.debug('IPC: Update alert importance request received', { id, important });
      
      if (!id) {
        throw new Error('Alert ID is required');
      }
      
      const result = await database.updateAlertImportant(id, !!important);
      return result.changes > 0;
    } catch (error) {
      logger.error('Error handling update-alert-important IPC', { error: error.message, id, important });
      throw error;
    }
  });
  
  // Count records in a table
  ipcMain.handle('get-count', async (event, table) => {
    try {
      logger.debug('IPC: Get count request received', { table });
      
      if (!table) {
        throw new Error('Table name is required');
      }
      
      return await database.countRecords(table);
    } catch (error) {
      logger.error('Error handling get-count IPC', { error: error.message, table });
      return 0;
    }
  });
  
  // === Import Operations ===
  
  // Import data from file
  ipcMain.handle(IPC_CHANNELS.IMPORT_DATA, async (event, filePath, importType) => {
    try {
      logger.info('IPC: Import data request received', { filePath, importType });
      
      if (!filePath) {
        throw new Error('File path is required');
      }
      
      // This would be implemented in a separate import module
      // For now, just return a mock result
      return {
        success: true,
        records: 0,
        message: 'Import function not yet implemented'
      };
    } catch (error) {
      logger.error('Error handling import-data IPC', { error: error.message, filePath, importType });
      throw error;
    }
  });
  
  logger.info('IPC handlers initialized');
}

/**
 * Send a notification to the renderer process
 * @param {BrowserWindow} window - The browser window to send to
 * @param {string} message - The message to display
 * @param {string} type - The notification type (info, success, error, warning)
 */
function sendNotification(window, message, type = 'info') {
  if (!window) {
    logger.warn('Cannot send notification: No window provided');
    return;
  }
  
  try {
    logger.debug('Sending notification to window', { message, type });
    window.webContents.send(IPC_CHANNELS.SHOW_NOTIFICATION, message, type);
  } catch (error) {
    logger.error('Error sending notification', { error: error.message, message, type });
  }
}

/**
 * Send a request to reload data in the current tab
 * @param {BrowserWindow} window - The browser window to send to
 */
function sendReloadData(window) {
  if (!window) {
    logger.warn('Cannot send reload data: No window provided');
    return;
  }
  
  try {
    logger.debug('Sending reload-data event to window');
    window.webContents.send(IPC_CHANNELS.RELOAD_DATA);
  } catch (error) {
    logger.error('Error sending reload-data event', { error: error.message });
  }
}

/**
 * Send a request to switch to a specific tab
 * @param {BrowserWindow} window - The browser window to send to
 * @param {string} tabId - The ID of the tab to switch to
 */
function sendSwitchTab(window, tabId) {
  if (!window) {
    logger.warn('Cannot send switch tab: No window provided');
    return;
  }
  
  try {
    logger.debug('Sending switch-tab event to window', { tabId });
    window.webContents.send(IPC_CHANNELS.SWITCH_TAB, tabId);
  } catch (error) {
    logger.error('Error sending switch-tab event', { error: error.message, tabId });
  }
}

module.exports = {
  initIpcHandlers,
  sendNotification,
  sendReloadData,
  sendSwitchTab
};
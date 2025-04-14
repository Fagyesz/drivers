/**
 * Application Constants
 * Shared between main and renderer processes
 */

// Application info
const APP_INFO = {
  NAME: 'Driver Allerts',
  VERSION: '1.0.0',
  AUTHOR: 'Your Organization',
  DESCRIPTION: 'Vehicle Monitoring System',
  HOMEPAGE: 'https://example.com'
};

// IPC channel names
const IPC_CHANNELS = {
  // Database operations
  GET_PEOPLE: 'get-people',
  GET_VEHICLES: 'get-vehicles',
  GET_ROUNDS: 'get-rounds',
  GET_ALERTS: 'get-alerts',
  UPDATE_ALERT_STATUS: 'update-alert-status',
  UPDATE_ALERT_IMPORTANT: 'update-alert-important',
  
  // Import operations
  IMPORT_DATA: 'import-data',
  
  // UI operations
  RELOAD_DATA: 'reload-data',
  SHOW_NOTIFICATION: 'show-notification',
  SWITCH_TAB: 'switch-tab',
  
  // Window operations
  CLOSE_CURRENT_WINDOW: 'close-current-window',
  MINIMIZE_WINDOW: 'minimize-window',
  MAXIMIZE_WINDOW: 'maximize-window',
  OPEN_HELP: 'open-help',
  SWITCH_TO_LOGS_TAB: 'switch-to-logs-tab',
  SWITCH_TO_FAQ_TAB: 'switch-to-faq-tab'
};

// Alert status constants
const ALERT_STATUS = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
  ALL: 'all'
};

// Import types
const IMPORT_TYPES = {
  AUTODETECT: 'autodetect',
  SYSWEB: 'sysweb',
  IFLEET: 'ifleet',
  ALERTS: 'alerts',
  ROUTES: 'routes'
};

// Database tables
const DB_TABLES = {
  PEOPLE: 'people',
  VEHICLES: 'vehicles',
  ROUNDS: 'rounds',
  ALERTS: 'stop_events_alert',
  LOGS: 'app_logs'
};

// Configuration defaults
const CONFIG_DEFAULTS = {
  DATABASE_PATH: './data/driver-allerts.db',
  LOG_LEVEL: 'info',
  AUTO_UPDATE: true,
  DEMO_MODE: false,
  UI_THEME: 'light',
  CACHE_EXPIRATION: 5 * 60 * 1000 // 5 minutes
};

// Export all constants
module.exports = {
  APP_INFO,
  IPC_CHANNELS,
  ALERT_STATUS,
  IMPORT_TYPES,
  DB_TABLES,
  CONFIG_DEFAULTS
}; 
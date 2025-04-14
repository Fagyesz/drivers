/**
 * Main Renderer Process Entry Point
 * 
 * This file orchestrates the renderer process using the modular architecture.
 * It initializes the application components and sets up event listeners.
 */

// Import utilities
const logger = require('./utils/logger').renderer;
const { showNotification } = require('./services/notifier');

// Import components
const tabsManager = require('./components/tabs-manager');
const dashboard = require('./components/dashboard/dashboard');

// Import any other necessary modules
// const vehicles = require('./components/vehicles/vehicles');
// const people = require('./components/people/people');
// const alerts = require('./components/alerts/alerts');
// const rounds = require('./components/rounds/rounds');
// const importModule = require('./components/import/import');

// Global flag for import initialization
let importInitialized = false;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  logger.info('DOM loaded - initializing renderer');
  
  try {
    // Initialize app components
    initializeApp();
  } catch (error) {
    logger.error('Error initializing application', { error: error.message });
    showNotification('Error initializing application. Please restart.', 'error');
  }
});

/**
 * Initialize the application components
 */
function initializeApp() {
  // Add a splash effect to the dashboard
  dashboard.addSplashEffect();
  
  // Initialize tab system
  tabsManager.initializeTabs();
  
  // Initialize dashboard
  dashboard.initializeDashboard();
  
  // Initialize import functionality ONLY ONCE
  if (!importInitialized) {
    try {
      // This would be: importModule.initializeImport();
      initializeImport();
      importInitialized = true;
    } catch (error) {
      logger.error('Error initializing import module', { error: error.message });
    }
  }
  
  // Set up other event listeners
  setupGlobalEventListeners();
  
  logger.info('Application initialization complete');
}

/**
 * Setup global event listeners
 */
function setupGlobalEventListeners() {
  // Listen for IPC messages from main process
  const { ipcRenderer } = require('electron');
  
  ipcRenderer.on('reload-data', () => {
    logger.info('Received reload-data message');
    reloadCurrentTabData();
  });
  
  ipcRenderer.on('show-notification', (event, message, type) => {
    logger.info('Received show-notification message', { message, type });
    showNotification(message, type);
  });
  
  ipcRenderer.on('switch-tab', (event, tabId) => {
    logger.info('Received switch-tab message', { tabId });
    tabsManager.goToTab(tabId);
  });
  
  // Add window resize handler if needed
  window.addEventListener('resize', debounce(() => {
    logger.debug('Window resized');
    // Handle resize if needed
  }, 250));
  
  logger.info('Global event listeners initialized');
}

/**
 * Reload data for the current active tab
 */
function reloadCurrentTabData() {
  const activeTabId = tabsManager.getActiveTabId();
  logger.info('Reloading data for current tab', { activeTabId });
  
  tabsManager.loadTabData(activeTabId);
}

/**
 * Simple debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Temporary fallback functions until the other modules are created
// These can be removed once the respective modules are implemented

// TODO: Replace with actual module imports
function initializeImport() {
  logger.info('Initializing import functionality (temporary)');
  
  // This should be replaced with the actual import module
  // For now, just try to find the DOM elements and set up basic handlers
  try {
    const importTabBtn = document.querySelector('.tab-btn[data-tab="import-tab"]');
    if (importTabBtn) {
      importTabBtn.addEventListener('click', () => {
        logger.info('Import tab activated');
      });
    }
  } catch (error) {
    logger.error('Error initializing temporary import', { error: error.message });
  }
}

// Export any functions that might be needed by other modules
module.exports = {
  reloadCurrentTabData
}; 
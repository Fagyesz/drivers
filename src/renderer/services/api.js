/**
 * API Service - Handles all IPC communication with the main process
 */
const { ipcRenderer } = require('electron');

// Cache for data to reduce IPC calls
const cache = {
  people: null,
  vehicles: null,
  rounds: null,
  alerts: null,
  alertsTimestamp: null
};

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Clear all cached data
 */
function clearCache() {
  cache.people = null;
  cache.vehicles = null;
  cache.rounds = null;
  cache.alerts = null;
  cache.alertsTimestamp = null;
}

/**
 * Get people data
 * @param {boolean} forceRefresh - Whether to bypass cache and force a refresh
 * @returns {Promise<Array>} Array of people objects
 */
async function getPeople(forceRefresh = false) {
  if (!forceRefresh && cache.people) {
    return cache.people;
  }

  try {
    const people = await ipcRenderer.invoke("get-people");
    cache.people = people || [];
    return cache.people;
  } catch (error) {
    console.error("Error getting people:", error);
    throw error;
  }
}

/**
 * Get vehicles data
 * @param {boolean} forceRefresh - Whether to bypass cache and force a refresh
 * @returns {Promise<Array>} Array of vehicle objects
 */
async function getVehicles(forceRefresh = false) {
  if (!forceRefresh && cache.vehicles) {
    return cache.vehicles;
  }

  try {
    const vehicles = await ipcRenderer.invoke("get-vehicles");
    cache.vehicles = vehicles || [];
    return cache.vehicles;
  } catch (error) {
    console.error("Error getting vehicles:", error);
    throw error;
  }
}

/**
 * Get rounds data
 * @param {boolean} forceRefresh - Whether to bypass cache and force a refresh
 * @returns {Promise<Array>} Array of round objects
 */
async function getRounds(forceRefresh = false) {
  if (!forceRefresh && cache.rounds) {
    return cache.rounds;
  }

  try {
    const rounds = await ipcRenderer.invoke("get-rounds");
    cache.rounds = rounds || [];
    return cache.rounds;
  } catch (error) {
    console.error("Error getting rounds:", error);
    throw error;
  }
}

/**
 * Get alerts data
 * @param {string} filterStatus - Filter alerts by status
 * @param {boolean} forceRefresh - Whether to bypass cache and force a refresh
 * @returns {Promise<Array>} Array of alert objects
 */
async function getAlerts(filterStatus = "pending", forceRefresh = false) {
  // Check if cache is valid - if status filter is different, we need to refresh
  const cacheValid = cache.alerts && 
                     cache.alertsStatus === filterStatus &&
                     (Date.now() - cache.alertsTimestamp < CACHE_EXPIRATION);
                     
  if (!forceRefresh && cacheValid) {
    return cache.alerts;
  }

  try {
    const alerts = await ipcRenderer.invoke("get-alerts", filterStatus);
    cache.alerts = alerts || [];
    cache.alertsStatus = filterStatus;
    cache.alertsTimestamp = Date.now();
    return cache.alerts;
  } catch (error) {
    console.error("Error getting alerts:", error);
    throw error;
  }
}

/**
 * Update alert status
 * @param {number} alertId - The ID of the alert to update
 * @param {string} status - The new status value
 * @returns {Promise<boolean>} Success status
 */
async function updateAlertStatus(alertId, status) {
  try {
    const result = await ipcRenderer.invoke("update-alert-status", alertId, status);
    // Invalidate alerts cache
    cache.alerts = null;
    return result;
  } catch (error) {
    console.error(`Error updating alert status (${alertId}, ${status}):`, error);
    throw error;
  }
}

/**
 * Mark alert as important
 * @param {number} alertId - The ID of the alert to update
 * @param {boolean} important - Whether the alert is important
 * @returns {Promise<boolean>} Success status
 */
async function updateAlertImportant(alertId, important) {
  try {
    const result = await ipcRenderer.invoke("update-alert-important", alertId, important);
    // Invalidate alerts cache
    cache.alerts = null;
    return result;
  } catch (error) {
    console.error(`Error updating alert importance (${alertId}, ${important}):`, error);
    throw error;
  }
}

/**
 * Import data from file
 * @param {string} filePath - Path to the file to import
 * @param {string} importType - Type of import (sysweb, ifleet, etc.)
 * @returns {Promise<Object>} Import results
 */
async function importData(filePath, importType) {
  try {
    const result = await ipcRenderer.invoke("import-data", filePath, importType);
    // Clear all caches after import
    clearCache();
    return result;
  } catch (error) {
    console.error(`Error importing data (${importType}):`, error);
    throw error;
  }
}

module.exports = {
  getPeople,
  getVehicles,
  getRounds,
  getAlerts,
  updateAlertStatus,
  updateAlertImportant,
  importData,
  clearCache
}; 
/**
 * Tabs Manager - Handles tab initialization and switching
 */
const logger = require('../utils/logger').createLogger('TabsManager');
const dashboard = require('./dashboard/dashboard');
const { showNotification } = require('../services/notifier');

// Keep track of active tab
let activeTabId = 'dashboard-tab';

// Initialize event listeners for tabs
function initializeTabs() {
  logger.info('Initializing tabs');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const tabId = button.getAttribute('data-tab');
      logger.info('Tab clicked', { tabId });
      
      switchToTab(tabId, tabButtons, tabPanes);
    });
  });
  
  // Initialize refresh buttons
  initializeRefreshButtons();
}

/**
 * Switch to a specific tab
 * @param {string} tabId - ID of the tab to switch to
 * @param {NodeList} tabButtons - All tab buttons
 * @param {NodeList} tabPanes - All tab panes
 */
function switchToTab(tabId, tabButtons, tabPanes) {
  // Update active tab button
  tabButtons.forEach((btn) => btn.classList.remove('active'));
  const activeButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }

  // Show selected tab content
  tabPanes.forEach((pane) => {
    pane.classList.remove('active');
    if (pane.id === tabId) {
      pane.classList.add('active');

      // Load data based on which tab is active
      loadTabData(tabId);
    }
  });
  
  // Update active tab ID
  activeTabId = tabId;
}

/**
 * Load data for a specific tab
 * @param {string} tabId - ID of the tab to load data for
 */
function loadTabData(tabId) {
  logger.info('Loading data for tab', { tabId });
  
  switch (tabId) {
    case 'dashboard-tab':
      // Just to be sure dashboard is initialized
      if (typeof dashboard.loadDashboardCounts === 'function') {
        dashboard.loadDashboardCounts();
      }
      break;
      
    case 'vehicles-tab':
      // Load vehicles data
      if (typeof loadVehicles === 'function') {
        loadVehicles();
      } else {
        logger.warn('loadVehicles function not available');
      }
      break;
      
    case 'people-tab':
      // Load people data
      if (typeof loadPeople === 'function') {
        loadPeople();
      } else {
        logger.warn('loadPeople function not available');
      }
      break;
      
    case 'rounds-tab':
      // Load rounds data
      if (typeof loadRounds === 'function') {
        loadRounds();
      } else {
        logger.warn('loadRounds function not available');
      }
      break;
      
    case 'alerts-tab':
      // Load alerts data
      if (typeof loadAlerts === 'function') {
        // If we have a global currentAlertFilter, use it
        const filterStatus = window.currentAlertFilter || 'pending';
        loadAlerts(filterStatus);
      } else {
        logger.warn('loadAlerts function not available');
      }
      break;
      
    case 'import-tab':
      // Nothing to load for import tab
      break;
      
    default:
      logger.warn('Unknown tab ID', { tabId });
  }
}

/**
 * Get the ID of the currently active tab
 * @returns {string} Active tab ID
 */
function getActiveTabId() {
  return activeTabId;
}

/**
 * Programmatically switch to a tab
 * @param {string} tabId - ID of the tab to switch to
 */
function goToTab(tabId) {
  const tabButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (tabButton) {
    tabButton.click();
  } else {
    logger.error('Tab button not found', { tabId });
  }
}

// Initialize refresh buttons functionality
function initializeRefreshButtons() {
  logger.info("Initializing refresh buttons");
  
  // Get all refresh buttons
  const refreshButtons = document.querySelectorAll(".refresh-btn");
  
  // Create a debounce function to prevent rapid clicking
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
  
  // Function to handle refresh click
  async function handleRefreshClick(button) {
    const tabId = button.closest(".tab-pane").id;
    logger.info("Refresh button clicked", { tabId });
    
    // Add loading state to button
    button.disabled = true;
    button.classList.add("loading");
    const originalContent = button.innerHTML;
    button.innerHTML = '🔄';
    
    try {
      // Load data based on tab
      await loadTabData(tabId);
      
      // Show a brief success notification
      showNotification("Data refreshed successfully", "success");
    } catch (error) {
      logger.error("Error refreshing data", {
        error: error.message,
        tabId
      });
      
      // Show error notification
      showNotification("Error refreshing data. Please try again.", "error");
    } finally {
      // Remove loading state from button
      button.disabled = false;
      button.classList.remove("loading");
      button.innerHTML = originalContent;
    }
  }
  
  // Create debounced version of refresh handler
  const debouncedRefresh = debounce(handleRefreshClick, 500);
  
  // Add click event listener to each refresh button
  refreshButtons.forEach(button => {
    button.addEventListener("click", () => debouncedRefresh(button));
  });
}

module.exports = {
  initializeTabs,
  switchToTab,
  getActiveTabId,
  goToTab,
  loadTabData
}; 
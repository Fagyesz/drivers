/**
 * Dashboard Component - Provides an overview of application data
 */
const logger = require('../../utils/logger').createLogger('Dashboard');
const api = require('../../services/api');
const { showNotification } = require('../../services/notifier');

/**
 * Initialize the dashboard
 */
function initializeDashboard() {
  logger.info('Initializing dashboard');
  
  // Add splash effect to the dashboard
  addSplashEffect();
  
  // Load dashboard counts
  loadDashboardCounts();
  
  // Set up refresh button
  setupRefreshButton();
}

/**
 * Add a splash effect to dashboard cards
 */
function addSplashEffect() {
  logger.debug('Adding splash effect to dashboard');
  
  const dashboardCards = document.querySelectorAll('.dashboard-card');
  
  dashboardCards.forEach((card, index) => {
    // Add staggered animation delay
    card.style.animationDelay = `${index * 100}ms`;
    
    // Add hover effect listener
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 6px 15px rgba(0, 0, 0, 0.1)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'var(--shadow)';
    });
  });
}

/**
 * Set up the refresh button for the dashboard
 */
function setupRefreshButton() {
  logger.debug('Setting up dashboard refresh button');
  
  const refreshButton = document.querySelector('#dashboard-tab .refresh-btn');
  if (!refreshButton) {
    logger.warn('Dashboard refresh button not found');
    return;
  }
  
  refreshButton.addEventListener('click', handleRefreshClick);
}

/**
 * Handle refresh button click
 * @param {Event} event - Click event
 */
async function handleRefreshClick(event) {
  logger.info('Dashboard refresh button clicked');
  
  const button = event.currentTarget;
  
  // Add loading state to button
  button.disabled = true;
  button.classList.add('loading');
  const originalContent = button.innerHTML;
  button.innerHTML = '🔄';
  
  try {
    await loadDashboardCounts(true);
    showNotification('Dashboard data refreshed successfully', 'success');
  } catch (error) {
    logger.error('Error refreshing dashboard data', { error: error.message });
    showNotification('Error refreshing dashboard data. Please try again.', 'error');
  } finally {
    // Remove loading state from button
    button.disabled = false;
    button.classList.remove('loading');
    button.innerHTML = originalContent;
  }
}

/**
 * Load data counts for dashboard
 * @param {boolean} forceRefresh - Whether to force a refresh bypassing cache
 */
async function loadDashboardCounts(forceRefresh = false) {
  logger.info('Loading dashboard counts', { forceRefresh });

  // Show loading state for all cards
  const cards = document.querySelectorAll('.dashboard-card');
  cards.forEach(card => card.classList.add('loading'));

  try {
    // Get people count
    try {
      const people = await api.getPeople(forceRefresh);
      const peopleCount = people.length;
      document.getElementById('people-count').textContent = peopleCount;
    } catch (error) {
      logger.error('Error loading people count', { error: error.message });
      document.getElementById('people-count').textContent = '12'; // Demo fallback
      if (!forceRefresh) {
        showNotification('Error loading people count. Using demo data.', 'error');
      }
    }

    // Get vehicles count
    try {
      const vehicles = await api.getVehicles(forceRefresh);
      const vehiclesCount = vehicles.length;
      document.getElementById('vehicles-count').textContent = vehiclesCount;
    } catch (error) {
      logger.error('Error loading vehicles count', { error: error.message });
      document.getElementById('vehicles-count').textContent = '8'; // Demo fallback
      if (!forceRefresh) {
        showNotification('Error loading vehicles count. Using demo data.', 'error');
      }
    }

    // Get rounds count
    try {
      const rounds = await api.getRounds(forceRefresh);
      const roundsCount = rounds.length;
      document.getElementById('rounds-count').textContent = roundsCount;
    } catch (error) {
      logger.error('Error loading rounds count', { error: error.message });
      document.getElementById('rounds-count').textContent = '4'; // Demo fallback
      if (!forceRefresh) {
        showNotification('Error loading rounds count. Using demo data.', 'error');
      }
    }

    // Get alert count
    try {
      const alerts = await api.getAlerts('all', forceRefresh);
      const alertsCount = alerts.length;
      document.getElementById('alerts-count').textContent = alertsCount;
    } catch (error) {
      logger.error('Error loading alerts count', { error: error.message });
      document.getElementById('alerts-count').textContent = '3'; // Demo fallback
      if (!forceRefresh) {
        showNotification('Error loading alerts count. Using demo data.', 'error');
      }
    }

    logger.info('Dashboard counts updated');
  } catch (error) {
    logger.error('Error loading dashboard counts', { error: error.message });
    
    // Fall back to demo mode
    document.getElementById('people-count').textContent = '12';
    document.getElementById('vehicles-count').textContent = '8';
    document.getElementById('rounds-count').textContent = '4';
    document.getElementById('alerts-count').textContent = '3';
    
    if (!forceRefresh) {
      showNotification('Error loading dashboard data. Using demo data.', 'error');
    }
  } finally {
    // Remove loading state from all cards
    cards.forEach(card => card.classList.remove('loading'));
  }
}

module.exports = {
  initializeDashboard,
  loadDashboardCounts,
  addSplashEffect
}; 
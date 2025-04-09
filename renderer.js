// Import required modules
const { ipcRenderer } = require('electron');

// Global variable to track current alert filter
let currentAlertFilter = 'pending';

// Function to update alert supervised status - defined globally so it can be called from inline onclick handlers
window.markAlertSupervised = async function(id, status) {
    try {
        rendererLogger.info(`Updating alert ${id} to status: ${status}`);
        const result = await ipcRenderer.invoke('update-alert-supervised', id, status);
        
        if (result.success) {
            showNotification(`Alert status updated to ${status}`, 'success');
            // Reload the alerts tab with current filter
            loadAlerts(currentAlertFilter);
        } else {
            showNotification(`Failed to update alert status: ${result.message}`, 'error');
        }
    } catch (error) {
        rendererLogger.error('Error updating alert supervised status', { error: error.message });
        showNotification(`Error: ${error.message}`, 'error');
    }
};

// Create a logger wrapper for the renderer
const rendererLogger = {
  debug: (msg, data) => {
    console.debug(msg, data || '');
    ipcRenderer.invoke('log-message', { level: 'debug', message: msg, data });
  },
  info: (msg, data) => {
    console.info(msg, data || '');
    ipcRenderer.invoke('log-message', { level: 'info', message: msg, data });
  },
  warn: (msg, data) => {
    console.warn(msg, data || '');
    ipcRenderer.invoke('log-message', { level: 'warn', message: msg, data });
  },
  error: (msg, error, contextData = {}) => {
    // Handle different error formats
    let errorObj = error;
    
    if (typeof error === 'string') {
      errorObj = new Error(error);
    } else if (error && typeof error === 'object') {
      if (error instanceof Error) {
        errorObj = error;
      } else if (error.message) {
        errorObj = new Error(error.message);
        if (error.stack) errorObj.stack = error.stack;
      } else if (error.error) {
        // Handle { error: ... } format
        if (typeof error.error === 'string') {
          errorObj = new Error(error.error);
        } else if (error.error instanceof Error) {
          errorObj = error.error;
        } else {
          errorObj = new Error(JSON.stringify(error.error));
        }
        // Merge other context data
        contextData = { ...contextData, ...error, error: undefined };
      } else {
        // For generic objects, stringify them
        errorObj = new Error(JSON.stringify(error));
      }
    }
    
    // Log to console with stack trace
    console.error(msg, errorObj);
    
    // Send to main process with structured format
    ipcRenderer.invoke('log-message', { 
      level: 'error', 
      message: msg, 
      data: { 
        ...contextData,
        error: errorObj
      }
    });
  }
};

// Add global error handler
window.addEventListener('error', (event) => {
  rendererLogger.error('Uncaught exception', event.error || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Also handle promise rejections
window.addEventListener('unhandledrejection', (event) => {
  rendererLogger.error('Unhandled promise rejection', event.reason || 'Unknown reason', {
    promise: event.promise ? 'Promise present' : 'No promise reference'
  });
});

rendererLogger.info('Renderer started');

// Add this global flag at the top of the file, outside any functions
let importInitialized = false;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    rendererLogger.info('DOM loaded - initializing renderer');
    
    // Add a splash effect to the dashboard
    addSplashEffect();
    
    // Initialize tab system
    initializeTabs();
    
    // Load data counts for dashboard
    loadDashboardCounts();
    
    // Initialize import functionality ONLY ONCE
    if (!importInitialized) {
        initializeImport();
        importInitialized = true;
    }
});

// Add splash effect to dashboard
function addSplashEffect() {
    const container = document.querySelector('.container');
    if (container) {
        container.classList.add('fade-in');
        
        // Add staggered animations to dashboard cards
        const cards = document.querySelectorAll('.dashboard-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${0.1 + (index * 0.1)}s`;
        });
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Tab functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            rendererLogger.info('Tab clicked', { tabId });
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show selected tab content
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === tabId) {
                    pane.classList.add('active');
                    
                    // Load data based on which tab is active
                    if (tabId === 'vehicles-tab') {
                        loadVehicles();
                    } else if (tabId === 'people-tab') {
                        loadPeople();
                    } else if (tabId === 'rounds-tab') {
                        loadRounds();
                    } else if (tabId === 'alerts-tab') {
                        loadAlerts();
                    }
                }
            });
        });
    });
}

// Load vehicles data
async function loadVehicles() {
    rendererLogger.info('Loading vehicles data');
    const vehiclesContainer = document.querySelector('#vehicles-tab .data-container');
    
    if (!vehiclesContainer) {
        rendererLogger.error('Vehicles container not found');
        return;
    }
    
    try {
        const vehicles = await ipcRenderer.invoke('get-vehicles');
        
        if (!vehicles || vehicles.length === 0) {
            vehiclesContainer.innerHTML = '<div class="no-data-message">No vehicles found</div>';
            return;
        }
        
        // Display vehicles
        let html = '<div class="data-grid">';
        vehicles.forEach(vehicle => {
            html += `
                <div class="data-card">
                    <h3>${vehicle.plate_number || 'Unknown'}</h3>
                    <p>Type: ${vehicle.vehicle_type || 'Not specified'}</p>
                    <p>Status: ${vehicle.status || 'Unknown'}</p>
                </div>
            `;
        });
        html += '</div>';
        
        vehiclesContainer.innerHTML = html;
    } catch (error) {
        rendererLogger.error('Error loading vehicles', { error: error.message });
        vehiclesContainer.innerHTML = `<div class="error-message">Error loading vehicles: ${error.message}</div>`;
    }
}

// Load people data
async function loadPeople() {
    rendererLogger.info('Loading people data');
    const peopleContainer = document.querySelector('#people-tab .data-container');
    
    if (!peopleContainer) {
        rendererLogger.error('People container not found');
        return;
    }
    
    try {
        const people = await ipcRenderer.invoke('get-people');
        
        if (!people || people.length === 0) {
            peopleContainer.innerHTML = '<div class="no-data-message">No people found</div>';
            return;
        }
        
        // Display people
        let html = '<div class="data-grid">';
        people.forEach(person => {
            html += `
                <div class="data-card">
                    <h3>${person.name || 'Unknown'}</h3>
                    <p>Job Title: ${person.job_title || 'Not specified'}</p>
                    <p>Cost Center: ${person.cost_center || 'Not specified'}</p>
                    <p>Status: ${person.status || 'Unknown'}</p>
                </div>
            `;
        });
        html += '</div>';
        
        peopleContainer.innerHTML = html;
    } catch (error) {
        rendererLogger.error('Error loading people', { error: error.message });
        peopleContainer.innerHTML = `<div class="error-message">Error loading people: ${error.message}</div>`;
    }
}

// Load rounds data
async function loadRounds() {
    rendererLogger.info('Loading rounds data');
    const roundsContainer = document.querySelector('#rounds-tab .data-container');
    
    if (!roundsContainer) {
        rendererLogger.error('Rounds container not found');
        return;
    }
    
    try {
        const rounds = await ipcRenderer.invoke('get-rounds');
        
        if (!rounds || rounds.length === 0) {
            roundsContainer.innerHTML = '<div class="no-data-message">No rounds found</div>';
            return;
        }
        
        // Display rounds
        let html = '<div class="data-grid">';
        rounds.forEach(round => {
            html += `
                <div class="data-card">
                    <h3>${round.name || 'Round ' + round.id}</h3>
                    <p>Date: ${round.date || 'Not specified'}</p>
                    <p>Status: ${round.status || 'Unknown'}</p>
                </div>
            `;
        });
        html += '</div>';
        
        roundsContainer.innerHTML = html;
    } catch (error) {
        rendererLogger.error('Error loading rounds', { error: error.message });
        roundsContainer.innerHTML = `<div class="error-message">Error loading rounds: ${error.message}</div>`;
    }
}

// Load alerts data
async function loadAlerts(filterStatus = 'pending') {
    // Update the current filter state
    currentAlertFilter = filterStatus;
    
    rendererLogger.info('Loading alerts data');
    const alertsContainer = document.querySelector('#alerts-tab .data-container');
    
    if (!alertsContainer) {
        rendererLogger.error('Alerts container not found');
        return;
    }
    
    try {
        let alerts = await ipcRenderer.invoke('get-alerts');
        
        if (!alerts || alerts.length === 0) {
            alertsContainer.innerHTML = '<div class="no-data-message">No alerts found</div>';
            return;
        }
        
        // Sort by most recent first (should already be sorted by DESC in SQL query, but ensuring here)
        alerts.sort((a, b) => {
            return new Date(b.arrival_time || 0) - new Date(a.arrival_time || 0);
        });
        
        // Filter alerts based on selected status
        if (filterStatus !== 'all') {
            alerts = alerts.filter(alert => (alert.supervised || 'pending') === filterStatus);
        }
        
        // Create filter controls
        let filterHtml = `
            <div class="filter-controls">
                <label for="alert-filter">Filter by status:</label>
                <select id="alert-filter" class="select-dropdown">
                    <option value="pending" ${filterStatus === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="justified" ${filterStatus === 'justified' ? 'selected' : ''}>Justified</option>
                    <option value="unjustified" ${filterStatus === 'unjustified' ? 'selected' : ''}>Unjustified</option>
                    <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>All Alerts</option>
                </select>
            </div>
        `;
        
        // Display alerts
        let html = filterHtml + '<div class="data-grid">';
        
        if (alerts.length === 0) {
            html += `<div class="no-data-message">No ${filterStatus !== 'all' ? filterStatus : ''} alerts found</div>`;
        } else {
            alerts.forEach(alert => {
                // Determine status class and style
                let cardClass = 'alert-card';
                let statusBadge = '';
                
                // Default to 'pending' if supervised is not set
                const supervisedStatus = alert.supervised || 'pending';
                
                switch(supervisedStatus) {
                    case 'justified':
                        cardClass += ' resolved';  // Use resolved class for justified alerts
                        statusBadge = '<span class="badge badge-success">Justified</span>';
                        break;
                    case 'unjustified':
                        cardClass += ' ignored';   // Use ignored class for unjustified alerts
                        statusBadge = '<span class="badge badge-danger">Unjustified</span>';
                        break;
                    default:
                        statusBadge = '<span class="badge badge-warning">Pending</span>';
                }
                
                // Format arrival time
                let arrivalTime = alert.arrival_time || 'Unknown';
                try {
                    const date = new Date(arrivalTime);
                    if (!isNaN(date.getTime())) {
                        arrivalTime = date.toLocaleString();
                    }
                } catch (e) {
                    // Keep as is if can't parse
                }
                
                html += `
                    <div class="data-card ${cardClass}" data-id="${alert.id}">
                        <h3>${alert.plate_number || 'Unknown Vehicle'}</h3>
                        <div class="card-status">
                            ${statusBadge}
                        </div>
                        <div class="card-content">
                            <p><strong>Time:</strong> ${arrivalTime}</p>
                            <p><strong>Standing Duration:</strong> ${alert.status || 'Unknown'}</p>
                            <p><strong>Location:</strong> ${alert.position || 'Unknown'}</p>
                        </div>
                        <div class="card-actions">
                            ${alert.supervised !== 'justified' ? 
                                `<button class="action-btn btn-justify" data-id="${alert.id}" data-status="justified">Justified</button>` : ''}
                            ${alert.supervised !== 'unjustified' ? 
                                `<button class="action-btn btn-unjustify" data-id="${alert.id}" data-status="unjustified">Unjustified</button>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        html += '</div>';
        
        alertsContainer.innerHTML = html;
        
        // Add event listeners to buttons after HTML is rendered
        document.querySelectorAll('.btn-justify, .btn-unjustify').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const status = this.getAttribute('data-status');
                
                window.markAlertSupervised(id, status)
                    .catch(error => {
                        rendererLogger.error('Error in button click handler', { error: error.message });
                    });
            });
        });
        
        // Add filter change event listener
        const filterSelect = document.getElementById('alert-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', function() {
                loadAlerts(this.value);
            });
        }
    } catch (error) {
        rendererLogger.error('Error loading alerts', { error: error.message });
        alertsContainer.innerHTML = `<div class="error-message">Error loading alerts: ${error.message}</div>`;
    }
}

// Load dashboard counts
async function loadDashboardCounts() {
    rendererLogger.info('Loading dashboard counts');
    
    try {
        // Get people count
        let peopleCount = 0;
        try {
            const people = await ipcRenderer.invoke('get-people');
            peopleCount = people ? people.length : 0;
        } catch (error) {
            rendererLogger.error('Error loading people count', { error: error.message });
            peopleCount = 12; // Demo fallback
        }
        document.getElementById('people-count').textContent = peopleCount;
        
        // Get vehicles count
        let vehiclesCount = 0;
        try {
            const vehicles = await ipcRenderer.invoke('get-vehicles');
            vehiclesCount = vehicles ? vehicles.length : 0;
        } catch (error) {
            rendererLogger.error('Error loading vehicles count', { error: error.message });
            vehiclesCount = 8; // Demo fallback
        }
        document.getElementById('vehicles-count').textContent = vehiclesCount;
        
        // Get rounds count
        let roundsCount = 0;
        try {
            const rounds = await ipcRenderer.invoke('get-rounds');
            roundsCount = rounds ? rounds.length : 0;
        } catch (error) {
            rendererLogger.error('Error loading rounds count', { error: error.message });
            roundsCount = 4; // Demo fallback
        }
        document.getElementById('rounds-count').textContent = roundsCount;
        
        // Get alert count
        let alertsCount = 0;
        try {
            const alerts = await ipcRenderer.invoke('get-alerts');
            alertsCount = alerts ? alerts.length : 0;
        } catch (error) {
            rendererLogger.error('Error loading alerts count', { error: error.message });
            alertsCount = 3; // Demo fallback
        }
        document.getElementById('alerts-count').textContent = alertsCount;
        
        rendererLogger.info('Dashboard counts updated', { 
            peopleCount, 
            vehiclesCount, 
            roundsCount,
            alertsCount 
        });
    } catch (error) {
        rendererLogger.error('Error loading dashboard counts', { error: error.message });
        // Fall back to demo mode
        document.getElementById('people-count').textContent = '12';
        document.getElementById('vehicles-count').textContent = '8';
        document.getElementById('rounds-count').textContent = '4';
        document.getElementById('alerts-count').textContent = '3';
    }
}

// Initialize Excel Preview component when the Import tab is active - but don't add event listeners
const importTabBtn = document.querySelector('.tab-btn[data-tab="import-tab"]');
if (importTabBtn) {
    importTabBtn.addEventListener('click', () => {
        rendererLogger.info('Import tab activated');
        // Don't add any button event handlers here - they're now in initializeImport()
    });
}

// Import functionality
function initializeImport() {
    rendererLogger.info('Initializing import functionality');
    
    // Get DOM elements
    let selectFileBtn = document.getElementById('select-file-btn');
    const selectedFilePath = document.getElementById('selected-file-path');
    let importDataBtn = document.getElementById('import-data-btn');
    let clearImportBtn = document.getElementById('clear-import-btn');
    const importStatus = document.getElementById('import-status');
    const importTypeSelector = document.getElementById('import-type-selector');
    const importedRecords = document.getElementById('imported-records');
    const importLoading = document.getElementById('import-loading');
    
    let excelFilePath = null;
    let currentImportType = 'autodetect';
    let previewData = null;
    
    // Load preview modules
    const excelPreview = require('./src/excelPreview.js');
    const { displaySysWebPreview } = excelPreview;
    
    if (importTypeSelector) {
        // Update the options to include the new import type
        importTypeSelector.innerHTML = `
            <option value="autodetect">Auto-detect</option>
            <option value="sysweb">SysWeb</option>
            <option value="alerts">Alerts</option>
            <option value="ifleet">iFleet</option>
            <option value="routes">Routes (Járatok)</option>
        `;
        
        importTypeSelector.addEventListener('change', (event) => {
            currentImportType = event.target.value;
            rendererLogger.info(`Import type changed to: ${currentImportType}`);
            
            // Reset preview data when import type changes
            previewData = null;
            
            // If a file was already selected, enable the import button
            if (excelFilePath) {
                importDataBtn.disabled = false;
            }
        });
    }
    
    // File selection - remove existing listeners first
    if (selectFileBtn) {
        // Remove existing listeners to prevent duplicates
        const newSelectBtn = selectFileBtn.cloneNode(true);
        selectFileBtn.parentNode.replaceChild(newSelectBtn, selectFileBtn);
        selectFileBtn = newSelectBtn;
        
        selectFileBtn.addEventListener('click', async () => {
            try {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('open-file-dialog', {
                    title: 'Select Excel File',
                    filters: [
                        { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
                    ]
                });
                
                if (result && result.filePaths && result.filePaths.length > 0) {
                    excelFilePath = result.filePaths[0];
                    selectedFilePath.textContent = excelFilePath;
                    importDataBtn.disabled = false;
                    
                    // Reset preview data when new file is selected
                    previewData = null;
                    
                    rendererLogger.info('File selected for import', { filePath: excelFilePath });
                    showImportStatus('File selected. Click "Process" to import data.', 'info');
                }
            } catch (error) {
                rendererLogger.error('Error selecting file', { error: error.message });
                showImportStatus('Error selecting file: ' + error.message, 'error');
            }
        });
    }
    
    // Clear import - remove existing listeners first
    if (clearImportBtn) {
        // Remove existing listeners to prevent duplicates
        const newClearBtn = clearImportBtn.cloneNode(true);
        clearImportBtn.parentNode.replaceChild(newClearBtn, clearImportBtn);
        clearImportBtn = newClearBtn;
        
        clearImportBtn.addEventListener('click', () => {
            excelFilePath = null;
            selectedFilePath.textContent = 'No file selected';
            importDataBtn.disabled = true;
            importedRecords.innerHTML = '<p>Import data to see records.</p>';
            previewData = null;
            showImportStatus('', '');
        });
    }
    
    // Process data button - add immediate display for successfully imported data
    if (importDataBtn) {
        // Remove existing listeners to prevent duplicates
        const newImportBtn = importDataBtn.cloneNode(true);
        importDataBtn.parentNode.replaceChild(newImportBtn, importDataBtn);
        importDataBtn = newImportBtn;
        
        importDataBtn.addEventListener('click', async () => {
            rendererLogger.info('Process imported data button clicked');
            
            if (!excelFilePath) {
                showImportStatus('Please select a file first', 'error');
                return;
            }
            
            // Show loading indicator
            if (importLoading) importLoading.style.display = 'flex';
            
            try {
                const { ipcRenderer } = require('electron');
                showImportStatus(`Parsing ${currentImportType} data...`, 'info');
                
                // First, just parse the data without importing
                let result;
                
                // Parse based on the import type
                switch (currentImportType) {
                    case 'worktime':
                    case 'sysweb':
                        // For SysWeb/worktime, we need to preview first
                        rendererLogger.info('Parsing SysWeb data for preview', { filePath: excelFilePath });
                        result = await ipcRenderer.invoke('parse-sysweb-excel', excelFilePath);
                        break;
                    case 'alerts':
                    case 'ifleet':
                    case 'autodetect':
                    case 'routes':
                    default:
                        // For other types, proceed directly to import
                        rendererLogger.info(`Importing ${currentImportType} data directly`, { filePath: excelFilePath });
                        result = await performDirectImport(excelFilePath, currentImportType);
                        break;
                }
                
                if (importLoading) importLoading.style.display = 'none';
                
                rendererLogger.debug('Parse result', result);
                
                if (result && result.success) {
                    // For SysWeb/worktime, show preview before final import
                    if ((currentImportType === 'worktime' || currentImportType === 'sysweb') && result.data) {
                        previewData = result.data;
                        showImportStatus('Data parsed successfully. Please review and confirm import.', 'success');
                        
                        // Show preview
                        displaySysWebPreview(previewData, importedRecords);
                    } else {
                        // For other types, we already performed the import
                        showImportStatus(result.message, 'success');
                        
                        // Immediately show the imported data
                        displayImportedData(currentImportType);
                    }
                } else {
                    const errorMessage = `Parse failed: ${result ? result.message : 'Unknown error'}`;
                    rendererLogger.error('Excel parsing failed', result ? 
                        (result.error || result.message || 'Unknown error') : 
                        'No result returned from parser');
                    showImportStatus(errorMessage, 'error');
                }
            } catch (error) {
                rendererLogger.error('Error processing data', error, {
                    importType: currentImportType,
                    filePath: excelFilePath
                });
                showImportStatus(`Error processing data: ${error.message}`, 'error');
                if (importLoading) importLoading.style.display = 'none';
            }
        });
    }
    
    // Listen for preview confirmation events from excelPreview.js
    document.addEventListener('sysweb-import-confirmed', async (event) => {
        if (!event.detail || !event.detail.data) {
            showImportStatus('No data available for import', 'error');
            return;
        }
        
        // Show loading indicator
        if (importLoading) importLoading.style.display = 'flex';
        
        try {
            const { ipcRenderer } = require('electron');
            showImportStatus('Importing data to database...', 'info');
            
            // Perform the actual import
            const result = await ipcRenderer.invoke('import-sysweb-data', event.detail.data);
            
            if (importLoading) importLoading.style.display = 'none';
            
            if (result && result.success) {
                showImportStatus(result.message, 'success');
                // Refresh the display with data from database
                displayImportedData('worktime');
                
                // Hide the preview controls since we've completed the import
                const confirmControls = importedRecords.querySelector('.preview-controls');
                if (confirmControls) {
                    confirmControls.style.display = 'none';
                }
            } else {
                showImportStatus(`Import failed: ${result ? result.message : 'Unknown error'}`, 'error');
            }
        } catch (error) {
            rendererLogger.error('Error importing confirmed data', { error: error.message });
            showImportStatus(`Error importing data: ${error.message}`, 'error');
            if (importLoading) importLoading.style.display = 'none';
        }
    });
    
    // Helper function for direct import (non-previewed types)
    async function performDirectImport(filePath, importType) {
        const { ipcRenderer } = require('electron');
        let result;
        
        switch (importType) {
            case 'alerts':
                result = await ipcRenderer.invoke('import-alerts-excel', filePath);
                break;
            case 'ifleet':
                result = await ipcRenderer.invoke('import-ifleet-excel', filePath);
                break;
            case 'routes':
                result = await ipcRenderer.invoke('import-routes-excel', filePath);
                break;
            case 'sysweb':
                result = await ipcRenderer.invoke('import-sysweb-excel', filePath);
                break;
            case 'autodetect':
            default:
                result = await ipcRenderer.invoke('import-autodetect-excel', filePath);
                break;
        }
        
        return result;
    }
    
    // Helper function to show import status
    function showImportStatus(message, type) {
        if (!importStatus) return;
        
        importStatus.textContent = message;
        importStatus.className = 'status-message';
        
        if (type) {
            importStatus.classList.add(`status-${type}`);
        }
    }
    
    // Helper function to display imported data
    function displayImportedData(dataType) {
        if (!importedRecords) return;
        
        // Set a loading message
        importedRecords.innerHTML = '<p>Loading imported data...</p>';
        
        // Different display logic based on data type
        switch (dataType) {
            case 'worktime':
            case 'sysweb':  // Add support for the 'sysweb' type from dropdown
                displaySysWebImportedData();
                break;
            case 'alerts':
                displayAlertsImportedData();
                break;
            case 'ifleet':
                displayIFleetImportedData();
                break;
            case 'routes':
                displayRoutesImportedData();
                break;
            default:
                importedRecords.innerHTML = '<p>No data available to display.</p>';
                break;
        }
    }
    
    // Format date consistently as YYYY-MM-DD
    function formatDateYYYYMMDD(dateValue) {
        if (!dateValue) return '';
        
        try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        } catch (e) {
            // Keep as is if can't parse
        }
        
        return dateValue;
    }
    
    // Function to display SysWeb data from the database
    async function displaySysWebImportedData() {
        try {
            const { ipcRenderer } = require('electron');
            const data = await ipcRenderer.invoke('get-sysweb-data');
            
            if (!data || data.length === 0) {
                importedRecords.innerHTML = '<div class="empty-state"><p>No SysWeb data found in the database.</p><p>Import data first to see records here.</p></div>';
                return;
            }
            
            // Process and prepare data
            const processedData = data.map(record => {
                return {
                    ...record,
                    // Ensure dates are properly formatted
                    formattedDate: formatDateYYYYMMDD(record.date),
                    formattedCheckIn: record.check_in || '',
                    formattedCheckOut: record.check_out || '',
                    // Calculate duration if possible
                    duration: calculateDuration(record.check_in, record.check_out)
                };
            });
            
            // Group by name for display
            const groupedData = {};
            processedData.forEach(record => {
                if (!groupedData[record.name]) {
                    groupedData[record.name] = [];
                }
                groupedData[record.name].push(record);
            });
            
            // Sort each person's records by date (newest first)
            Object.keys(groupedData).forEach(name => {
                groupedData[name].sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    return dateB - dateA; // Newest first
                });
            });
            
            // Generate summary
            const totalPeople = Object.keys(groupedData).length;
            const totalRecords = processedData.length;
            
            let html = `
                <div class="dashboard-summary">
                    <div class="summary-card">
                        <div class="summary-title">Total Employees</div>
                        <div class="summary-value">${totalPeople}</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-title">Total Records</div>
                        <div class="summary-value">${totalRecords}</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-title">Date Range</div>
                        <div class="summary-value">${getDateRange(processedData)}</div>
                    </div>
                </div>
                
                <div class="filter-controls">
                    <div class="search-box">
                        <input type="text" id="sysweb-search" class="form-control" placeholder="Search by name or job title...">
                    </div>
                    <div class="sort-controls">
                        <label for="sort-select">Sort by:</label>
                        <select id="sort-select" class="form-control">
                            <option value="name-asc">Name (A-Z)</option>
                            <option value="name-desc">Name (Z-A)</option>
                            <option value="date-desc" selected>Date (Newest First)</option>
                            <option value="date-asc">Date (Oldest First)</option>
                        </select>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="data-table" id="sysweb-table">
                        <thead>
                            <tr>
                                <th class="sortable" data-sort="name">Name</th>
                                <th class="sortable" data-sort="jobtitle">Job Title</th>
                                <th class="sortable" data-sort="costcenter">Cost Center</th>
                                <th class="sortable" data-sort="date">Date</th>
                                <th>Planned Shift</th>
                                <th>Actual</th>
                                <th>Check In</th>
                                <th>Check Out</th>
                                <th>Worked Time</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            // Sort people alphabetically initially
            const sortedNames = Object.keys(groupedData).sort();
            
            // Add rows for each person's records
            sortedNames.forEach(name => {
                const personRecords = groupedData[name];
                
                // Add a subtle group header
                html += `
                    <tr class="group-header">
                        <td colspan="9">
                            <div class="person-header">
                                <span class="person-name">${name}</span>
                                <span class="record-count">${personRecords.length} records</span>
                            </div>
                        </td>
                    </tr>
                `;
                
                // Add individual records
                personRecords.forEach(record => {
                    html += `
                        <tr data-name="${record.name}" data-date="${record.formattedDate}">
                            <td>${record.name || ''}</td>
                            <td>${record.jobtitle || ''}</td>
                            <td>${record.costcenter || ''}</td>
                            <td>${record.formattedDate}</td>
                            <td>${record.planedshift || ''}</td>
                            <td>${record.actual || ''}</td>
                            <td>${record.formattedCheckIn}</td>
                            <td>${record.formattedCheckOut}</td>
                            <td>${record.workedTime || record.duration || ''}</td>
                        </tr>
                    `;
                });
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            importedRecords.innerHTML = html;
            
            // Add event listeners for sorting and filtering
            setupSysWebTableInteractions();
            
        } catch (error) {
            rendererLogger.error('Error displaying SysWeb data', { error: error.message });
            importedRecords.innerHTML = `<p class="error">Error displaying data: ${error.message}</p>`;
        }
    }
    
    // Helper function to calculate duration between check-in and check-out
    function calculateDuration(checkIn, checkOut) {
        if (!checkIn || !checkOut) return '';
        
        try {
            // Parse the time values (assuming format like "08:30")
            const [inHours, inMinutes] = checkIn.split(':').map(Number);
            const [outHours, outMinutes] = checkOut.split(':').map(Number);
            
            if (isNaN(inHours) || isNaN(inMinutes) || isNaN(outHours) || isNaN(outMinutes)) {
                return '';
            }
            
            // Calculate total minutes
            const inTotalMinutes = inHours * 60 + inMinutes;
            const outTotalMinutes = outHours * 60 + outMinutes;
            let diffMinutes = outTotalMinutes - inTotalMinutes;
            
            // Handle overnight shifts
            if (diffMinutes < 0) {
                diffMinutes += 24 * 60; // Add a day
            }
            
            // Format as hours and minutes
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;
            return `${hours}:${minutes.toString().padStart(2, '0')}`;
        } catch (e) {
            return '';
        }
    }
    
    // Helper function to get date range from records
    function getDateRange(records) {
        if (!records || records.length === 0) return 'N/A';
        
        try {
            const dates = records
                .map(r => new Date(r.date))
                .filter(d => !isNaN(d.getTime()))
                .sort((a, b) => a - b);
            
            if (dates.length === 0) return 'N/A';
            
            const earliest = formatDateYYYYMMDD(dates[0]);
            const latest = formatDateYYYYMMDD(dates[dates.length - 1]);
            
            return earliest === latest ? earliest : `${earliest} to ${latest}`;
        } catch (e) {
            return 'N/A';
        }
    }
    
    // Setup event listeners for SysWeb table filtering and sorting
    function setupSysWebTableInteractions() {
        const searchInput = document.getElementById('sysweb-search');
        const sortSelect = document.getElementById('sort-select');
        const table = document.getElementById('sysweb-table');
        
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                filterSysWebTable(searchTerm);
            });
        }
        
        if (sortSelect) {
            sortSelect.addEventListener('change', function() {
                sortSysWebTable(this.value);
            });
        }
        
        if (table) {
            const headers = table.querySelectorAll('th.sortable');
            headers.forEach(header => {
                header.addEventListener('click', function() {
                    const sortField = this.getAttribute('data-sort');
                    const currentSort = sortSelect.value;
                    
                    // Toggle ascending/descending
                    let newSort;
                    if (currentSort === `${sortField}-asc`) {
                        newSort = `${sortField}-desc`;
                    } else {
                        newSort = `${sortField}-asc`;
                    }
                    
                    sortSelect.value = newSort;
                    sortSysWebTable(newSort);
                });
            });
        }
    }
    
    // Filter the SysWeb table based on search term
    function filterSysWebTable(searchTerm) {
        const table = document.getElementById('sysweb-table');
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        let visibleRows = 0;
        
        rows.forEach(row => {
            // Skip group headers in search
            if (row.classList.contains('group-header')) {
                row.style.display = 'none';
                return;
            }
            
            const text = row.textContent.toLowerCase();
            const shouldShow = text.includes(searchTerm);
            
            row.style.display = shouldShow ? '' : 'none';
            if (shouldShow) visibleRows++;
            
            // Show group header if at least one row is visible
            const name = row.getAttribute('data-name');
            if (shouldShow && name) {
                const groupHeaders = table.querySelectorAll(`.group-header`);
                groupHeaders.forEach(header => {
                    if (header.textContent.includes(name)) {
                        header.style.display = '';
                    }
                });
            }
        });
        
        // Show message if no results
        const noResults = document.getElementById('no-results-message');
        if (visibleRows === 0) {
            if (!noResults) {
                const tbody = table.querySelector('tbody');
                const message = document.createElement('tr');
                message.id = 'no-results-message';
                message.innerHTML = `<td colspan="9" class="text-center">No results found for "${searchTerm}"</td>`;
                tbody.appendChild(message);
            }
        } else if (noResults) {
            noResults.remove();
        }
    }
    
    // Sort the SysWeb table based on selected option
    function sortSysWebTable(sortOption) {
        const table = document.getElementById('sysweb-table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        // Parse sort option
        const [field, direction] = sortOption.split('-');
        const isAsc = direction === 'asc';
        
        // Get all group headers
        const groupHeaders = Array.from(tbody.querySelectorAll('.group-header'));
        
        // Get all data rows grouped by person
        const rowGroups = {};
        groupHeaders.forEach(header => {
            const name = header.querySelector('.person-name').textContent;
            rowGroups[name] = [];
            
            // Get all rows until next group header
            let nextRow = header.nextElementSibling;
            while (nextRow && !nextRow.classList.contains('group-header')) {
                if (!nextRow.id || nextRow.id !== 'no-results-message') {
                    rowGroups[name].push(nextRow);
                }
                nextRow = nextRow.nextElementSibling;
            }
        });
        
        // Sort the group names
        const sortedNames = Object.keys(rowGroups).sort((a, b) => {
            if (field === 'name') {
                return isAsc ? a.localeCompare(b) : b.localeCompare(a);
            }
            return 0; // Default if not sorting by name
        });
        
        // Sort rows within each group if sorting by date
        if (field === 'date') {
            Object.keys(rowGroups).forEach(name => {
                rowGroups[name].sort((rowA, rowB) => {
                    const dateA = rowA.getAttribute('data-date');
                    const dateB = rowB.getAttribute('data-date');
                    return isAsc
                        ? dateA.localeCompare(dateB)
                        : dateB.localeCompare(dateA);
                });
            });
        }
        
        // Clear the table
        tbody.innerHTML = '';
        
        // Rebuild the table in the sorted order
        sortedNames.forEach(name => {
            // Add group header
            const header = document.createElement('tr');
            header.className = 'group-header';
            header.innerHTML = `
                <td colspan="9">
                    <div class="person-header">
                        <span class="person-name">${name}</span>
                        <span class="record-count">${rowGroups[name].length} records</span>
                    </div>
                </td>
            `;
            tbody.appendChild(header);
            
            // Add all rows for this person
            rowGroups[name].forEach(row => {
                tbody.appendChild(row.cloneNode(true));
            });
        });
    }
} 
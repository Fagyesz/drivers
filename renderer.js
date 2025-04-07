// Import required modules
const { ipcRenderer } = require('electron');

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
    
    // Add event listener for demo data button
    const insertDemoDataBtn = document.getElementById('insert-demo-data-btn');
    if (insertDemoDataBtn) {
        insertDemoDataBtn.addEventListener('click', async () => {
            try {
                rendererLogger.info('Inserting demo data...');
                insertDemoDataBtn.disabled = true;
                insertDemoDataBtn.textContent = 'Loading...';
                
                // Add loading animation to dashboard cards
                document.querySelectorAll('.dashboard-card').forEach(card => {
                    card.classList.add('loading');
                });
                
                const result = await ipcRenderer.invoke('insert-demo-data');
                
                if (result.success) {
                    rendererLogger.info('Demo data inserted successfully');
                    // Show success notification
                    showNotification('Demo data inserted successfully!', 'success');
                    
                    // Reload the data on all tabs
                    loadDashboardCounts();
                    loadVehicles();
                    loadPeople();
                    loadRounds();
                    loadAlerts();
                } else {
                    rendererLogger.error('Error inserting demo data', { error: result.error });
                    showNotification('Error inserting demo data', 'error');
                }
            } catch (error) {
                rendererLogger.error('Error inserting demo data', { error: error.message });
                showNotification('Error inserting demo data', 'error');
            } finally {
                insertDemoDataBtn.disabled = false;
                insertDemoDataBtn.textContent = 'Insert Demo Data';
                
                // Remove loading animation
                document.querySelectorAll('.dashboard-card').forEach(card => {
                    card.classList.remove('loading');
                });
            }
        });
    }
    
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
async function loadAlerts() {
    rendererLogger.info('Loading alerts data');
    const alertsContainer = document.querySelector('#alerts-tab .data-container');
    
    if (!alertsContainer) {
        rendererLogger.error('Alerts container not found');
        return;
    }
    
    try {
        rendererLogger.info('Calling ipcRenderer.invoke("get-alerts")');
        const alerts = await ipcRenderer.invoke('get-alerts');
        rendererLogger.info(`Received alerts response with ${alerts ? alerts.length : 0} items`);
        
        if (!alerts || alerts.length === 0) {
            rendererLogger.info('No alerts returned, displaying no data message');
            alertsContainer.innerHTML = '<div class="no-data-message">No alerts found</div>';
            return;
        }
        
        // Sample log the first alert for debugging
        rendererLogger.info('First alert in response:', alerts[0]);
        
        // Display alerts
        let html = '<div class="data-grid">';
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
                    <div class="card-content">
                        <p><strong>Time:</strong> ${arrivalTime}</p>
                        <p><strong>Standing Duration:</strong> ${alert.status || 'Unknown'}</p>
                        <p><strong>Location:</strong> ${alert.position || 'Unknown'}</p>
                        <p><strong>Company:</strong> ${alert.important_point || 'Not specified'}</p>
                        <p><strong>Status:</strong> ${statusBadge}</p>
                    </div>
                    <div class="card-actions">
                        ${alert.supervised !== 'justified' ? 
                            `<button class="action-btn btn-justify" data-action="resolve" data-id="${alert.id}">Justified</button>` : ''}
                        ${alert.supervised !== 'unjustified' ? 
                            `<button class="action-btn btn-unjustify" data-action="ignore" data-id="${alert.id}">Unjustified</button>` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        alertsContainer.innerHTML = html;
        rendererLogger.info('Alerts successfully rendered');
        
        // Add event listeners to the buttons
        document.querySelectorAll('#alerts-tab .btn-justify').forEach(button => {
            button.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                await updateAlertSupervised(id, 'justified');
                loadAlerts(); // Reload the alerts tab
            });
        });
        
        document.querySelectorAll('#alerts-tab .btn-unjustify').forEach(button => {
            button.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                await updateAlertSupervised(id, 'unjustified');
                loadAlerts(); // Reload the alerts tab
            });
        });
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
    
    // Process data button - remove existing listeners first
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
                        // For SysWeb/worktime, we need to preview first
                        rendererLogger.info('Parsing SysWeb data for preview', { filePath: excelFilePath });
                        result = await ipcRenderer.invoke('parse-sysweb-excel', excelFilePath);
                        break;
                    case 'alerts':
                    case 'ifleet':
                    case 'autodetect':
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
                    if (currentImportType === 'worktime' && result.data) {
                        previewData = result.data;
                        showImportStatus('Data parsed successfully. Please review and confirm import.', 'success');
                        
                        // Show preview
                        displaySysWebPreview(previewData, importedRecords);
                    } else {
                        // For other types, we already performed the import
                        showImportStatus(result.message, 'success');
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
                displaySysWebImportedData();
                break;
            case 'alerts':
                displayAlertsImportedData();
                break;
            case 'ifleet':
                displayIFleetImportedData();
                break;
            default:
                importedRecords.innerHTML = '<p>No data available to display.</p>';
                break;
        }
    }
    
    // Function to display SysWeb data from the database
    async function displaySysWebImportedData() {
        try {
            const { ipcRenderer } = require('electron');
            const data = await ipcRenderer.invoke('get-sysweb-data');
            
            if (!data || data.length === 0) {
                importedRecords.innerHTML = '<p>No SysWeb data found in the database.</p>';
                return;
            }
            
            // Group by name for display
            const groupedData = {};
            data.forEach(record => {
                if (!groupedData[record.name]) {
                    groupedData[record.name] = [];
                }
                groupedData[record.name].push(record);
            });
            
            let html = `
                <div class="table-summary">
                    <p>Showing ${data.length} records for ${Object.keys(groupedData).length} people.</p>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Job Title</th>
                                <th>Cost Center</th>
                                <th>Date</th>
                                <th>Planned Shift</th>
                                <th>Actual</th>
                                <th>Check In</th>
                                <th>Check Out</th>
                                <th>Worked Time</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.forEach(record => {
                html += `
                    <tr>
                        <td>${record.name || ''}</td>
                        <td>${record.jobtitle || ''}</td>
                        <td>${record.costcenter || ''}</td>
                        <td>${record.date || ''}</td>
                        <td>${record.planedshift || ''}</td>
                        <td>${record.actual || ''}</td>
                        <td>${record.check_in || ''}</td>
                        <td>${record.check_out || ''}</td>
                        <td>${record.workedTime || ''}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            importedRecords.innerHTML = html;
        } catch (error) {
            rendererLogger.error('Error displaying SysWeb data', { error: error.message });
            importedRecords.innerHTML = `<p class="error">Error displaying data: ${error.message}</p>`;
        }
    }
    
    // Function to display Alerts data from the database
    async function displayAlertsImportedData() {
        try {
            const { ipcRenderer } = require('electron');
            const data = await ipcRenderer.invoke('get-alerts-data');
            
            if (!data || data.length === 0) {
                importedRecords.innerHTML = '<p>No alert data available. Import data first.</p>';
                return;
            }
            
            // Group by plate number and filter out duplicates
            const groupedByPlate = {};
            const seenEntries = new Set(); // Track unique entries
            const allRecords = []; // Keep track of all valid records for initial display
            
            data.forEach(record => {
                const plate = record.plate_number || 'Unknown';
                // Skip invalid plate numbers/header data
                if (plate.toLowerCase().includes('rendszám') || 
                    plate.toLowerCase().includes('terület') || 
                    plate.toLowerCase().includes('telephely') ||
                    plate === 'Unknown' ||
                    !isValidPlateNumber(plate)) {
                    return;
                }
                
                // Create a unique key for this record to deduplicate
                const uniqueKey = `${plate}-${record.arrival_time}-${record.position}`;
                if (seenEntries.has(uniqueKey)) {
                    return; // Skip duplicates
                }
                seenEntries.add(uniqueKey);
                
                if (!groupedByPlate[plate]) {
                    groupedByPlate[plate] = [];
                }
                
                // Format the record
                const formattedRecord = formatAlertRecord(record);
                groupedByPlate[plate].push(formattedRecord);
                allRecords.push(formattedRecord); // Add to all records for initial display
            });
            
            // Get unique valid plate numbers
            const validPlates = Object.keys(groupedByPlate).filter(plate => 
                isValidPlateNumber(plate)
            );
            
            // Helper function to format a record
            function formatAlertRecord(record) {
                // Format arrival time
                let arrivalTime = record.arrival_time;
                if (arrivalTime) {
                    try {
                        const date = new Date(arrivalTime);
                        if (!isNaN(date.getTime())) {
                            arrivalTime = date.toLocaleString();
                        }
                    } catch (e) {
                        // Keep as is if can't parse
                    }
                }
                
                // Keep the original important_point value as is - it contains company names
                let importantPoint = record.important_point;
                
                return {
                    plate_number: record.plate_number || '',
                    arrival_time: arrivalTime || '',
                    status: record.status || '',
                    position: record.position || '',
                    important_point: importantPoint
                };
            }
            
            // Helper function to validate plate numbers
            function isValidPlateNumber(plate) {
                // Must contain hyphen, be between 5-10 chars, and not contain header-like terms
                return plate !== 'Unknown' && 
                       plate.includes('-') && 
                       plate.length >= 5 && 
                       plate.length <= 10 &&
                       !plate.toLowerCase().includes('rendszám') &&
                       !plate.toLowerCase().includes('terület') &&
                       !plate.toLowerCase().includes('telephely') &&
                       !plate.toLowerCase().includes('időpont') &&
                       !plate.toLowerCase().includes('irány') &&
                       !plate.toLowerCase().includes('töltött') &&
                       !plate.toLowerCase().includes('megtett');
            }
            
            // Count total records after deduplication
            const totalRecords = Object.values(groupedByPlate).reduce(
                (sum, records) => sum + records.length, 0
            );
            
            let html = `
                <div class="table-summary">
                    <p>Showing ${totalRecords} records for ${validPlates.length} vehicles.</p>
                </div>
            `;
            
            // Create selection dropdown for vehicles
            html += `
                <div class="vehicle-filter">
                    <select id="alert-vehicle-selector" class="form-control select-dropdown">
                        <option value="">-- All Vehicles --</option>
                        ${validPlates.map(plate => `<option value="${plate}">${plate} (${groupedByPlate[plate].length} records)</option>`).join('')}
                    </select>
                </div>
            `;
            
            // Add confirm import button
            html += `
                <div class="preview-controls preview-button-container">
                    <button id="confirm-alert-import" class="btn btn-success import-btn">Import to DB</button>
                    <button id="cancel-alert-import" class="btn btn-secondary clear-btn">Clear</button>
                </div>
            `;
            
            // Create a table for data display
            html += `
                <div class="data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Plate Number</th>
                                <th>Arrival Time</th>
                                <th>Standing Duration</th>
                                <th>Position</th>
                                <th>Important Point</th>
                            </tr>
                        </thead>
                        <tbody id="alert-vehicle-data">
                        </tbody>
                    </table>
                </div>
            `;
            
            // Render the HTML
            importedRecords.innerHTML = html;
            
            // Create a map of formatted records for each vehicle
            const formattedRecords = {};
            
            validPlates.forEach(plate => {
                const records = groupedByPlate[plate];
                
                // Sort records by arrival time
                records.sort((a, b) => {
                    return new Date(a.arrival_time) - new Date(b.arrival_time);
                });
                
                formattedRecords[plate] = records;
            });
            
            // Function to display records in the table
            function displayRecords(records) {
                const vehicleDataContainer = document.getElementById('alert-vehicle-data');
                if (!vehicleDataContainer) return;
                
                if (!records || records.length === 0) {
                    vehicleDataContainer.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center">No records found</td>
                        </tr>
                    `;
                    return;
                }
                
                // Render the records
                let rowsHtml = '';
                records.forEach(record => {
                    rowsHtml += `
                        <tr>
                            <td>${record.plate_number}</td>
                            <td>${record.arrival_time}</td>
                            <td>${record.status}</td>
                            <td>${record.position}</td>
                            <td>${record.important_point}</td>
                        </tr>
                    `;
                });
                
                vehicleDataContainer.innerHTML = rowsHtml;
            }
            
            // Display all records by default
            displayRecords(allRecords);
            
            // Add event listener to the vehicle selector
            const vehicleSelector = document.getElementById('alert-vehicle-selector');
            if (vehicleSelector) {
                vehicleSelector.addEventListener('change', function() {
                    const selectedPlate = this.value;
                    
                    if (!selectedPlate) {
                        // Show all records when "All Vehicles" is selected
                        displayRecords(allRecords);
                        return;
                    }
                    
                    const records = formattedRecords[selectedPlate] || [];
                    displayRecords(records);
                });
            }
            
            // Add event listener for confirm import button
            const confirmImportBtn = document.getElementById('confirm-alert-import');
            if (confirmImportBtn) {
                confirmImportBtn.addEventListener('click', async function() {
                    try {
                        if (importLoading) importLoading.style.display = 'flex';
                        showImportStatus('Importing valid alert data to database...', 'info');
                        
                        // Filter data to include only valid plate numbers AND deduplicate at the same time
                        const uniqueRecords = new Map();
                        
                        // First pass - collect only valid plate records with unique keys
                        data.forEach(record => {
                            const plate = record.plate_number || '';
                            
                            // Skip records with invalid or header-like data
                            if (!isValidPlateNumber(plate)) return;
                            
                            // Create a unique key for each record to avoid duplicates
                            const uniqueKey = `${plate}-${record.arrival_time}-${record.position}`;
                            
                            // Only keep the first occurrence of each unique entry
                            if (!uniqueRecords.has(uniqueKey)) {
                                uniqueRecords.set(uniqueKey, record);
                            }
                        });
                        
                        // Convert the Map values to an array
                        const validData = Array.from(uniqueRecords.values());
                        
                        // Log the deduplication results
                        console.log(`Filtered from ${data.length} records to ${validData.length} unique records for import`);
                        
                        // Trigger the final database update with only unique valid plate numbers
                        const result = await ipcRenderer.invoke('confirm-alert-import', validData);
                        
                        if (importLoading) importLoading.style.display = 'none';
                        
                        if (result && result.success) {
                            showImportStatus(`Successfully imported ${validPlates.length} vehicles (${validData.length} unique records) to database`, 'success');
                            
                            // Dispatch event 
                            const event = new CustomEvent('alert-import-confirmed', {
                                detail: { 
                                    data: validData,
                                    success: true
                                }
                            });
                            document.dispatchEvent(event);
                        } else {
                            showImportStatus(`Error importing data: ${result ? result.message : 'Unknown error'}`, 'error');
                        }
                    } catch (error) {
                        if (importLoading) importLoading.style.display = 'none';
                        showImportStatus(`Error confirming import: ${error.message}`, 'error');
                    }
                });
            }
            
            // Add event listener for cancel button
            const cancelImportBtn = document.getElementById('cancel-alert-import');
            if (cancelImportBtn) {
                cancelImportBtn.addEventListener('click', function() {
                    // Simply reload the current view
                    displayAlertsImportedData();
                    showImportStatus('Import cancelled', 'info');
                });
            }
        } catch (error) {
            console.error('Error displaying alert data:', error);
            importedRecords.innerHTML = `<p class="error">Error loading alert data: ${error.message}</p>`;
        }
    }
    
    // Display iFleet imported data
    async function displayIFleetImportedData() {
        try {
            const { ipcRenderer } = require('electron');
            const data = await ipcRenderer.invoke('get-ifleet-data');
            
            if (!data || data.length === 0) {
                importedRecords.innerHTML = '<p>No iFleet data available.</p>';
                return;
            }
            
            // Group by plate number and filter out duplicates
            const groupedByPlate = {};
            const seenEntries = new Set(); // Track unique entries
            
            data.forEach(record => {
                const plate = record.platenumber || 'Unknown';
                // Skip invalid plate numbers/header data
                if (plate.toLowerCase().includes('rendszám') || 
                    plate.toLowerCase().includes('terület') || 
                    plate.toLowerCase().includes('telephely') ||
                    plate === 'Unknown' ||
                    !isValidPlateNumber(plate)) {
                    return;
                }
                
                // Create a unique key for this record to deduplicate
                const uniqueKey = `${plate}-${record.timestamp}-${record.area_name}-${record.direction}`;
                if (seenEntries.has(uniqueKey)) {
                    return; // Skip duplicates
                }
                seenEntries.add(uniqueKey);
                
                if (!groupedByPlate[plate]) {
                    groupedByPlate[plate] = [];
                }
                groupedByPlate[plate].push(record);
            });
            
            // Get unique valid plate numbers
            const validPlates = Object.keys(groupedByPlate).filter(plate => 
                isValidPlateNumber(plate)
            );
            
            // Helper function to validate plate numbers
            function isValidPlateNumber(plate) {
                // Must contain hyphen, be between 5-10 chars, and not contain header-like terms
                return plate !== 'Unknown' && 
                       plate.includes('-') && 
                       plate.length >= 5 && 
                       plate.length <= 10 &&
                       !plate.toLowerCase().includes('rendszám') &&
                       !plate.toLowerCase().includes('terület') &&
                       !plate.toLowerCase().includes('telephely') &&
                       !plate.toLowerCase().includes('időpont') &&
                       !plate.toLowerCase().includes('irány') &&
                       !plate.toLowerCase().includes('töltött') &&
                       !plate.toLowerCase().includes('megtett');
            }
            
            // Count total records after deduplication
            const totalRecords = Object.values(groupedByPlate).reduce(
                (sum, records) => sum + records.length, 0
            );
            
            let html = `
                <div class="table-summary">
                    <p>Showing ${totalRecords} records for ${validPlates.length} vehicles.</p>
                </div>
            `;
            
            // Create selection dropdown for vehicles
            html += `
                <div class="vehicle-filter">
                    <select id="vehicle-selector" class="form-control select-dropdown">
                        <option value="">-- Select Vehicle --</option>
                        ${validPlates.map(plate => `<option value="${plate}">${plate} (${groupedByPlate[plate].length} records)</option>`).join('')}
                    </select>
                </div>
            `;
            
            // Add confirm import button
            html += `
                <div class="preview-controls preview-button-container">
                    <button id="confirm-ifleet-import" class="btn btn-success import-btn">Import to DB</button>
                    <button id="cancel-ifleet-import" class="btn btn-secondary clear-btn">Clear</button>
                </div>
            `;
            
            // Create a table for data display
            html += `
                <div class="data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Plate Number</th>
                                <th>Timestamp</th>
                                <th>Area Name</th>
                                <th>Direction</th>
                                <th>Time Spent</th>
                                <th>Distance</th>
                            </tr>
                        </thead>
                        <tbody id="vehicle-data">
                            <tr>
                                <td colspan="6" class="text-center">Select a vehicle to view data</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            
            // Render the HTML
            importedRecords.innerHTML = html;
            
            // Create a map of formatted records for each vehicle
            const formattedRecords = {};
            
            validPlates.forEach(plate => {
                const records = groupedByPlate[plate];
                
                // Sort records by timestamp
                records.sort((a, b) => {
                    return new Date(a.timestamp) - new Date(b.timestamp);
                });
                
                // Format the records for rendering
                formattedRecords[plate] = records.map(record => {
                    // Format timestamp
                    let timestamp = record.timestamp;
                    if (timestamp) {
                        try {
                            const date = new Date(timestamp);
                            if (!isNaN(date.getTime())) {
                                timestamp = date.toLocaleString();
                            }
                        } catch (e) {
                            // Keep as is if can't parse
                        }
                    }
                    
                    // Format time spent as HH:MM
                    let timeSpent = '';
                    if (record.time_spent !== null && record.time_spent !== undefined) {
                        const hours = Math.floor(record.time_spent / 60);
                        const minutes = record.time_spent % 60;
                        timeSpent = `${hours}:${minutes.toString().padStart(2, '0')}`;
                    }
                    
                    // Remove "Telephely" from area_name
                    let areaName = record.area_name || '';
                    areaName = areaName.replace(/\s+Telephely$/i, '');
                    
                    return {
                        platenumber: record.platenumber || '',
                        timestamp: timestamp || '',
                        area_name: areaName,
                        direction: record.direction || '',
                        timeSpent: timeSpent,
                        distance: record.distance !== null ? record.distance : ''
                    };
                });
            });
            
            // Add event listener to the vehicle selector
            const vehicleSelector = document.getElementById('vehicle-selector');
            if (vehicleSelector) {
                vehicleSelector.addEventListener('change', function() {
                    const selectedPlate = this.value;
                    const vehicleDataContainer = document.getElementById('vehicle-data');
                    
                    if (!selectedPlate || !vehicleDataContainer) {
                        vehicleDataContainer.innerHTML = `
                            <tr>
                                <td colspan="6" class="text-center">Please select a vehicle</td>
                            </tr>
                        `;
                        return;
                    }
                    
                    const records = formattedRecords[selectedPlate] || [];
                    
                    if (records.length === 0) {
                        vehicleDataContainer.innerHTML = `
                            <tr>
                                <td colspan="6" class="text-center">No records found for ${selectedPlate}</td>
                            </tr>
                        `;
                        return;
                    }
                    
                    // Render the records
                    let rowsHtml = '';
                    records.forEach(record => {
                        rowsHtml += `
                            <tr>
                                <td>${record.platenumber}</td>
                                <td>${record.timestamp}</td>
                                <td>${record.area_name}</td>
                                <td>${record.direction}</td>
                                <td>${record.timeSpent}</td>
                                <td>${record.distance}</td>
                            </tr>
                        `;
                    });
                    
                    vehicleDataContainer.innerHTML = rowsHtml;
                });
            }
            
            // Add event listener for confirm import button
            const confirmImportBtn = document.getElementById('confirm-ifleet-import');
            if (confirmImportBtn) {
                confirmImportBtn.addEventListener('click', async function() {
                    try {
                        if (importLoading) importLoading.style.display = 'flex';
                        showImportStatus('Importing valid vehicle data to database...', 'info');
                        
                        // Filter data to include only valid plate numbers AND deduplicate at the same time
                        const uniqueRecords = new Map();
                        
                        // First pass - collect only valid plate records with unique keys
                        data.forEach(record => {
                            const plate = record.platenumber || '';
                            
                            // Skip records with invalid or header-like data
                            if (!isValidPlateNumber(plate)) return;
                            
                            // Also filter out records with header data in other fields
                            if (record.area_name && 
                                (record.area_name.toLowerCase().includes('terület') || 
                                 record.area_name.toLowerCase().includes('név') ||
                                 record.area_name.toLowerCase().includes('neve'))) {
                                return;
                            }
                            
                            if (record.direction && 
                                (record.direction.toLowerCase().includes('irány') ||
                                 record.direction.toLowerCase().includes('direction'))) {
                                return;
                            }
                            
                            // Create a unique key for each record to avoid duplicates
                            const uniqueKey = `${plate}-${record.timestamp}-${record.area_name}-${record.direction}`;
                            
                            // Only keep the first occurrence of each unique entry
                            if (!uniqueRecords.has(uniqueKey)) {
                                uniqueRecords.set(uniqueKey, record);
                            }
                        });
                        
                        // Convert the Map values to an array
                        const validData = Array.from(uniqueRecords.values());
                        
                        // Log the deduplication results
                        console.log(`Filtered from ${data.length} records to ${validData.length} unique records for import`);
                        
                        // Trigger the final database update with only unique valid plate numbers
                        const result = await ipcRenderer.invoke('confirm-ifleet-import', validData);
                        
                        if (importLoading) importLoading.style.display = 'none';
                        
                        if (result && result.success) {
                            showImportStatus(`Successfully imported ${validPlates.length} vehicles (${validData.length} unique records) to database`, 'success');
                            
                            // Dispatch event similar to SysWeb
                            const event = new CustomEvent('ifleet-import-confirmed', {
                                detail: { 
                                    data: validData,
                                    success: true
                                }
                            });
                            document.dispatchEvent(event);
                        } else {
                            showImportStatus(`Error importing data: ${result ? result.message : 'Unknown error'}`, 'error');
                        }
                    } catch (error) {
                        if (importLoading) importLoading.style.display = 'none';
                        showImportStatus(`Error confirming import: ${error.message}`, 'error');
                    }
                });
            }
            
            // Add event listener for cancel button
            const cancelImportBtn = document.getElementById('cancel-ifleet-import');
            if (cancelImportBtn) {
                cancelImportBtn.addEventListener('click', function() {
                    // Simply reload the current view
                    displayIFleetImportedData();
                    showImportStatus('Import cancelled', 'info');
                });
            }
        } catch (error) {
            console.error('Error displaying iFleet data:', error);
            importedRecords.innerHTML = `<p class="error">Error loading iFleet data: ${error.message}</p>`;
        }
    }
} 
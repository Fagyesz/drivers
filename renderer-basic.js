// Import required modules
const { ipcRenderer } = require('electron');

console.log('Basic renderer started');

// Add this global flag at the top of the file, outside any functions
let importInitialized = false;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - initializing basic renderer');
    
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
                console.log('Inserting demo data...');
                insertDemoDataBtn.disabled = true;
                insertDemoDataBtn.textContent = 'Loading...';
                
                // Add loading animation to dashboard cards
                document.querySelectorAll('.dashboard-card').forEach(card => {
                    card.classList.add('loading');
                });
                
                const result = await ipcRenderer.invoke('insert-demo-data');
                
                if (result.success) {
                    console.log('Demo data inserted successfully');
                    // Show success notification
                    showNotification('Demo data inserted successfully!', 'success');
                    
                    // Reload the data on all tabs
                    loadDashboardCounts();
                    loadVehicles();
                    loadPeople();
                    loadRounds();
                    loadAlerts();
                } else {
                    console.error('Error inserting demo data:', result.error);
                    showNotification('Error inserting demo data', 'error');
                }
            } catch (error) {
                console.error('Error inserting demo data:', error);
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
            console.log('Tab clicked:', tabId);
            
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
    console.log('Loading vehicles data');
    const vehiclesContainer = document.querySelector('#vehicles-tab .data-container');
    
    if (!vehiclesContainer) {
        console.error('Vehicles container not found');
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
        console.error('Error loading vehicles:', error);
        vehiclesContainer.innerHTML = `<div class="error-message">Error loading vehicles: ${error.message}</div>`;
    }
}

// Load people data
async function loadPeople() {
    console.log('Loading people data');
    const peopleContainer = document.querySelector('#people-tab .data-container');
    
    if (!peopleContainer) {
        console.error('People container not found');
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
        console.error('Error loading people:', error);
        peopleContainer.innerHTML = `<div class="error-message">Error loading people: ${error.message}</div>`;
    }
}

// Load rounds data
async function loadRounds() {
    console.log('Loading rounds data');
    const roundsContainer = document.querySelector('#rounds-tab .data-container');
    
    if (!roundsContainer) {
        console.error('Rounds container not found');
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
        console.error('Error loading rounds:', error);
        roundsContainer.innerHTML = `<div class="error-message">Error loading rounds: ${error.message}</div>`;
    }
}

// Load alerts data
async function loadAlerts() {
    console.log('Loading alerts data');
    const alertsContainer = document.querySelector('#alerts-tab .data-container');
    
    if (!alertsContainer) {
        console.error('Alerts container not found');
        return;
    }
    
    try {
        const alerts = await ipcRenderer.invoke('get-alerts');
        
        if (!alerts || alerts.length === 0) {
            alertsContainer.innerHTML = '<div class="no-data-message">No alerts found</div>';
            return;
        }
        
        // Display alerts
        let html = '<div class="data-grid">';
        alerts.forEach(alert => {
            html += `
                <div class="data-card alert">
                    <h3>${alert.alert_type || 'Unknown Alert'}</h3>
                    <p>Location: ${alert.location || 'Unknown'}</p>
                    <p>Time: ${alert.timestamp || 'Unknown'}</p>
                    <p>Status: ${alert.status || 'Unknown'}</p>
                </div>
            `;
        });
        html += '</div>';
        
        alertsContainer.innerHTML = html;
    } catch (error) {
        console.error('Error loading alerts:', error);
        alertsContainer.innerHTML = `<div class="error-message">Error loading alerts: ${error.message}</div>`;
    }
}

// Load dashboard counts
async function loadDashboardCounts() {
    console.log('Loading dashboard counts');
    
    try {
        // Get people count
        let peopleCount = 0;
        try {
            const people = await ipcRenderer.invoke('get-people');
            peopleCount = people ? people.length : 0;
        } catch (error) {
            console.error('Error loading people count:', error);
            peopleCount = 12; // Demo fallback
        }
        document.getElementById('people-count').textContent = peopleCount;
        
        // Get vehicles count
        let vehiclesCount = 0;
        try {
            const vehicles = await ipcRenderer.invoke('get-vehicles');
            vehiclesCount = vehicles ? vehicles.length : 0;
        } catch (error) {
            console.error('Error loading vehicles count:', error);
            vehiclesCount = 8; // Demo fallback
        }
        document.getElementById('vehicles-count').textContent = vehiclesCount;
        
        // Get rounds count
        let roundsCount = 0;
        try {
            const rounds = await ipcRenderer.invoke('get-rounds');
            roundsCount = rounds ? rounds.length : 0;
        } catch (error) {
            console.error('Error loading rounds count:', error);
            roundsCount = 4; // Demo fallback
        }
        document.getElementById('rounds-count').textContent = roundsCount;
        
        // Get alert count
        let alertsCount = 0;
        try {
            const alerts = await ipcRenderer.invoke('get-alerts');
            alertsCount = alerts ? alerts.length : 0;
        } catch (error) {
            console.error('Error loading alerts count:', error);
            alertsCount = 3; // Demo fallback
        }
        document.getElementById('alerts-count').textContent = alertsCount;
        
        console.log('Dashboard counts updated');
    } catch (error) {
        console.error('Error loading dashboard counts:', error);
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
        console.log('Import tab activated');
        // Don't add any button event handlers here - they're now in initializeImport()
    });
}

// Import functionality
function initializeImport() {
    console.log('Initializing import functionality');
    
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
            console.log(`Import type changed to: ${currentImportType}`);
            
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
                    
                    console.log('Selected file:', excelFilePath);
                    showImportStatus('File selected. Click "Process" to import data.', 'info');
                }
            } catch (error) {
                console.error('Error selecting file:', error);
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
            console.log('Process imported data button clicked');
            
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
                        console.log('Parsing SysWeb data for preview');
                        result = await ipcRenderer.invoke('parse-sysweb-excel', excelFilePath);
                        break;
                    case 'alerts':
                    case 'ifleet':
                    case 'autodetect':
                    default:
                        // For other types, proceed directly to import
                        console.log(`Importing ${currentImportType} data directly`);
                        result = await performDirectImport(excelFilePath, currentImportType);
                        break;
                }
                
                if (importLoading) importLoading.style.display = 'none';
                
                console.log('Parse result:', result);
                
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
                    showImportStatus(`Parse failed: ${result ? result.message : 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error('Error processing data:', error);
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
            console.error('Error importing confirmed data:', error);
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
            console.error('Error displaying SysWeb data:', error);
            importedRecords.innerHTML = `<p class="error">Error displaying data: ${error.message}</p>`;
        }
    }
    
    // Function to display Alerts data from the database
    async function displayAlertsImportedData() {
        importedRecords.innerHTML = '<p>Alerts data display not implemented yet.</p>';
    }
    
    // Function to display iFleet data from the database
    async function displayIFleetImportedData() {
        importedRecords.innerHTML = '<p>iFleet data display not implemented yet.</p>';
    }
} 
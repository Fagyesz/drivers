// Import required modules
const { ipcRenderer } = require('electron');

console.log('Basic renderer started');

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
    
    // Initialize import functionality
    initializeImport();
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

// Initialize Excel Preview component when the Import tab is active
document.querySelector('.tab-btn[data-tab="import-tab"]').addEventListener('click', () => {
    console.log('Import tab activated');
    const importSection = document.getElementById('import-tab');
    
    // Simple implementation to avoid errors
    if (importSection) {
        // Clear any previous error messages
        const statusElement = document.getElementById('import-status');
        if (statusElement) {
            statusElement.textContent = '';
            statusElement.className = '';
        }
        
        // Set up file selection button
        const selectFileBtn = document.getElementById('select-file-btn');
        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', async () => {
                try {
                    const filePath = await ipcRenderer.invoke('select-file');
                    const selectedFilePathElement = document.getElementById('selected-file-path');
                    if (selectedFilePathElement && filePath) {
                        selectedFilePathElement.textContent = filePath;
                        // Enable import button
                        const importDataBtn = document.getElementById('import-data-btn');
                        if (importDataBtn) {
                            importDataBtn.disabled = false;
                        }
                    }
                } catch (error) {
                    console.error('Error selecting file:', error);
                    if (statusElement) {
                        statusElement.textContent = `Error selecting file: ${error.message}`;
                        statusElement.className = 'error-message';
                    }
                }
            });
        }
        
        // Set up import button
        const importDataBtn = document.getElementById('import-data-btn');
        if (importDataBtn) {
            importDataBtn.addEventListener('click', () => {
                const selectedFilePathElement = document.getElementById('selected-file-path');
                const filePath = selectedFilePathElement ? selectedFilePathElement.textContent : '';
                
                if (!filePath) {
                    if (statusElement) {
                        statusElement.textContent = 'Please select a file first';
                        statusElement.className = 'error-message';
                    }
                    return;
                }
                
                if (statusElement) {
                    statusElement.textContent = 'Import functionality coming soon...';
                    statusElement.className = 'info-message';
                }
            });
        }
    }
});

function initializeImport() {
    console.log('Initializing import functionality');
    
    const selectFileBtn = document.getElementById('select-file-btn');
    const selectedFilePath = document.getElementById('selected-file-path');
    const importDataBtn = document.getElementById('import-data-btn');
    const clearImportBtn = document.getElementById('clear-import-btn');
    const importStatus = document.getElementById('import-status');
    const importTypeSelector = document.getElementById('import-type-selector');
    const importedRecordsContainer = document.getElementById('imported-records');
    
    let excelFilePath = '';
    let currentImportType = 'worktime'; // Default to worktime
    
    console.log('Looking for import elements:', { 
        selectFileBtn: !!selectFileBtn, 
        selectedFilePath: !!selectedFilePath,
        importDataBtn: !!importDataBtn 
    });
    
    // Event listeners
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', async () => {
            console.log('Select file button clicked');
            try {
                const { ipcRenderer } = require('electron');
                const result = await ipcRenderer.invoke('select-file');
                console.log('File selection result:', result);
                
                if (result && result.filePaths && result.filePaths.length > 0) {
                    excelFilePath = result.filePaths[0];
                    console.log('Selected file path:', excelFilePath);
                    selectedFilePath.textContent = excelFilePath;
                    importDataBtn.disabled = false;
                    
                    showImportStatus('File selected successfully', 'info');
                } else {
                    console.log('No file selected or selection canceled');
                }
            } catch (error) {
                console.error('Error selecting file:', error);
                showImportStatus(`Error selecting file: ${error.message}`, 'error');
            }
        });
    }
    
    if (importTypeSelector) {
        importTypeSelector.addEventListener('change', () => {
            currentImportType = importTypeSelector.value;
            console.log(`Import type changed to: ${currentImportType}`);
        });
    }
    
    if (importDataBtn) {
        importDataBtn.addEventListener('click', async () => {
            console.log('Process imported data button clicked');
            
            if (!excelFilePath) {
                showImportStatus('Please select a file first', 'error');
                return;
            }
            
            try {
                const { ipcRenderer } = require('electron');
                showImportStatus(`Processing ${currentImportType} data...`, 'info');
                
                let result;
                switch (currentImportType) {
                    case 'worktime':
                        console.log('Calling import-sysweb-excel with path:', excelFilePath);
                        result = await ipcRenderer.invoke('import-sysweb-excel', excelFilePath);
                        break;
                    case 'alerts':
                        result = await ipcRenderer.invoke('import-alerts-excel', excelFilePath);
                        break;
                    case 'ifleet':
                        result = await ipcRenderer.invoke('import-ifleet-excel', excelFilePath);
                        break;
                    case 'autodetect':
                    default:
                        result = await ipcRenderer.invoke('import-autodetect-excel', excelFilePath);
                        break;
                }
                
                console.log('Import result:', result);
                
                if (result && result.success) {
                    showImportStatus(result.message, 'success');
                    
                    // Display the data
                    displayImportedData(currentImportType);
                } else {
                    showImportStatus(`Import failed: ${result ? result.message : 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error('Error importing data:', error);
                showImportStatus(`Import error: ${error.message}`, 'error');
            }
        });
    }
    
    if (clearImportBtn) {
        clearImportBtn.addEventListener('click', () => {
            excelFilePath = '';
            selectedFilePath.textContent = 'No file selected';
            importDataBtn.disabled = true;
            importedRecordsContainer.innerHTML = '<p>Import data to see records.</p>';
            showImportStatus('', '');
        });
    }
    
    // Function to show import status messages
    function showImportStatus(message, type) {
        if (!importStatus) return;
        
        importStatus.textContent = message;
        importStatus.className = 'status-message';
        
        if (type) {
            importStatus.classList.add(type);
        }
    }
    
    // Function to display imported data based on type
    async function displayImportedData(type) {
        if (!importedRecordsContainer) return;
        
        const { ipcRenderer } = require('electron');
        try {
            let data;
            
            switch (type) {
                case 'worktime':
                    data = await ipcRenderer.invoke('get-sysweb-data');
                    displayWorktimeData(data);
                    break;
                case 'alerts':
                    data = await ipcRenderer.invoke('get-alerts-data');
                    importedRecordsContainer.innerHTML = '<p>Alerts data imported. Functionality coming soon.</p>';
                    break;
                case 'ifleet':
                    data = await ipcRenderer.invoke('get-ifleet-data');
                    importedRecordsContainer.innerHTML = '<p>iFleet data imported. Functionality coming soon.</p>';
                    break;
                default:
                    data = await ipcRenderer.invoke('get-latest-import-data');
                    if (data && data.type === 'worktime') {
                        displayWorktimeData(data.records);
                    } else {
                        importedRecordsContainer.innerHTML = '<p>Data imported but no specific handler available.</p>';
                    }
            }
        } catch (error) {
            console.error('Error displaying imported data:', error);
            importedRecordsContainer.innerHTML = `<p>Error displaying data: ${error.message}</p>`;
        }
    }
    
    // Function to display worktime data specifically
    function displayWorktimeData(data) {
        if (!data || data.length === 0) {
            importedRecordsContainer.innerHTML = '<p>No worktime records found.</p>';
            return;
        }
        
        // Group records by person
        const peopleGroups = {};
        
        data.forEach(record => {
            if (!record.name) return;
            
            if (!peopleGroups[record.name]) {
                peopleGroups[record.name] = {
                    name: record.name,
                    jobtitle: record.jobtitle,
                    costcenter: record.costcenter,
                    records: []
                };
            }
            
            peopleGroups[record.name].records.push(record);
        });
        
        // Build HTML for each person
        let html = '';
        
        Object.values(peopleGroups).forEach(person => {
            html += `
                <div class="person-section">
                    <div class="person-header">
                        <h3>${person.name || 'Unknown Person'}</h3>
                        <div class="person-details">
                            <span><strong>Job Title:</strong> ${person.jobtitle || 'N/A'}</span>
                            <span><strong>Cost Center:</strong> ${person.costcenter || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <table class="data-table">
                        <thead>
                            <tr>
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
            
            // Sort records by date
            person.records.sort((a, b) => {
                return a.date.localeCompare(b.date);
            });
            
            // Add rows for each record
            person.records.forEach(record => {
                html += `
                    <tr>
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
                <hr>
            `;
        });
        
        importedRecordsContainer.innerHTML = html;
    }
} 
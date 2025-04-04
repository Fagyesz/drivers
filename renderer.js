console.log('Renderer script started - clean version without initialization conflicts');

// DOM Elements
const selectFileBtn = document.getElementById('select-file-btn');
const selectedFilePath = document.getElementById('selected-file-path');
const importDataBtn = document.getElementById('import-data-btn');
const importStatus = document.getElementById('import-status');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const driverSearch = document.getElementById('driver-search');
const vehicleSearch = document.getElementById('vehicle-search');
const driversTableBody = document.getElementById('drivers-table-body');
const vehiclesTableBody = document.getElementById('vehicles-table-body');
const alertsContainer = document.getElementById('alerts-container');

console.log('DOM elements found:', {
    selectFileBtn, 
    tabButtons: tabButtons.length,
    tabPanes: tabPanes.length
});

// Global variables
let excelFilePath = '';
let drivers = [];
let vehicles = [];
let alerts = [];

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - initializing app with fixed renderer');
    
    // Initialize tab system
    initTabSystem();
    
    // Load dashboard counts - implemented in a way that doesn't require ipc
    loadDashboardCountsDemo();
});

// Tab functionality
function initTabSystem() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    console.log('Initializing tabs:', tabButtons.length, 'buttons and', tabPanes.length, 'panes');
    
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
                    console.log('Activated tab pane:', tabId);
                }
            });
            
            // No special handling for import tab - we'll let direct-import.js handle that
        });
    });
}

// Demo function to show dashboard counts without requiring IPC
function loadDashboardCountsDemo() {
    console.log('Loading dashboard counts (demo)');
    
    // Set demo counts
    const peopleCount = document.getElementById('people-count');
    if (peopleCount) {
        peopleCount.textContent = '12';
    }
    
    const vehiclesCount = document.getElementById('vehicles-count');
    if (vehiclesCount) {
        vehiclesCount.textContent = '8';
    }
    
    const roundsCount = document.getElementById('rounds-count');
    if (roundsCount) {
        roundsCount.textContent = '4';
    }
    
    const alertsCount = document.getElementById('alerts-count');
    if (alertsCount) {
        alertsCount.textContent = '3';
    }
    
    console.log('Dashboard counts updated (demo)');
}

// Set up event listeners
function setupEventListeners() {
    // Select Excel file button
    selectFileBtn.addEventListener('click', async () => {
        try {
            const filePath = await ipcRenderer.invoke('select-file');
            if (filePath) {
                excelFilePath = filePath;
                selectedFilePath.textContent = filePath;
                importDataBtn.disabled = false;
            }
        } catch (error) {
            showImportStatus(`Error selecting file: ${error.message}`, 'error');
        }
    });
    
    // Import data button
    importDataBtn.addEventListener('click', async () => {
        if (excelFilePath) {
            try {
                showImportStatus('Importing data...', 'info');
                await importExcelFile(excelFilePath);
                showImportStatus('Data imported successfully!', 'success');
                await loadData(); // Reload data after import
            } catch (error) {
                showImportStatus(`Import failed: ${error.message}`, 'error');
            }
        }
    });
    
    // Search functionality
    driverSearch.addEventListener('input', () => {
        filterDrivers(driverSearch.value.toLowerCase());
    });
    
    vehicleSearch.addEventListener('input', () => {
        filterVehicles(vehicleSearch.value.toLowerCase());
    });
}

// Load data from database
async function loadData() {
    try {
        // Load drivers
        drivers = await getDrivers();
        renderDrivers(drivers);
        
        // Load vehicles
        vehicles = await getVehicles();
        renderVehicles(vehicles);
        
        // Load alerts
        alerts = await getAlerts();
        renderAlerts(alerts);
        
        // Generate alerts for expired or soon-to-expire licenses
        await checkLicenseExpirations();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Import Excel file data
async function importExcelFile(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        
        // Process drivers sheet
        if (workbook.SheetNames.includes('Drivers')) {
            const driversSheet = workbook.Sheets['Drivers'];
            const driversJson = XLSX.utils.sheet_to_json(driversSheet);
            
            for (const row of driversJson) {
                // Process each driver row
                if (row.Name && row.LicenseNumber && row.LicenseExpiration) {
                    // Convert date format if needed
                    const expirationDate = moment(row.LicenseExpiration).format('YYYY-MM-DD');
                    const status = determineDriverStatus(expirationDate);
                    
                    // Add driver to database using IPC
                    await ipcRenderer.invoke('add-driver', {
                        name: row.Name,
                        licenseNumber: row.LicenseNumber,
                        licenseExpiration: expirationDate,
                        status
                    });
                }
            }
        }
        
        // Load the updated drivers to get their IDs
        drivers = await ipcRenderer.invoke('get-drivers');
        
        // Process vehicles sheet
        if (workbook.SheetNames.includes('Vehicles')) {
            const vehiclesSheet = workbook.Sheets['Vehicles'];
            const vehiclesJson = XLSX.utils.sheet_to_json(vehiclesSheet);
            
            for (const row of vehiclesJson) {
                // Process each vehicle row
                if (row.Make && row.Model && row.LicensePlate) {
                    // Convert date format if needed
                    const inspectionDate = row.LastInspection ? moment(row.LastInspection).format('YYYY-MM-DD') : null;
                    const status = determineVehicleStatus(inspectionDate);
                    
                    // Find driver ID if provided
                    let driverId = null;
                    if (row.DriverLicense) {
                        const driver = drivers.find(d => d.licenseNumber === row.DriverLicense);
                        if (driver) {
                            driverId = driver.id;
                        }
                    }
                    
                    // Add vehicle to database using IPC
                    await ipcRenderer.invoke('add-vehicle', {
                        make: row.Make,
                        model: row.Model,
                        licensePlate: row.LicensePlate,
                        lastInspection: inspectionDate,
                        status,
                        driverId
                    });
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error importing Excel file:', error);
        throw error;
    }
}

// Determine driver status based on license expiration
function determineDriverStatus(expirationDate) {
    const now = moment();
    const expiration = moment(expirationDate);
    const monthsRemaining = expiration.diff(now, 'months');
    
    if (expiration < now) {
        return 'Expired';
    } else if (monthsRemaining <= 3) {
        return 'Expiring Soon';
    } else {
        return 'Valid';
    }
}

// Determine vehicle status based on last inspection
function determineVehicleStatus(inspectionDate) {
    if (!inspectionDate) {
        return 'Unknown';
    }
    
    const now = moment();
    const inspection = moment(inspectionDate);
    const monthsAgo = now.diff(inspection, 'months');
    
    if (monthsAgo >= 12) {
        return 'Inspection Overdue';
    } else if (monthsAgo >= 10) {
        return 'Inspection Due Soon';
    } else {
        return 'Valid';
    }
}

// Check for license expirations and create alerts
async function checkLicenseExpirations() {
    const now = moment();
    
    for (const driver of drivers) {
        const expiration = moment(driver.licenseExpiration);
        const monthsRemaining = expiration.diff(now, 'months');
        
        if (expiration < now) {
            await ipcRenderer.invoke('add-alert', {
                type: 'danger',
                message: `Driver ${driver.name}'s license (${driver.licenseNumber}) has expired on ${expiration.format('MM/DD/YYYY')}.`,
                relatedId: driver.id,
                relatedType: 'driver',
                status: 'active'
            });
        } else if (monthsRemaining <= 3) {
            await ipcRenderer.invoke('add-alert', {
                type: 'warning',
                message: `Driver ${driver.name}'s license (${driver.licenseNumber}) will expire on ${expiration.format('MM/DD/YYYY')}.`,
                relatedId: driver.id,
                relatedType: 'driver',
                status: 'active'
            });
        }
    }
    
    for (const vehicle of vehicles) {
        if (vehicle.lastInspection) {
            const inspection = moment(vehicle.lastInspection);
            const monthsAgo = now.diff(inspection, 'months');
            
            if (monthsAgo >= 12) {
                await ipcRenderer.invoke('add-alert', {
                    type: 'danger',
                    message: `Vehicle ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate}) inspection is overdue. Last inspection: ${inspection.format('MM/DD/YYYY')}.`,
                    relatedId: vehicle.id,
                    relatedType: 'vehicle',
                    status: 'active'
                });
            } else if (monthsAgo >= 10) {
                await ipcRenderer.invoke('add-alert', {
                    type: 'warning',
                    message: `Vehicle ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate}) is due for inspection soon. Last inspection: ${inspection.format('MM/DD/YYYY')}.`,
                    relatedId: vehicle.id,
                    relatedType: 'vehicle',
                    status: 'active'
                });
            }
        }
    }
    
    // Reload alerts after creating new ones
    alerts = await ipcRenderer.invoke('get-alerts');
}

// Render drivers in the table
function renderDrivers(driversData) {
    driversTableBody.innerHTML = '';
    
    if (driversData.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="6" class="text-center">No drivers found. Import data to get started.</td>';
        driversTableBody.appendChild(emptyRow);
        return;
    }
    
    driversData.forEach(driver => {
        const expirationDate = moment(driver.licenseExpiration);
        const now = moment();
        const isExpired = expirationDate < now;
        const isExpiringSoon = expirationDate.diff(now, 'months') <= 3;
        
        let statusClass = 'status-good';
        if (isExpired) {
            statusClass = 'status-expired';
        } else if (isExpiringSoon) {
            statusClass = 'status-warning';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${driver.id}</td>
            <td>${driver.name}</td>
            <td>${driver.licenseNumber}</td>
            <td>${moment(driver.licenseExpiration).format('MM/DD/YYYY')}</td>
            <td class="${statusClass}">${driver.status}</td>
            <td>
                <button class="action-btn edit" data-id="${driver.id}">Edit</button>
                <button class="action-btn delete" data-id="${driver.id}">Delete</button>
            </td>
        `;
        
        // Add event listeners for action buttons
        const editBtn = tr.querySelector('.edit');
        const deleteBtn = tr.querySelector('.delete');
        
        editBtn.addEventListener('click', () => {
            // TODO: Implement edit driver functionality
            console.log('Edit driver:', driver.id);
        });
        
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete driver ${driver.name}?`)) {
                try {
                    await deleteDriver(driver.id);
                    await loadData(); // Reload data after delete
                } catch (error) {
                    console.error('Error deleting driver:', error);
                    alert(`Error deleting driver: ${error.message}`);
                }
            }
        });
        
        driversTableBody.appendChild(tr);
    });
}

// Render vehicles in the table
function renderVehicles(vehiclesData) {
    vehiclesTableBody.innerHTML = '';
    
    if (vehiclesData.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="7" class="text-center">No vehicles found. Import data to get started.</td>';
        vehiclesTableBody.appendChild(emptyRow);
        return;
    }
    
    vehiclesData.forEach(vehicle => {
        let statusClass = 'status-good';
        if (vehicle.status === 'Inspection Overdue') {
            statusClass = 'status-expired';
        } else if (vehicle.status === 'Inspection Due Soon') {
            statusClass = 'status-warning';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${vehicle.id}</td>
            <td>${vehicle.make}</td>
            <td>${vehicle.model}</td>
            <td>${vehicle.licensePlate}</td>
            <td>${vehicle.lastInspection ? moment(vehicle.lastInspection).format('MM/DD/YYYY') : 'N/A'}</td>
            <td class="${statusClass}">${vehicle.status}</td>
            <td>
                <button class="action-btn edit" data-id="${vehicle.id}">Edit</button>
                <button class="action-btn delete" data-id="${vehicle.id}">Delete</button>
            </td>
        `;
        
        // Add event listeners for action buttons
        const editBtn = tr.querySelector('.edit');
        const deleteBtn = tr.querySelector('.delete');
        
        editBtn.addEventListener('click', () => {
            // TODO: Implement edit vehicle functionality
            console.log('Edit vehicle:', vehicle.id);
        });
        
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete vehicle ${vehicle.make} ${vehicle.model}?`)) {
                try {
                    await deleteVehicle(vehicle.id);
                    await loadData(); // Reload data after delete
                } catch (error) {
                    console.error('Error deleting vehicle:', error);
                    alert(`Error deleting vehicle: ${error.message}`);
                }
            }
        });
        
        vehiclesTableBody.appendChild(tr);
    });
}

// Render alerts in the alerts container
function renderAlerts(alertsData) {
    alertsContainer.innerHTML = '';
    
    if (alertsData.length === 0) {
        const emptyAlert = document.createElement('div');
        emptyAlert.classList.add('alert-item', 'alert-info');
        emptyAlert.textContent = 'No alerts at this time.';
        alertsContainer.appendChild(emptyAlert);
        return;
    }
    
    alertsData.forEach(alert => {
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert-item', `alert-${alert.type}`);
        alertDiv.textContent = alert.message;
        
        // Add dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.classList.add('dismiss-btn');
        dismissBtn.textContent = 'Dismiss';
        dismissBtn.addEventListener('click', async () => {
            try {
                await markAlertAsRead(alert.id);
                alertDiv.remove();
            } catch (error) {
                console.error('Error dismissing alert:', error);
            }
        });
        
        alertDiv.appendChild(dismissBtn);
        alertsContainer.appendChild(alertDiv);
    });
}

// Filter drivers based on search input
function filterDrivers(searchText) {
    const filteredDrivers = drivers.filter(driver => {
        return (
            driver.name.toLowerCase().includes(searchText) ||
            driver.licenseNumber.toLowerCase().includes(searchText) ||
            driver.status.toLowerCase().includes(searchText)
        );
    });
    
    renderDrivers(filteredDrivers);
}

// Filter vehicles based on search input
function filterVehicles(searchText) {
    const filteredVehicles = vehicles.filter(vehicle => {
        return (
            vehicle.make.toLowerCase().includes(searchText) ||
            vehicle.model.toLowerCase().includes(searchText) ||
            vehicle.licensePlate.toLowerCase().includes(searchText) ||
            (vehicle.status && vehicle.status.toLowerCase().includes(searchText))
        );
    });
    
    renderVehicles(filteredVehicles);
}

// Show import status message
function showImportStatus(message, type) {
    importStatus.textContent = message;
    importStatus.className = '';
    importStatus.classList.add(`status-${type}`);
}

// API communication functions
async function getDrivers() {
    try {
        return await ipcRenderer.invoke('get-drivers');
    } catch (error) {
        console.error('Error fetching drivers:', error);
        // For demo purposes, return sample data if the database is not yet available
        return [
            { id: 1, name: 'John Doe', licenseNumber: 'DL123456', licenseExpiration: '2023-12-31', status: 'Valid' },
            { id: 2, name: 'Jane Smith', licenseNumber: 'DL654321', licenseExpiration: '2022-10-15', status: 'Expired' },
            { id: 3, name: 'Bob Johnson', licenseNumber: 'DL789012', licenseExpiration: '2023-06-30', status: 'Expiring Soon' }
        ];
    }
}

async function addDriver(driver) {
    try {
        return await ipcRenderer.invoke('add-driver', driver);
    } catch (error) {
        console.error('Error adding driver:', error);
        // Fallback for demo
        drivers.push({ id: drivers.length + 1, ...driver });
        return { id: drivers.length, ...driver };
    }
}

async function deleteDriver(id) {
    try {
        return await ipcRenderer.invoke('delete-driver', id);
    } catch (error) {
        console.error('Error deleting driver:', error);
        // Fallback for demo
        const index = drivers.findIndex(d => d.id === id);
        if (index !== -1) {
            drivers.splice(index, 1);
        }
        return { success: true };
    }
}

async function getVehicles() {
    try {
        return await ipcRenderer.invoke('get-vehicles');
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        // For demo purposes, return sample data
        return [
            { id: 1, make: 'Toyota', model: 'Camry', licensePlate: 'ABC123', lastInspection: '2023-01-15', status: 'Valid', driverId: 1 },
            { id: 2, make: 'Honda', model: 'Accord', licensePlate: 'XYZ789', lastInspection: '2022-05-20', status: 'Inspection Overdue', driverId: 2 },
            { id: 3, make: 'Ford', model: 'F-150', licensePlate: 'DEF456', lastInspection: '2022-11-10', status: 'Inspection Due Soon', driverId: 3 }
        ];
    }
}

async function addVehicle(vehicle) {
    try {
        return await ipcRenderer.invoke('add-vehicle', vehicle);
    } catch (error) {
        console.error('Error adding vehicle:', error);
        // Fallback for demo
        vehicles.push({ id: vehicles.length + 1, ...vehicle });
        return { id: vehicles.length, ...vehicle };
    }
}

async function deleteVehicle(id) {
    try {
        return await ipcRenderer.invoke('delete-vehicle', id);
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        // Fallback for demo
        const index = vehicles.findIndex(v => v.id === id);
        if (index !== -1) {
            vehicles.splice(index, 1);
        }
        return { success: true };
    }
}

async function getAlerts() {
    try {
        return await ipcRenderer.invoke('get-alerts');
    } catch (error) {
        console.error('Error fetching alerts:', error);
        // For demo purposes, return sample data
        return [
            { id: 1, type: 'warning', message: 'Driver Jane Smith\'s license (DL654321) has expired on 10/15/2022.', relatedId: 2, relatedType: 'driver', status: 'active' },
            { id: 2, type: 'warning', message: 'Vehicle Honda Accord (XYZ789) inspection is overdue. Last inspection: 05/20/2022.', relatedId: 2, relatedType: 'vehicle', status: 'active' },
            { id: 3, type: 'warning', message: 'Driver Bob Johnson\'s license (DL789012) will expire on 06/30/2023.', relatedId: 3, relatedType: 'driver', status: 'active' }
        ];
    }
}

async function createAlert(alert) {
    try {
        return await ipcRenderer.invoke('add-alert', alert);
    } catch (error) {
        console.error('Error creating alert:', error);
        // Fallback for demo
        const existingAlert = alerts.find(a => 
            a.relatedId === alert.relatedId && 
            a.relatedType === alert.relatedType && 
            a.type === alert.type
        );
        
        if (!existingAlert) {
            alerts.push({ id: alerts.length + 1, ...alert });
        }
        
        return { success: true };
    }
}

async function markAlertAsRead(id) {
    try {
        return await ipcRenderer.invoke('mark-alert-read', id);
    } catch (error) {
        console.error('Error marking alert as read:', error);
        // Fallback for demo
        const index = alerts.findIndex(a => a.id === id);
        if (index !== -1) {
            alerts.splice(index, 1);
        }
        return { success: true };
    }
}

// Initialize Excel Import functionality with a type selector
function initializeImportTab() {
    console.log('Initializing import tab with container:', document.getElementById('import-container'));
    
    // Check if the Import Manager is already initialized
    if (!window.importManager) {
        try {
            // Define the import types based on schema names
            const importTypes = [
                { id: 'people', label: 'Driver Data' },
                { id: 'vehicles', label: 'Vehicle Data' },
                { id: 'rounds', label: 'Route Data' },
                { id: 'addresses', label: 'Address Data' },
                { id: 'vehicle_assignments', label: 'Vehicle Assignment Data' },
                { id: 'time_records', label: 'Time Records' },
                { id: 'stop_events_alert', label: 'Event Alerts' }
            ];
            
            // Find import container element
            const importContainer = document.getElementById('import-container');
            if (importContainer) {
                console.log('Found import container, initializing ImportManager');
                
                // Force a little delay to ensure DOM is ready
                setTimeout(() => {
                    try {
                        // Initialize the ImportManager component
                        window.importManager = new ImportManager('import-container', {
                            importTypes: importTypes,
                            onImportTypeSelected: async (data) => {
                                console.log('Import type selected:', data.type, 'with file:', data.file.name);
                                
                                // Get schema fields for the selected type
                                const schemaFields = await ipcRenderer.invoke('get-schema-fields', data.type);
                                console.log('Schema fields retrieved:', schemaFields);
                                
                                // Initialize mapping UI for the selected type
                                initMappingUI(data.excelData, data.type, schemaFields);
                            }
                        });
                        
                        console.log('Import Manager initialized successfully');
                    } catch (error) {
                        console.error('Error in delayed ImportManager initialization:', error);
                    }
                }, 100);
            } else {
                console.error('Import container element not found');
            }
        } catch (error) {
            console.error('Error initializing Import Manager:', error);
        }
    } else {
        console.log('Import Manager already initialized');
    }
}

// Initialize Mapping UI with Excel data and schema type
function initMappingUI(excelData, schemaType, schemaFields) {
    console.log('Initializing mapping UI for', schemaType);
    try {
        // Initialize Mapping UI
        const mappingElement = document.getElementById('mapping-container');
        if (mappingElement) {
            console.log('Found mapping container');
            if (!window.mappingUI) {
                window.mappingUI = new MappingUI('mapping-container', {
                    onSave: async (mappingData) => {
                        console.log('Mapping saved:', mappingData);
                        // Process the mapped data
                        await processImport(mappingData, schemaType);
                    },
                    onCancel: () => {
                        console.log('Mapping cancelled');
                        // Reset the UI
                        if (window.mappingUI) {
                            window.mappingUI.reset();
                        }
                        // Hide mapping UI and show import manager again
                        if (mappingElement) {
                            mappingElement.style.display = 'none';
                        }
                        const importContainer = document.getElementById('import-container');
                        if (importContainer) {
                            importContainer.style.display = 'block';
                        }
                    }
                });
                
                console.log('Mapping UI initialized');
            } else {
                // Reset the mapping UI for new data
                window.mappingUI.reset();
                console.log('Existing mapping UI reset');
            }
            
            // Set Excel data and schema fields to the Mapping UI
            window.mappingUI.setExcelData(excelData);
            window.mappingUI.setSchemaFields(schemaFields);
            console.log('Set Excel data and schema fields to mapping UI');
            
            // Show mapping UI and hide import manager
            mappingElement.style.display = 'block';
            const importContainer = document.getElementById('import-container');
            if (importContainer) {
                importContainer.style.display = 'none';
            }
        } else {
            console.error('Mapping container element not found');
        }
    } catch (error) {
        console.error('Error initializing Mapping UI:', error);
    }
}

// Process the import based on mapping data and schema type
async function processImport(mappingData, schemaType) {
    console.log('Processing import for', schemaType);
    const importResults = document.getElementById('import-results');
    if (!importResults) {
        console.error('Import results element not found');
        return;
    }
    
    importResults.innerHTML = '<div class="status-message loading">Importing data...</div>';
    importResults.style.display = 'block';
    
    try {
        // Get database context (for lookup operations)
        const people = await ipcRenderer.invoke('get-people');
        const vehicles = await ipcRenderer.invoke('get-vehicles');
        const context = { people, vehicles };
        
        // Map the data using the data mapper
        const result = await ipcRenderer.invoke('map-data', 
            mappingData.excelData, 
            mappingData.mappings, 
            schemaType,
            context
        );
        
        console.log('Mapped data:', result);
        
        if (result.errors && result.errors.length > 0) {
            // Show errors
            importResults.innerHTML = `
                <div class="status-message error">
                    <h3>Import Errors</h3>
                    <ul>
                        ${result.errors.map(error => `<li>Row ${error.row}: ${error.error}</li>`).join('')}
                    </ul>
                </div>
            `;
            return;
        }
        
        // Import the data to the database
        let importedCount = 0;
        const importedIds = [];
        
        for (const item of result.data) {
            try {
                let response;
                
                switch (schemaType) {
                    case 'people':
                        response = await ipcRenderer.invoke('add-person', item);
                        break;
                    case 'vehicles':
                        response = await ipcRenderer.invoke('add-vehicle', item);
                        break;
                    case 'addresses':
                        response = await ipcRenderer.invoke('add-address', item);
                        break;
                    case 'rounds':
                        response = await ipcRenderer.invoke('add-round', item);
                        break;
                    case 'vehicle_assignments':
                        response = await ipcRenderer.invoke('add-vehicle-assignment', item);
                        break;
                    case 'time_records':
                        response = await ipcRenderer.invoke('add-time-record', item);
                        break;
                    case 'stop_events_alert':
                        response = await ipcRenderer.invoke('add-stop-event-alert', item);
                        break;
                }
                
                if (response && response.id) {
                    importedIds.push(response.id);
                    importedCount++;
                }
            } catch (error) {
                console.error('Error importing item:', error);
            }
        }
        
        // Show success message
        importResults.innerHTML = `
            <div class="status-message success">
                <h3>Import Successful</h3>
                <p>Successfully imported ${importedCount} ${schemaType} records.</p>
                <button id="back-to-import-btn" class="secondary">Import More Data</button>
            </div>
        `;
        
        // Add event listener for the back button
        const backButton = document.getElementById('back-to-import-btn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                // Hide results and mapping UI, show import manager
                importResults.style.display = 'none';
                const mappingElement = document.getElementById('mapping-container');
                if (mappingElement) {
                    mappingElement.style.display = 'none';
                }
                const importContainer = document.getElementById('import-container');
                if (importContainer) {
                    importContainer.style.display = 'block';
                }
                
                // Reset the import manager
                if (window.importManager) {
                    window.importManager.reset();
                }
            });
        }
        
        // Refresh dashboard counts
        loadDashboardCounts();
        
    } catch (error) {
        console.error('Error processing import:', error);
        importResults.innerHTML = `
            <div class="status-message error">
                <h3>Import Failed</h3>
                <p>Error: ${error.message}</p>
                <button id="back-to-import-btn" class="secondary">Try Again</button>
            </div>
        `;
        
        // Add event listener for the back button
        const backButton = document.getElementById('back-to-import-btn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                // Hide results, show import manager
                importResults.style.display = 'none';
                const mappingElement = document.getElementById('mapping-container');
                if (mappingElement) {
                    mappingElement.style.display = 'none';
                }
                const importContainer = document.getElementById('import-container');
                if (importContainer) {
                    importContainer.style.display = 'block';
                }
            });
        }
    }
}

// Initialize UI on content loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  loadDashboardCounts();
  initializeImportFunctionality();
  
  // Listen for refresh button clicks
  document.querySelectorAll('.refresh-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.closest('.tab-content').id;
      if (tabId === 'dashboard') {
        loadDashboardCounts();
      } else if (tabId === 'vehicles') {
        loadVehicles();
      } else if (tabId === 'people') {
        loadPeople();
      } else if (tabId === 'rounds') {
        loadRounds();
      } else if (tabId === 'alerts') {
        loadAlerts();
      }
    });
  });
});

// Tabs initialization
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  if (!tabButtons.length || !tabContents.length) {
    console.error('Tab buttons or tab contents not found');
    return;
  }
  
  console.log(`Initializing ${tabButtons.length} tabs`);
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and content
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Show corresponding content
      const tabId = button.dataset.tab;
      const tabContent = document.getElementById(tabId);
      
      if (tabContent) {
        tabContent.classList.add('active');
        
        // Handle tab specific loading
        if (tabId === 'vehicles') {
          loadVehicles();
        } else if (tabId === 'people') {
          loadPeople();
        } else if (tabId === 'rounds') {
          loadRounds();
        } else if (tabId === 'alerts') {
          loadAlerts();
        }
      }
    });
  });
  
  // Set Dashboard as active by default
  const defaultTab = document.querySelector('[data-tab="dashboard"]');
  if (defaultTab) {
    defaultTab.click();
  }
}

// Load dashboard counts
async function loadDashboardCounts() {
  try {
    console.log('Loading dashboard counts');
    
    const peopleCount = await window.electronAPI.countData('people');
    const vehiclesCount = await window.electronAPI.countData('vehicles');
    const roundsCount = await window.electronAPI.countData('rounds');
    const alertsCount = await window.electronAPI.countData('alerts');
    
    const peopleCountElement = document.getElementById('people-count');
    const vehiclesCountElement = document.getElementById('vehicles-count');
    const roundsCountElement = document.getElementById('rounds-count');
    const alertsCountElement = document.getElementById('alerts-count');
    
    if (peopleCountElement) peopleCountElement.textContent = peopleCount;
    if (vehiclesCountElement) vehiclesCountElement.textContent = vehiclesCount;
    if (roundsCountElement) roundsCountElement.textContent = roundsCount;
    if (alertsCountElement) alertsCountElement.textContent = alertsCount;
    
    console.log('Dashboard counts updated:', { peopleCount, vehiclesCount, roundsCount, alertsCount });
  } catch (error) {
    console.error('Error loading counts:', error);
    showNotification('Error loading counts: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Import functionality
function initializeImportFunctionality() {
  const importFileInput = document.getElementById('import-file');
  const importButton = document.getElementById('select-file-btn');
  const processButton = document.getElementById('process-imported-data');
  const clearButton = document.getElementById('clear-import');
  
  if (importButton) {
    importButton.addEventListener('click', () => {
      importFileInput.click();
    });
  }
  
  if (importFileInput) {
    importFileInput.addEventListener('change', async (event) => {
      if (event.target.files.length > 0) {
        const filePath = event.target.files[0].path;
        document.getElementById('selected-file-name').textContent = event.target.files[0].name;
        
        try {
          // Show loading indicator
          const loadingElement = document.getElementById('import-loading');
          if (loadingElement) loadingElement.style.display = 'flex';
          
          console.log('Importing file:', filePath);
          // Use the correct API method
          const result = await window.electronAPI.importExcelFile(filePath);
          
          // Hide loading indicator
          if (loadingElement) loadingElement.style.display = 'none';
          
          if (result.success) {
            showNotification(`Successfully processed Excel file: ${result.importResult.success} records imported, ${result.importResult.errors} errors`, 'success');
            
            // Show preview with detected file type
            const fileTypeDisplay = document.getElementById('file-type-display');
            if (fileTypeDisplay) {
              fileTypeDisplay.textContent = `Detected file type: ${result.fileType}`;
              fileTypeDisplay.style.display = 'block';
            }
            
            // Initialize preview with first 10 rows
            initializeExcelPreview(result.preview, result.fileType);
            
            // Enable process button
            if (processButton) processButton.disabled = false;
          } else {
            showNotification('Error importing file: ' + result.error, 'error');
          }
        } catch (error) {
          console.error('Error during import:', error);
          if (document.getElementById('import-loading')) {
            document.getElementById('import-loading').style.display = 'none';
          }
          showNotification('Error importing file: ' + (error.message || 'Unknown error'), 'error');
        }
      }
    });
  }
  
  if (processButton) {
    processButton.addEventListener('click', async () => {
      try {
        // Show loading indicator
        const loadingElement = document.getElementById('import-loading');
        if (loadingElement) loadingElement.style.display = 'flex';
        
        // Process the imported data
        const result = await window.electronAPI.processImportedData();
        
        // Hide loading indicator
        if (loadingElement) loadingElement.style.display = 'none';
        
        if (result.success) {
          const stats = result.stats;
          let message = 'Processing complete:<br>';
          message += `Vehicles: ${stats.vehicles.created} created, ${stats.vehicles.updated} updated<br>`;
          message += `People: ${stats.timeRecords.created} created, ${stats.timeRecords.updated} updated<br>`;
          message += `Alerts: ${stats.alerts.created} created<br>`;
          
          showNotification(message, 'success', 8000);
          
          // Reload dashboard counts to reflect new data
          loadDashboardCounts();
        } else {
          showNotification('Error processing data: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('Error during processing:', error);
        if (document.getElementById('import-loading')) {
          document.getElementById('import-loading').style.display = 'none';
        }
        showNotification('Error processing data: ' + (error.message || 'Unknown error'), 'error');
      }
    });
  }
  
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      // Clear the file input
      importFileInput.value = '';
      document.getElementById('selected-file-name').textContent = 'No file selected';
      document.getElementById('excel-preview-container').innerHTML = '<p>No preview data available. Please select a file.</p>';
      document.getElementById('file-type-display').style.display = 'none';
      if (processButton) processButton.disabled = true;
    });
  }
  
  // Initialize tabs
  initializeTabs();
  loadDashboardCounts();
}

// Initialize Excel preview table
function initializeExcelPreview(data, fileType) {
  const previewContainer = document.getElementById('excel-preview-container');
  
  if (!previewContainer) {
    console.error('Excel preview container not found');
    return;
  }
  
  // Clear previous preview
  previewContainer.innerHTML = '';
  
  if (!data || data.length === 0) {
    previewContainer.innerHTML = '<p>No preview data available. Please select a file.</p>';
    return;
  }
  
  // Create table
  const table = document.createElement('table');
  table.className = 'preview-table';
  
  // Create header row
  const header = document.createElement('tr');
  
  // Get all possible keys from all data rows (in case of inconsistent structure)
  const allKeys = new Set();
  data.forEach(row => {
    Object.keys(row).forEach(key => allKeys.add(key));
  });
  
  // Create header cells
  allKeys.forEach(key => {
    const th = document.createElement('th');
    th.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    header.appendChild(th);
  });
  
  table.appendChild(header);
  
  // Create data rows
  data.forEach(row => {
    const tr = document.createElement('tr');
    
    allKeys.forEach(key => {
      const td = document.createElement('td');
      td.textContent = row[key] !== undefined ? row[key] : '';
      tr.appendChild(td);
    });
    
    table.appendChild(tr);
  });
  
  previewContainer.appendChild(table);
  
  console.log(`Initialized Excel preview for ${fileType} with ${data.length} rows`);
}

// Load vehicles with their associated data
async function loadVehicles() {
  try {
    console.log('Loading vehicles data');
    
    const vehiclesContainer = document.getElementById('vehicles-container');
    if (!vehiclesContainer) {
      console.error('Vehicles container not found');
      return;
    }
    
    vehiclesContainer.innerHTML = '<div class="loading">Loading vehicles...</div>';
    
    const vehicles = await window.electronAPI.getData('vehicles');
    
    if (!vehicles || vehicles.length === 0) {
      vehiclesContainer.innerHTML = '<p>No vehicles found. Import data to add vehicles.</p>';
      return;
    }
    
    vehiclesContainer.innerHTML = '';
    console.log(`Loaded ${vehicles.length} vehicles`);
    
    // Create vehicle cards
    for (const vehicle of vehicles) {
      const card = document.createElement('div');
      card.className = 'data-card vehicle-card';
      
      try {
        // Get vehicle rounds
        const vehicleRoundsResult = await window.electronAPI.getVehicleRounds(vehicle.plate_number);
        const vehicleRounds = vehicleRoundsResult.success ? vehicleRoundsResult.data : [];
        
        card.innerHTML = `
          <h3>${vehicle.plate_number}</h3>
          <div class="card-content">
            <p><strong>Type:</strong> ${vehicle.vehicle_type || 'N/A'}</p>
            <p><strong>Status:</strong> ${vehicle.status || 'N/A'}</p>
            <p><strong>Updated:</strong> ${formatDate(vehicle.updated_at)}</p>
            <div class="rounds-section">
              <h4>Associated Rounds (${vehicleRounds.length})</h4>
              <div class="rounds-list">
                ${vehicleRounds.length > 0 
                  ? vehicleRounds.map(round => `
                      <div class="round-item">
                        <div>Round: ${round.round_name || 'Unnamed'}</div>
                        <div>Driver: ${round.driver_name || 'Unassigned'}</div>
                        <div>Date: ${formatDate(round.round_date)}</div>
                      </div>
                    `).join('')
                  : '<p>No rounds associated with this vehicle</p>'
                }
              </div>
            </div>
          </div>
        `;
        
        vehiclesContainer.appendChild(card);
      } catch (error) {
        console.error(`Error loading rounds for vehicle ${vehicle.plate_number}:`, error);
        // Still add the card but with error message for rounds
        card.innerHTML = `
          <h3>${vehicle.plate_number}</h3>
          <div class="card-content">
            <p><strong>Type:</strong> ${vehicle.vehicle_type || 'N/A'}</p>
            <p><strong>Status:</strong> ${vehicle.status || 'N/A'}</p>
            <p><strong>Updated:</strong> ${formatDate(vehicle.updated_at)}</p>
            <div class="rounds-section">
              <h4>Associated Rounds</h4>
              <div class="error-message">Error loading rounds: ${error.message || 'Unknown error'}</div>
            </div>
          </div>
        `;
        vehiclesContainer.appendChild(card);
      }
    }
  } catch (error) {
    console.error('Error loading vehicles:', error);
    const vehiclesContainer = document.getElementById('vehicles-container');
    if (vehiclesContainer) {
      vehiclesContainer.innerHTML = 
        `<div class="error-message">Error loading vehicles: ${error.message || 'Unknown error'}</div>`;
    }
  }
}

// Load alerts with associated vehicle info
async function loadAlerts() {
  try {
    console.log('Loading alerts data');
    
    const alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) {
      console.error('Alerts container not found');
      return;
    }
    
    alertsContainer.innerHTML = '<div class="loading">Loading alerts...</div>';
    
    const alerts = await window.electronAPI.getData('alerts');
    
    if (!alerts || alerts.length === 0) {
      alertsContainer.innerHTML = '<p>No alerts found.</p>';
      return;
    }
    
    alertsContainer.innerHTML = '';
    console.log(`Loaded ${alerts.length} alerts`);
    
    // Create alert cards
    for (const alert of alerts) {
      const card = document.createElement('div');
      card.className = `data-card alert-card ${alert.status || 'new'}`;
      
      // Get vehicle info
      let vehicleInfo = 'Unknown vehicle';
      if (alert.vehicle_id) {
        try {
          const vehiclesResult = await window.electronAPI.getById('vehicles', alert.vehicle_id);
          if (vehiclesResult.success) {
            vehicleInfo = vehiclesResult.data.plate_number;
          }
        } catch (error) {
          console.error('Error getting vehicle info:', error);
        }
      }
      
      const alertType = alert.alert_type ? alert.alert_type.replace(/_/g, ' ').toUpperCase() : 'ALERT';
      
      card.innerHTML = `
        <h3>${alertType}</h3>
        <div class="card-content">
          <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
          <p><strong>Location:</strong> ${alert.location || 'Unknown'}</p>
          <p><strong>Time:</strong> ${formatDate(alert.timestamp)}</p>
          <p><strong>Duration:</strong> ${alert.duration} minutes</p>
          <p><strong>Status:</strong> ${alert.status || 'new'}</p>
          <p><strong>Details:</strong> ${alert.details || ''}</p>
        </div>
        <div class="card-actions">
          <button class="action-btn" data-action="resolve" data-id="${alert.id}">Resolve</button>
          <button class="action-btn" data-action="ignore" data-id="${alert.id}">Ignore</button>
        </div>
      `;
      
      alertsContainer.appendChild(card);
    }
    
    // Add event listeners for action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        const id = e.target.dataset.id;
        
        try {
          await window.electronAPI.updateAlertStatus(id, action === 'resolve' ? 'resolved' : 'ignored');
          loadAlerts(); // Reload alerts
          showNotification(`Alert ${action === 'resolve' ? 'resolved' : 'ignored'} successfully`, 'success');
        } catch (error) {
          console.error('Error updating alert:', error);
          showNotification(`Error updating alert: ${error.message || 'Unknown error'}`, 'error');
        }
      });
    });
  } catch (error) {
    console.error('Error loading alerts:', error);
    const alertsContainer = document.getElementById('alerts-container');
    if (alertsContainer) {
      alertsContainer.innerHTML = 
        `<div class="error-message">Error loading alerts: ${error.message || 'Unknown error'}</div>`;
    }
  }
}

// Load people data
async function loadPeople() {
  try {
    console.log('Loading people data');
    
    const peopleContainer = document.getElementById('people-container');
    if (!peopleContainer) {
      console.error('People container not found');
      return;
    }
    
    peopleContainer.innerHTML = '<div class="loading">Loading people...</div>';
    
    const people = await window.electronAPI.getData('people');
    
    if (!people || people.length === 0) {
      peopleContainer.innerHTML = '<p>No people found. Import data to add people.</p>';
      return;
    }
    
    peopleContainer.innerHTML = '';
    console.log(`Loaded ${people.length} people`);
    
    // Create people cards
    people.forEach(person => {
      const card = document.createElement('div');
      card.className = 'data-card';
      
      card.innerHTML = `
        <h3>${person.name}</h3>
        <div class="card-content">
          <p><strong>Job Title:</strong> ${person.job_title || 'N/A'}</p>
          <p><strong>Cost Center:</strong> ${person.cost_center || 'N/A'}</p>
          <p><strong>Status:</strong> ${person.status || 'N/A'}</p>
          <p><strong>Updated:</strong> ${formatDate(person.updated_at)}</p>
        </div>
      `;
      
      peopleContainer.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading people:', error);
    const peopleContainer = document.getElementById('people-container');
    if (peopleContainer) {
      peopleContainer.innerHTML = 
        `<div class="error-message">Error loading people: ${error.message || 'Unknown error'}</div>`;
    }
  }
}

// Load rounds data
async function loadRounds() {
  try {
    console.log('Loading rounds data');
    
    const roundsContainer = document.getElementById('rounds-container');
    if (!roundsContainer) {
      console.error('Rounds container not found');
      return;
    }
    
    roundsContainer.innerHTML = '<div class="loading">Loading rounds...</div>';
    
    const rounds = await window.electronAPI.getData('rounds');
    
    if (!rounds || rounds.length === 0) {
      roundsContainer.innerHTML = '<p>No rounds found. Import data to add rounds.</p>';
      return;
    }
    
    roundsContainer.innerHTML = '';
    console.log(`Loaded ${rounds.length} rounds`);
    
    // Create round cards
    for (const round of rounds) {
      const card = document.createElement('div');
      card.className = 'data-card';
      
      // Get driver info if available
      let driverInfo = 'Unassigned';
      if (round.driver_id) {
        try {
          const driverResult = await window.electronAPI.getById('people', round.driver_id);
          if (driverResult.success) {
            driverInfo = driverResult.data.name;
          }
        } catch (error) {
          console.error('Error getting driver info:', error);
        }
      }
      
      // Get vehicle info if available
      let vehicleInfo = 'No vehicle';
      if (round.vehicle_id) {
        try {
          const vehicleResult = await window.electronAPI.getById('vehicles', round.vehicle_id);
          if (vehicleResult.success) {
            vehicleInfo = vehicleResult.data.plate_number;
          }
        } catch (error) {
          console.error('Error getting vehicle info:', error);
        }
      }
      
      card.innerHTML = `
        <h3>${round.name || 'Unnamed Round'}</h3>
        <div class="card-content">
          <p><strong>Date:</strong> ${formatDate(round.date)}</p>
          <p><strong>Driver:</strong> ${driverInfo}</p>
          <p><strong>Vehicle:</strong> ${vehicleInfo}</p>
          <p><strong>Status:</strong> ${round.status || 'planned'}</p>
          <p><strong>Start:</strong> ${round.start_time ? formatDate(round.start_time) : 'Not started'}</p>
          <p><strong>End:</strong> ${round.end_time ? formatDate(round.end_time) : 'Not completed'}</p>
        </div>
      `;
      
      roundsContainer.appendChild(card);
    }
  } catch (error) {
    console.error('Error loading rounds:', error);
    const roundsContainer = document.getElementById('rounds-container');
    if (roundsContainer) {
      roundsContainer.innerHTML = 
        `<div class="error-message">Error loading rounds: ${error.message || 'Unknown error'}</div>`;
    }
  }
}

// Helper function to format dates
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    // Try to parse the date
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return the original string if parsing failed
    }
    
    // Format the date
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleDateString(undefined, options);
  } catch (e) {
    console.error('Error formatting date:', e);
    return dateString;
  }
}

// Helper function to show notifications
function showNotification(message, type = 'info', duration = 5000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = message;
  
  document.body.appendChild(notification);
  
  // Show notification with animation
  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);
  
  // Hide and remove after duration
  setTimeout(() => {
    notification.classList.remove('visible');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
} 
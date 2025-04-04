// Import required modules
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

// DOM elements
const navItems = document.querySelectorAll('.nav-item');
const pageTitle = document.getElementById('page-title');
const pages = document.querySelectorAll('.page');
const fileDropArea = document.querySelector('.file-drop-area');
const selectExcelBtn = document.getElementById('select-excel-btn');
const importInfo = document.querySelector('.import-info');
const fileNameElement = document.querySelector('.file-name');
const fileSizeElement = document.querySelector('.file-size');
const removeFileBtn = document.querySelector('.remove-file-btn');
const sheetSelect = document.getElementById('sheet-select');
const previewBtn = document.getElementById('preview-btn');
const startImportBtn = document.getElementById('start-import-btn');
const previewTable = document.getElementById('preview-table');
const columnMapping = document.querySelector('.column-mapping');
const mappingContainer = document.getElementById('mapping-container');
const selectDbLocationBtn = document.getElementById('select-db-location-btn');
const dbLocationInput = document.getElementById('db-location');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const modal = document.getElementById('main-modal');
const modalTitle = document.querySelector('.modal-title');
const modalBody = document.querySelector('.modal-body');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const closeModalBtn = document.querySelector('.close-btn');
const toastContainer = document.getElementById('toast-container');

// Variables to store current state
let currentFile = null;
let currentSheets = [];
let currentSheet = null;
let currentData = null;
let previewData = null;
let headerRow = 0;

// ====================
// Navigation functions
// ====================
function navigateTo(pageName) {
    // Update active nav item
    navItems.forEach(item => {
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update page title
    pageTitle.textContent = pageName.charAt(0).toUpperCase() + pageName.slice(1);

    // Show active page
    pages.forEach(page => {
        if (page.id === `${pageName}-page`) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
    });
}

// Initialize navigation event listeners
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navigateTo(item.dataset.page);
    });
});

// ====================
// File Import functions
// ====================
function handleFileSelect(file) {
    if (!file) return;
    
    // Check if this is an Excel file
    const fileExtension = path.extname(file.path).toLowerCase();
    if (fileExtension !== '.xlsx' && fileExtension !== '.xls') {
        showToast('Please select an Excel file (.xlsx or .xls)', 'error', 'Invalid File');
        return;
    }

    currentFile = file;
    
    // Update UI
    fileNameElement.textContent = file.name;
    fileSizeElement.textContent = formatFileSize(file.size);
    importInfo.style.display = 'block';
    
    // Reset other UI elements
    sheetSelect.innerHTML = '';
    previewTable.innerHTML = '<thead><tr><th>No data to preview</th></tr></thead><tbody><tr><td>Select a sheet to preview data</td></tr></tbody>';
    columnMapping.style.display = 'none';
    startImportBtn.disabled = true;
    
    // Read sheets from the Excel file
    readSheets(file.path);
}

function readSheets(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        currentSheets = workbook.SheetNames;
        
        // Populate sheet select dropdown
        sheetSelect.innerHTML = '';
        currentSheets.forEach(sheet => {
            const option = document.createElement('option');
            option.value = sheet;
            option.textContent = sheet;
            sheetSelect.appendChild(option);
        });
        
        // Select first sheet by default
        if (currentSheets.length > 0) {
            currentSheet = currentSheets[0];
        }
    } catch (error) {
        showToast(`Error reading Excel file: ${error.message}`, 'error', 'Error');
    }
}

function previewExcelData() {
    if (!currentFile || !currentSheet) {
        showToast('Please select a file and sheet first', 'warning', 'Missing Information');
        return;
    }
    
    try {
        // Use ExcelJS for better handling of merged cells
        const workbook = new ExcelJS.Workbook();
        workbook.xlsx.readFile(currentFile.path)
            .then(() => {
                const worksheet = workbook.getWorksheet(currentSheet);
                
                if (!worksheet) {
                    showToast('Sheet not found', 'error', 'Error');
                    return;
                }
                
                // Try to detect header row
                headerRow = detectHeaderRow(worksheet);
                
                // Convert worksheet data to array
                const data = worksheetToArray(worksheet);
                currentData = data;
                
                // Show preview (first 10 rows)
                displayPreview(data, Math.min(10, data.length));
                
                // Show column mapping options
                displayColumnMapping(data[headerRow]);
                
                // Enable import button
                startImportBtn.disabled = false;
            })
            .catch(error => {
                showToast(`Error previewing data: ${error.message}`, 'error', 'Error');
            });
    } catch (error) {
        showToast(`Error previewing data: ${error.message}`, 'error', 'Error');
    }
}

function detectHeaderRow(worksheet) {
    // Simple header detection algorithm
    // This can be enhanced with more sophisticated logic
    let headerRowIndex = 0;
    
    // Look at first 10 rows and try to find a header row
    for (let i = 1; i <= 10 && i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        let filledCells = 0;
        let totalCells = 0;
        
        row.eachCell({ includeEmpty: false }, cell => {
            totalCells++;
            if (cell.value) filledCells++;
        });
        
        // If the row has at least 3 filled cells and more than 50% of cells are filled
        if (filledCells >= 3 && filledCells / totalCells >= 0.5) {
            headerRowIndex = i - 1; // Convert to 0-based index
            break;
        }
    }
    
    return headerRowIndex;
}

function worksheetToArray(worksheet) {
    const data = [];
    
    // Handle merged cells
    const mergedCells = {};
    if (worksheet.hasMerges) {
        // Create a map of merged cells
        worksheet.mergeCells.forEach(mergeCell => {
            const cellAddress = mergeCell.split(':')[0];
            const startCell = worksheet.getCell(cellAddress);
            const startValue = startCell.value;
            
            for (let row = mergeCell.top; row <= mergeCell.bottom; row++) {
                for (let col = mergeCell.left; col <= mergeCell.right; col++) {
                    const cellRef = `${row},${col}`;
                    mergedCells[cellRef] = startValue;
                }
            }
        });
    }
    
    // Convert worksheet to array, handling merged cells
    worksheet.eachRow({ includeEmpty: true }, (row, rowIndex) => {
        const rowData = [];
        
        // Get the maximum column count
        let maxCol = 0;
        row.eachCell({ includeEmpty: false }, cell => {
            if (cell.col > maxCol) maxCol = cell.col;
        });
        
        // Fill the row with cells (including empty ones)
        for (let colIndex = 1; colIndex <= maxCol; colIndex++) {
            // Check if this cell is part of a merged range
            const mergedValue = mergedCells[`${rowIndex},${colIndex}`];
            
            if (mergedValue !== undefined) {
                rowData.push(mergedValue);
            } else {
                const cell = row.getCell(colIndex);
                rowData.push(cell.value || '');
            }
        }
        
        data.push(rowData);
    });
    
    return data;
}

function displayPreview(data, rowCount) {
    if (!data || data.length === 0) {
        previewTable.innerHTML = '<thead><tr><th>No data to preview</th></tr></thead><tbody><tr><td>No data available</td></tr></tbody>';
        return;
    }
    
    // Create table header (using detected header row)
    const headerRowData = data[headerRow] || [];
    let tableHtml = '<thead><tr>';
    
    headerRowData.forEach((cell, index) => {
        tableHtml += `<th>Column ${index + 1}: ${cell || 'Unnamed'}</th>`;
    });
    
    tableHtml += '</tr></thead><tbody>';
    
    // Create table rows for preview
    // Skip header row in the preview data
    for (let i = headerRow + 1; i < headerRow + rowCount + 1 && i < data.length; i++) {
        const row = data[i];
        tableHtml += '<tr>';
        
        // Handle rows with fewer cells than header
        for (let j = 0; j < headerRowData.length; j++) {
            tableHtml += `<td>${row[j] || ''}</td>`;
        }
        
        tableHtml += '</tr>';
    }
    
    tableHtml += '</tbody>';
    previewTable.innerHTML = tableHtml;
}

function displayColumnMapping(headerRow) {
    if (!headerRow) return;
    
    const importType = document.getElementById('import-type').value;
    let databaseColumns = [];
    
    // Set database columns based on import type
    switch (importType) {
        case 'drivers':
            databaseColumns = ['id', 'name', 'role', 'costcenter', 'phone', 'email', 'license_type', 'status'];
            break;
        case 'vehicles':
            databaseColumns = ['id', 'platenumber', 'weight', 'packtime', 'type', 'status', 'max_capacity'];
            break;
        case 'rounds':
            databaseColumns = ['id', 'date', 'day', 'köridő', 'addresses', 'platenumber', 'driver', 'addressCounts', 
                              'OverallWeight', 'RoundStart', 'RoundEnd', 'Packtime', 'WorktimeStart', 'WorktimeEnd', 
                              'SavedTime', 'DeltaDriveTime'];
            break;
        case 'addresses':
            databaseColumns = ['id', 'district', 'city', 'postal_code', 'notes', 'delivery_restrictions'];
            break;
        default:
            databaseColumns = [];
    }
    
    // Create mapping UI
    let mappingHtml = '';
    headerRow.forEach((column, index) => {
        mappingHtml += `
            <div class="mapping-row">
                <div class="excel-column">Excel: ${column || `Column ${index + 1}`}</div>
                <div class="mapping-arrow">→</div>
                <div class="db-column">
                    <select class="form-control mapping-select" data-excel-col="${index}">
                        <option value="">-- Ignore --</option>
                        ${databaseColumns.map(col => `<option value="${col}">${col}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
    });
    
    mappingContainer.innerHTML = mappingHtml;
    columnMapping.style.display = 'block';
    
    // Try to auto-map columns based on similarity
    autoMapColumns(headerRow, databaseColumns);
}

function autoMapColumns(excelHeaders, dbColumns) {
    const mappingSelects = document.querySelectorAll('.mapping-select');
    
    excelHeaders.forEach((header, index) => {
        if (!header) return;
        
        // Normalize the header
        const normalizedHeader = header.toString().toLowerCase().trim();
        
        // Find best matching database column
        let bestMatch = null;
        let bestScore = 0;
        
        dbColumns.forEach(dbCol => {
            const dbColNormalized = dbCol.toLowerCase();
            
            // Check if the Excel header contains the database column name
            if (normalizedHeader.includes(dbColNormalized)) {
                const score = dbColNormalized.length / normalizedHeader.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = dbCol;
                }
            }
        });
        
        // Apply the match if score is above threshold
        if (bestScore > 0.3 && bestMatch) {
            mappingSelects[index].value = bestMatch;
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ====================
// Toast notifications
// ====================
function showToast(message, type = 'info', title = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Add click event to close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ====================
// Modal functions
// ====================
function showModal(title, content, confirmCallback, cancelCallback) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    
    modal.classList.add('show');
    
    // Set up button handlers
    modalConfirmBtn.onclick = () => {
        if (confirmCallback) confirmCallback();
        closeModal();
    };
    
    modalCancelBtn.onclick = () => {
        if (cancelCallback) cancelCallback();
        closeModal();
    };
}

function closeModal() {
    modal.classList.remove('show');
}

// ====================
// Settings functions
// ====================
async function loadDatabaseLocation() {
    const dbPath = await ipcRenderer.invoke('get-database-location');
    dbLocationInput.value = dbPath || 'Default location (App Data)';
}

async function selectDatabaseLocation() {
    const selectedPath = await ipcRenderer.invoke('select-directory');
    if (selectedPath) {
        dbLocationInput.value = selectedPath;
        await ipcRenderer.invoke('save-database-location', selectedPath);
        showToast('Database location updated successfully', 'success', 'Settings Saved');
    }
}

// ====================
// Event listeners
// ====================
// File drop area
if (fileDropArea) {
    fileDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDropArea.classList.add('drag-over');
    });
    
    fileDropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDropArea.classList.remove('drag-over');
    });
    
    fileDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDropArea.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
}

// Select Excel button
if (selectExcelBtn) {
    selectExcelBtn.addEventListener('click', async () => {
        const filePath = await ipcRenderer.invoke('select-file');
        if (filePath) {
            const fileStats = fs.statSync(filePath);
            handleFileSelect({
                path: filePath,
                name: path.basename(filePath),
                size: fileStats.size
            });
        }
    });
}

// Remove file button
if (removeFileBtn) {
    removeFileBtn.addEventListener('click', () => {
        currentFile = null;
        importInfo.style.display = 'none';
        columnMapping.style.display = 'none';
    });
}

// Preview button
if (previewBtn) {
    previewBtn.addEventListener('click', previewExcelData);
}

// Sheet select
if (sheetSelect) {
    sheetSelect.addEventListener('change', () => {
        currentSheet = sheetSelect.value;
    });
}

// Import type
if (document.getElementById('import-type')) {
    document.getElementById('import-type').addEventListener('change', () => {
        if (currentData && currentData.length > 0) {
            displayColumnMapping(currentData[headerRow]);
        }
    });
}

// Database location button
if (selectDbLocationBtn) {
    selectDbLocationBtn.addEventListener('click', selectDatabaseLocation);
}

// Modal close button
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
}

// ====================
// Initialization
// ====================
document.addEventListener('DOMContentLoaded', () => {
    // Load database location on settings page
    loadDatabaseLocation();
    
    // Show dashboard by default
    navigateTo('dashboard');
}); 
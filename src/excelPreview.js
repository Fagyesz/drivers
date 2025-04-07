const { ipcRenderer } = require('electron');
const XLSX = require('xlsx');

/**
 * Excel Preview component for visualizing Excel data with merged cells
 */
class ExcelPreview {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container element with ID "${containerId}" not found`);
        }
        
        this.options = {
            maxPreviewRows: 100,
            showRowNumbers: true,
            highlightHeaderRow: true,
            ...options
        };
        
        this.data = null;
        this.sheetNames = [];
        this.currentSheetName = null;
        this.headerRowIndex = 0;
        this.setupElements();
    }
    
    /**
     * Set up the UI elements
     */
    setupElements() {
        // Clear the container
        this.container.innerHTML = '';
        this.container.classList.add('excel-preview-container');
        
        // Create file selection section
        const fileSection = document.createElement('div');
        fileSection.className = 'file-section';
        
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.xlsx, .xls';
        this.fileInput.className = 'file-input';
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        const fileLabel = document.createElement('label');
        fileLabel.className = 'file-label';
        fileLabel.innerText = 'Select Excel File';
        fileLabel.appendChild(this.fileInput);
        
        this.fileNameDisplay = document.createElement('div');
        this.fileNameDisplay.className = 'file-name';
        
        fileSection.appendChild(fileLabel);
        fileSection.appendChild(this.fileNameDisplay);
        
        // Create sheet selection section
        const sheetSection = document.createElement('div');
        sheetSection.className = 'sheet-section';
        
        const sheetLabel = document.createElement('label');
        sheetLabel.innerText = 'Sheet: ';
        
        this.sheetSelect = document.createElement('select');
        this.sheetSelect.className = 'sheet-select';
        this.sheetSelect.disabled = true;
        this.sheetSelect.addEventListener('change', () => this.handleSheetChange());
        
        sheetSection.appendChild(sheetLabel);
        sheetSection.appendChild(this.sheetSelect);
        
        // Create header row detection section
        const headerSection = document.createElement('div');
        headerSection.className = 'header-section';
        
        const headerLabel = document.createElement('label');
        headerLabel.innerText = 'Header Row: ';
        
        this.headerInput = document.createElement('input');
        this.headerInput.type = 'number';
        this.headerInput.min = '0';
        this.headerInput.value = '0';
        this.headerInput.className = 'header-input';
        this.headerInput.disabled = true;
        this.headerInput.addEventListener('change', () => this.handleHeaderChange());
        
        const detectHeaderBtn = document.createElement('button');
        detectHeaderBtn.innerText = 'Auto Detect';
        detectHeaderBtn.className = 'detect-header-btn';
        detectHeaderBtn.disabled = true;
        detectHeaderBtn.addEventListener('click', () => this.detectHeaderRow());
        
        headerSection.appendChild(headerLabel);
        headerSection.appendChild(this.headerInput);
        headerSection.appendChild(detectHeaderBtn);
        this.detectHeaderBtn = detectHeaderBtn;
        
        // Create table container
        this.tableContainer = document.createElement('div');
        this.tableContainer.className = 'table-container';
        
        // Create controls section
        const controlsSection = document.createElement('div');
        controlsSection.className = 'controls-section';
        
        this.importBtn = document.createElement('button');
        this.importBtn.innerText = 'Import Data';
        this.importBtn.className = 'import-btn';
        this.importBtn.disabled = true;
        this.importBtn.addEventListener('click', () => this.handleImport());
        
        controlsSection.appendChild(this.importBtn);
        
        // Add all sections to container
        this.container.appendChild(fileSection);
        this.container.appendChild(sheetSection);
        this.container.appendChild(headerSection);
        this.container.appendChild(this.tableContainer);
        this.container.appendChild(controlsSection);
        
        // Create status message
        this.statusMessage = document.createElement('div');
        this.statusMessage.className = 'status-message';
        this.container.appendChild(this.statusMessage);
    }
    
    /**
     * Handle file selection
     * @param {Event} event - File input change event
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.fileNameDisplay.innerText = file.name;
        this.statusMessage.innerText = 'Loading file...';
        this.statusMessage.className = 'status-message loading';
        
        try {
            // Get the file path using dialog
            const filePath = file.path;
            if (!filePath) {
                throw new Error('File path not available');
            }
            
            // Get sheet names
            this.sheetNames = await ipcRenderer.invoke('get-sheet-names', filePath);
            
            // Populate sheet selection dropdown
            this.sheetSelect.innerHTML = '';
            this.sheetNames.forEach(sheetName => {
                const option = document.createElement('option');
                option.value = sheetName;
                option.innerText = sheetName;
                this.sheetSelect.appendChild(option);
            });
            
            this.sheetSelect.disabled = false;
            this.headerInput.disabled = false;
            this.detectHeaderBtn.disabled = false;
            
            // Load the first sheet by default
            if (this.sheetNames.length > 0) {
                this.currentSheetName = this.sheetNames[0];
                this.sheetSelect.value = this.currentSheetName;
                await this.loadSheet(filePath, this.currentSheetName);
            }
            
            this.statusMessage.innerText = 'File loaded successfully';
            this.statusMessage.className = 'status-message success';
            
            // Enable import button
            this.importBtn.disabled = false;
        } catch (error) {
            console.error('Error loading Excel file:', error);
            this.statusMessage.innerText = `Error: ${error.message}`;
            this.statusMessage.className = 'status-message error';
        }
    }
    
    /**
     * Handle sheet selection change
     */
    async handleSheetChange() {
        const selectedSheet = this.sheetSelect.value;
        if (selectedSheet && selectedSheet !== this.currentSheetName) {
            this.currentSheetName = selectedSheet;
            
            // Get the file path from the file input
            const filePath = this.fileInput.files[0].path;
            if (filePath) {
                await this.loadSheet(filePath, selectedSheet);
            }
        }
    }
    
    /**
     * Handle header row input change
     */
    handleHeaderChange() {
        const headerRow = parseInt(this.headerInput.value, 10);
        if (!isNaN(headerRow) && headerRow >= 0) {
            this.headerRowIndex = headerRow;
            this.renderTable();
        }
    }
    
    /**
     * Automatically detect the header row
     */
    detectHeaderRow() {
        if (!this.data) return;
        
        // Find row with most non-empty cells
        let maxNonEmptyCells = 0;
        let headerRow = 0;
        
        this.data.forEach((row, index) => {
            if (!row) return;
            
            const nonEmptyCells = row.filter(cell => {
                return cell !== null && cell !== undefined && cell !== '';
            }).length;
            
            if (nonEmptyCells > maxNonEmptyCells) {
                maxNonEmptyCells = nonEmptyCells;
                headerRow = index;
            }
        });
        
        this.headerRowIndex = headerRow;
        this.headerInput.value = headerRow;
        this.renderTable();
    }
    
    /**
     * Load sheet data
     * @param {string} filePath - Path to the Excel file
     * @param {string} sheetName - Name of the sheet to load
     */
    async loadSheet(filePath, sheetName) {
        try {
            this.statusMessage.innerText = 'Loading sheet...';
            this.statusMessage.className = 'status-message loading';
            
            // Parse the sheet using the IPC renderer
            const sheetData = await ipcRenderer.invoke('parse-sheet', filePath, sheetName, {
                headerRowDetection: false
            });
            
            this.data = sheetData;
            this.renderTable();
            
            this.statusMessage.innerText = `Sheet "${sheetName}" loaded successfully`;
            this.statusMessage.className = 'status-message success';
        } catch (error) {
            console.error('Error loading sheet:', error);
            this.statusMessage.innerText = `Error: ${error.message}`;
            this.statusMessage.className = 'status-message error';
        }
    }
    
    /**
     * Render the Excel data as a table
     */
    renderTable() {
        if (!this.data || !this.data.length) {
            this.tableContainer.innerHTML = '<p>No data available</p>';
            return;
        }
        
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';
        
        const table = document.createElement('table');
        table.className = 'excel-table';
        
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Add row number header if enabled
        if (this.options.showRowNumbers) {
            const th = document.createElement('th');
            th.className = 'row-number-header';
            th.innerText = '#';
            headerRow.appendChild(th);
        }
        
        // Create table headers from the header row
        const headers = this.data[this.headerRowIndex] || [];
        headers.forEach((header, index) => {
            const th = document.createElement('th');
            th.innerText = header || `Column ${index + 1}`;
            th.dataset.columnIndex = index;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Limit the number of rows to display
        const maxRows = Math.min(this.options.maxPreviewRows, this.data.length);
        
        // Start from row after header row, or from row 0 if header row is beyond max preview
        const startRow = this.headerRowIndex + 1 < maxRows ? this.headerRowIndex + 1 : 0;
        
        for (let i = 0; i < maxRows; i++) {
            // Skip the header row if it's within the preview range
            if (i === this.headerRowIndex && i >= startRow) continue;
            
            const dataRow = this.data[i];
            if (!dataRow) continue;
            
            const tr = document.createElement('tr');
            
            // Add row number if enabled
            if (this.options.showRowNumbers) {
                const td = document.createElement('td');
                td.className = 'row-number';
                td.innerText = i + 1;
                tr.appendChild(td);
            }
            
            // Add data cells
            dataRow.forEach((cell, j) => {
                const td = document.createElement('td');
                td.innerText = cell !== null && cell !== undefined ? cell.toString() : '';
                tr.appendChild(td);
            });
            
            // Highlight header row if it's the current row
            if (i === this.headerRowIndex && this.options.highlightHeaderRow) {
                tr.classList.add('header-row');
            }
            
            tbody.appendChild(tr);
        }
        
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        
        // Clear the container and add the table
        this.tableContainer.innerHTML = '';
        this.tableContainer.appendChild(tableWrapper);
    }
    
    /**
     * Handle import button click
     */
    async handleImport() {
        if (!this.data || !this.currentSheetName) {
            this.statusMessage.innerText = 'No data to import';
            this.statusMessage.className = 'status-message error';
            return;
        }
        
        try {
            // Convert raw data to objects using header row
            const headers = this.data[this.headerRowIndex] || [];
            const objects = [];
            
            for (let i = 0; i < this.data.length; i++) {
                // Skip the header row
                if (i === this.headerRowIndex) continue;
                
                const row = this.data[i];
                if (!row) continue;
                
                const obj = {};
                headers.forEach((header, j) => {
                    if (header) {
                        obj[header] = row[j];
                    }
                });
                
                // Only add rows with data
                if (Object.keys(obj).length > 0) {
                    objects.push(obj);
                }
            }
            
            // Trigger the import event
            if (typeof this.options.onImport === 'function') {
                await this.options.onImport({
                    sheetName: this.currentSheetName,
                    headerRow: this.headerRowIndex,
                    headers,
                    data: objects,
                    rawData: this.data
                });
            }
            
            this.statusMessage.innerText = 'Data imported successfully';
            this.statusMessage.className = 'status-message success';
        } catch (error) {
            console.error('Error importing data:', error);
            this.statusMessage.innerText = `Import error: ${error.message}`;
            this.statusMessage.className = 'status-message error';
        }
    }

    // Add this static method to the ExcelPreview class
    static async parseExcelData(data) {
        try {
            // Use XLSX to parse the Excel data
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Process each sheet
            const sheets = [];
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Skip empty sheets
                if (jsonData.length === 0) {
                    continue;
                }
                
                sheets.push({
                    name: sheetName,
                    data: jsonData
                });
            }
            
            return {
                sheets: sheets,
                originalData: data
            };
        } catch (error) {
            console.error('Error parsing Excel data:', error);
            throw error;
        }
    }
}

/**
 * Create a preview of SysWeb data with multiple people sections
 * @param {Array} parsedData - Array of objects with person records
 * @returns {HTMLElement} Preview container element
 */
function createSysWebPreview(parsedData) {
    const container = document.createElement('div');
    container.className = 'sysweb-preview-container';
    
    if (!parsedData || parsedData.length === 0) {
        const noData = document.createElement('p');
        noData.textContent = 'No data found in the selected file.';
        container.appendChild(noData);
        return container;
    }
    
    // Group records by person name
    const personGroups = {};
    parsedData.forEach(record => {
        if (!record.name) return;
        
        if (!personGroups[record.name]) {
            personGroups[record.name] = [];
        }
        personGroups[record.name].push(record);
    });
    
    // Create accordion for each person
    Object.keys(personGroups).forEach(personName => {
        const personRecords = personGroups[personName];
        const personSection = document.createElement('div');
        personSection.className = 'person-section';
        
        // Create header with toggle functionality
        const header = document.createElement('div');
        header.className = 'person-header';
        header.innerHTML = `
            <div class="toggle-icon">➕</div>
            <h3>${personName}</h3>
            <div class="person-meta">
                <span>${personRecords[0].jobtitle || 'No job title'}</span>
                <span>${personRecords[0].costcenter || 'No cost center'}</span>
                <span>Records: ${personRecords.length}</span>
            </div>
        `;
        
        header.addEventListener('click', () => {
            // Toggle visibility
            if (recordsContainer.style.display === 'none') {
                recordsContainer.style.display = 'block';
                header.querySelector('.toggle-icon').textContent = '➖';
            } else {
                recordsContainer.style.display = 'none';
                header.querySelector('.toggle-icon').textContent = '➕';
            }
        });
        
        personSection.appendChild(header);
        
        // Create table for records
        const recordsContainer = document.createElement('div');
        recordsContainer.className = 'records-container';
        recordsContainer.style.display = 'none'; // Collapsed by default
        
        const table = document.createElement('table');
        table.className = 'records-table';
        
        // Create header row
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Date</th>
                <th>Planned Shift</th>
                <th>Actual</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Worked Time</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Create body rows
        const tbody = document.createElement('tbody');
        personRecords.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.date || ''}</td>
                <td>${record.planedshift || ''}</td>
                <td>${record.actual || ''}</td>
                <td>${record.check_in || ''}</td>
                <td>${record.check_out || ''}</td>
                <td>${record.workedTime || ''}</td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        recordsContainer.appendChild(table);
        personSection.appendChild(recordsContainer);
        container.appendChild(personSection);
    });
    
    // Add summary
    const summary = document.createElement('div');
    summary.className = 'preview-summary';
    summary.innerHTML = `
        <p>Found ${parsedData.length} records from ${Object.keys(personGroups).length} people.</p>
    `;
    container.appendChild(summary);
    
    return container;
}

/**
 * Display preview of SysWeb data
 * @param {Array} parsedData - Array of parsed records
 * @param {HTMLElement} targetElement - Container to display preview
 */
function displaySysWebPreview(parsedData, targetElement) {
    if (!targetElement) return;
    
    // Clear previous content
    targetElement.innerHTML = '';
    
    if (!parsedData || parsedData.length === 0) {
        targetElement.innerHTML = '<p>No data found in the selected file.</p>';
        return;
    }
    
    // Create and append the preview
    const preview = createSysWebPreview(parsedData);
    targetElement.appendChild(preview);
    
    // Add validation controls
    const controls = document.createElement('div');
    controls.className = 'preview-controls';
    controls.innerHTML = `
        <div class="validation-status">Data preview ready for import.</div>
        <div class="button-container">
            <button id="confirm-import-btn" class="button primary">Confirm Import</button>
            <button id="cancel-import-btn" class="button secondary">Cancel</button>
        </div>
    `;
    
    // Add event listeners to controls
    controls.querySelector('#confirm-import-btn').addEventListener('click', () => {
        console.log('Confirm import button clicked');
        // Trigger the actual import
        document.dispatchEvent(new CustomEvent('sysweb-import-confirmed', { 
            detail: { data: parsedData }
        }));
    });
    
    controls.querySelector('#cancel-import-btn').addEventListener('click', () => {
        console.log('Cancel import button clicked');
        targetElement.innerHTML = '<p>Import cancelled.</p>';
    });
    
    targetElement.appendChild(controls);
}

// Export module for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExcelPreview,
        createSysWebPreview,
        displaySysWebPreview
    };
} 

// Make it global for browser
if (typeof window !== 'undefined') {
    window.ExcelPreview = ExcelPreview;
    window.createSysWebPreview = createSysWebPreview;
    window.displaySysWebPreview = displaySysWebPreview;
    console.log('ExcelPreview exposed to window object');
} 
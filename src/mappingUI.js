const { ipcRenderer } = require('electron');

/**
 * Excel to Database Mapping UI component
 */
class MappingUI {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container element with ID "${containerId}" not found`);
        }
        
        this.options = {
            onSave: null,
            onCancel: null,
            ...options
        };
        
        this.excelData = null;
        this.mappingType = null;
        this.dbFields = [];
        this.mapping = {};
        this.validationErrors = {};
        
        this.setupElements();
    }
    
    /**
     * Set up the UI elements
     */
    setupElements() {
        // Clear the container
        this.container.innerHTML = '';
        this.container.classList.add('mapping-container');
        
        // Create mapping type selection
        const typeSection = document.createElement('div');
        typeSection.className = 'mapping-type-section';
        
        const typeLabel = document.createElement('label');
        typeLabel.innerText = 'Select data type to import: ';
        
        this.typeSelect = document.createElement('select');
        this.typeSelect.className = 'mapping-type-select';
        this.typeSelect.addEventListener('change', () => this.handleTypeChange());
        
        // Add mapping type options
        const mappingTypes = [
            { value: '', label: '-- Select data type --' },
            { value: 'people', label: 'People / Drivers' },
            { value: 'vehicles', label: 'Vehicles' },
            { value: 'addresses', label: 'Addresses' },
            { value: 'rounds', label: 'Rounds' },
            { value: 'vehicle_assignments', label: 'Vehicle Assignments' },
            { value: 'time_records', label: 'Time Records' },
            { value: 'stop_events_alert', label: 'Stop Events' }
        ];
        
        mappingTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.innerText = type.label;
            this.typeSelect.appendChild(option);
        });
        
        typeSection.appendChild(typeLabel);
        typeSection.appendChild(this.typeSelect);
        
        // Create mapping fields container
        this.mappingFields = document.createElement('div');
        this.mappingFields.className = 'mapping-fields';
        
        // Create action buttons
        const actionSection = document.createElement('div');
        actionSection.className = 'action-section';
        
        this.saveButton = document.createElement('button');
        this.saveButton.innerText = 'Save Mapping';
        this.saveButton.className = 'save-btn';
        this.saveButton.disabled = true;
        this.saveButton.addEventListener('click', () => this.handleSave());
        
        this.cancelButton = document.createElement('button');
        this.cancelButton.innerText = 'Cancel';
        this.cancelButton.className = 'cancel-btn secondary';
        this.cancelButton.addEventListener('click', () => this.handleCancel());
        
        actionSection.appendChild(this.saveButton);
        actionSection.appendChild(this.cancelButton);
        
        // Create status message
        this.statusMessage = document.createElement('div');
        this.statusMessage.className = 'status-message';
        
        // Add all sections to container
        this.container.appendChild(typeSection);
        this.container.appendChild(this.mappingFields);
        this.container.appendChild(actionSection);
        this.container.appendChild(this.statusMessage);
    }
    
    /**
     * Set Excel data from preview
     * @param {Object} data - Excel data with headers
     */
    setExcelData(data) {
        console.log('MappingUI.setExcelData called with', data ? 'data' : 'null');
        if (!data || !data.sheets || data.sheets.length === 0) {
            console.error('Invalid Excel data provided to MappingUI');
            return;
        }
        
        this.excelData = data;
        this.typeSelect.disabled = false;
        console.log('Excel data set with', data.sheets.length, 'sheets');
    }
    
    /**
     * Handle mapping type change
     */
    async handleTypeChange() {
        this.mappingType = this.typeSelect.value;
        if (!this.mappingType) {
            this.mappingFields.innerHTML = '';
            this.saveButton.disabled = true;
            return;
        }
        
        try {
            // Load database schema fields
            const schema = await ipcRenderer.invoke('get-schema-fields', this.mappingType);
            this.dbFields = schema || this.getDefaultFields(this.mappingType);
            
            // Render mapping UI
            this.renderMappingFields();
            this.saveButton.disabled = false;
        } catch (error) {
            console.error('Error loading schema fields:', error);
            this.statusMessage.innerText = `Error: ${error.message}`;
            this.statusMessage.className = 'status-message error';
        }
    }
    
    /**
     * Get default fields for a table (fallback if schema API is not available)
     * @param {string} tableType - Table type
     * @returns {Array} Array of field objects
     */
    getDefaultFields(tableType) {
        const fields = {
            people: [
                { name: 'name', label: 'Name', required: true },
                { name: 'role', label: 'Role', required: true },
                { name: 'costcenter', label: 'Cost Center' },
                { name: 'phone', label: 'Phone Number' },
                { name: 'email', label: 'Email Address' },
                { name: 'license_type', label: 'License Type' },
                { name: 'status', label: 'Status' }
            ],
            vehicles: [
                { name: 'platenumber', label: 'Plate Number', required: true },
                { name: 'weight', label: 'Weight' },
                { name: 'packtime', label: 'Pack Time' },
                { name: 'type', label: 'Vehicle Type' },
                { name: 'status', label: 'Status' },
                { name: 'max_capacity', label: 'Maximum Capacity' }
            ],
            addresses: [
                { name: 'district', label: 'District', required: true },
                { name: 'city', label: 'City', required: true },
                { name: 'postal_code', label: 'Postal Code' },
                { name: 'notes', label: 'Notes' },
                { name: 'delivery_restrictions', label: 'Delivery Restrictions' }
            ],
            rounds: [
                { name: 'date', label: 'Date', required: true },
                { name: 'day', label: 'Day' },
                { name: 'planned_round_time', label: 'Planned Round Time' },
                { name: 'addresses', label: 'Addresses' },
                { name: 'platenumber', label: 'Plate Number' },
                { name: 'driver_id', label: 'Driver ID or Name' },
                { name: 'address_counts', label: 'Address Counts' },
                { name: 'overall_weight', label: 'Overall Weight' },
                { name: 'round_start', label: 'Round Start Time' },
                { name: 'round_end', label: 'Round End Time' },
                { name: 'packtime', label: 'Pack Time' },
                { name: 'worktime_start', label: 'Work Start Time' },
                { name: 'worktime_end', label: 'Work End Time' },
                { name: 'saved_time', label: 'Saved Time' },
                { name: 'delta_drive_time', label: 'Delta Drive Time' }
            ],
            vehicle_assignments: [
                { name: 'vehicle_id', label: 'Vehicle ID or Plate Number', required: true },
                { name: 'driver_id', label: 'Driver ID or Name', required: true },
                { name: 'start_date', label: 'Start Date', required: true },
                { name: 'end_date', label: 'End Date' },
                { name: 'assignment_type', label: 'Assignment Type', required: true },
                { name: 'approved_by', label: 'Approved By' }
            ],
            time_records: [
                { name: 'driver_id', label: 'Driver ID or Name', required: true },
                { name: 'date', label: 'Date', required: true },
                { name: 'check_in_time', label: 'Check-In Time' },
                { name: 'check_out_time', label: 'Check-Out Time' },
                { name: 'total_hours', label: 'Total Hours' },
                { name: 'overtime_hours', label: 'Overtime Hours' },
                { name: 'notes', label: 'Notes' }
            ],
            stop_events_alert: [
                { name: 'platenumber', label: 'Plate Number', required: true },
                { name: 'arrival_time', label: 'Arrival Time', required: true },
                { name: 'standing_duration', label: 'Standing Duration' },
                { name: 'ignition_status', label: 'Ignition Status' },
                { name: 'position', label: 'Position' },
                { name: 'important_point', label: 'Important Point' }
            ]
        };
        
        return fields[tableType] || [];
    }
    
    /**
     * Render mapping field rows
     */
    renderMappingFields() {
        // Clear mapping fields container
        this.mappingFields.innerHTML = '';
        
        if (!this.dbFields.length || !this.excelData || !this.excelData.headers) {
            this.mappingFields.innerHTML = '<p>No fields to map</p>';
            return;
        }
        
        // Create header
        const header = document.createElement('div');
        header.className = 'mapping-header';
        header.innerHTML = `
            <h3>Map Excel columns to database fields</h3>
            <p>Select the Excel column that matches each database field</p>
        `;
        this.mappingFields.appendChild(header);
        
        // Create a row for each database field
        this.dbFields.forEach(field => {
            const row = document.createElement('div');
            row.className = 'mapping-row';
            
            // Database field label
            const dbField = document.createElement('div');
            dbField.className = 'db-field';
            dbField.innerHTML = `
                ${field.label || field.name} 
                ${field.required ? '<span class="required">*</span>' : ''}
            `;
            
            // Excel field selector
            const excelField = document.createElement('div');
            excelField.className = 'excel-field';
            
            const select = document.createElement('select');
            select.className = 'mapping-selector';
            select.dataset.field = field.name;
            select.addEventListener('change', () => this.handleMappingChange(field.name, select.value));
            
            // Add empty option
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.innerText = '-- Select Excel column --';
            select.appendChild(emptyOption);
            
            // Add Excel header options
            this.excelData.headers.forEach(header => {
                if (!header) return;
                
                const option = document.createElement('option');
                option.value = header;
                option.innerText = header;
                select.appendChild(option);
                
                // Auto-select if header matches field name or label (case insensitive)
                const fieldName = field.name.toLowerCase();
                const fieldLabel = (field.label || '').toLowerCase();
                const headerText = header.toLowerCase();
                
                if (
                    headerText === fieldName || 
                    headerText === fieldLabel ||
                    headerText.replace(/\s+/g, '') === fieldName.replace(/\s+/g, '') ||
                    headerText.replace(/\s+/g, '') === fieldLabel.replace(/\s+/g, '')
                ) {
                    option.selected = true;
                    this.mapping[field.name] = header;
                }
            });
            
            // Add error message element
            const errorMsg = document.createElement('div');
            errorMsg.className = 'mapping-error';
            errorMsg.id = `error-${field.name}`;
            
            excelField.appendChild(select);
            excelField.appendChild(errorMsg);
            
            row.appendChild(dbField);
            row.appendChild(excelField);
            
            this.mappingFields.appendChild(row);
        });
    }
    
    /**
     * Handle mapping field change
     * @param {string} fieldName - Database field name
     * @param {string} value - Excel column name
     */
    handleMappingChange(fieldName, value) {
        if (value) {
            this.mapping[fieldName] = value;
            this.clearFieldError(fieldName);
        } else {
            delete this.mapping[fieldName];
        }
    }
    
    /**
     * Validate the mapping
     * @returns {boolean} True if valid
     */
    validateMapping() {
        this.validationErrors = {};
        let isValid = true;
        
        // Check required fields
        this.dbFields.forEach(field => {
            if (field.required && !this.mapping[field.name]) {
                this.validationErrors[field.name] = `${field.label || field.name} is required`;
                this.showFieldError(field.name, this.validationErrors[field.name]);
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    /**
     * Show error for a field
     * @param {string} fieldName - Field name
     * @param {string} message - Error message
     */
    showFieldError(fieldName, message) {
        const errorElement = document.getElementById(`error-${fieldName}`);
        if (errorElement) {
            errorElement.innerText = message;
            errorElement.style.display = 'block';
        }
    }
    
    /**
     * Clear error for a field
     * @param {string} fieldName - Field name
     */
    clearFieldError(fieldName) {
        const errorElement = document.getElementById(`error-${fieldName}`);
        if (errorElement) {
            errorElement.innerText = '';
            errorElement.style.display = 'none';
        }
    }
    
    /**
     * Handle save button click
     */
    async handleSave() {
        if (!this.validateMapping()) {
            this.statusMessage.innerText = 'Please correct the errors above';
            this.statusMessage.className = 'status-message error';
            return;
        }
        
        try {
            if (typeof this.options.onSave === 'function') {
                await this.options.onSave({
                    type: this.mappingType,
                    mapping: this.mapping,
                    excelData: this.excelData
                });
            }
            
            this.statusMessage.innerText = 'Mapping saved successfully';
            this.statusMessage.className = 'status-message success';
        } catch (error) {
            console.error('Error saving mapping:', error);
            this.statusMessage.innerText = `Error: ${error.message}`;
            this.statusMessage.className = 'status-message error';
        }
    }
    
    /**
     * Handle cancel button click
     */
    handleCancel() {
        if (typeof this.options.onCancel === 'function') {
            this.options.onCancel();
        }
    }
    
    /**
     * Reset the mapping UI
     */
    reset() {
        this.excelData = null;
        this.mappingType = null;
        this.dbFields = [];
        this.mapping = {};
        this.validationErrors = {};
        
        this.typeSelect.value = '';
        this.typeSelect.disabled = true;
        this.mappingFields.innerHTML = '';
        this.saveButton.disabled = true;
        this.statusMessage.innerText = '';
        this.statusMessage.className = 'status-message';
    }

    // Add these methods to the MappingUI class

    // Set schema fields for mapping
    setSchemaFields(schemaFields) {
        console.log('MappingUI.setSchemaFields called with', schemaFields ? schemaFields.length : 0, 'fields');
        this.schemaFields = schemaFields || [];
        
        // If both schema fields and Excel data are available, render the UI
        if (this.excelData && this.schemaFields && this.schemaFields.length > 0) {
            console.log('Both Excel data and schema fields are available - rendering mapping UI');
            this.renderMappingUI();
        } else {
            console.log('Missing Excel data or schema fields:', 
                this.excelData ? 'Excel data: available' : 'Excel data: missing', 
                this.schemaFields && this.schemaFields.length > 0 ? 'Schema fields: available' : 'Schema fields: missing');
        }
    }

    // Render the mapping UI with schema fields
    renderMappingUI() {
        if (!this.excelData || !this.schemaFields) {
            return;
        }
        
        const sheet = this.excelData.sheets[this.currentSheetIndex];
        const headers = this.getSheetHeaders(sheet);
        
        const mappingHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Map Fields</div>
                </div>
                <div class="card-body">
                    <div class="mapping-sheet-info">
                        <p>Mapping fields from sheet: <strong>${sheet.name}</strong></p>
                    </div>
                    
                    <div class="mapping-container">
                        ${this.schemaFields.map((field, index) => `
                            <div class="mapping-row">
                                <div class="db-field">${field.label} ${field.required ? '*' : ''}</div>
                                <div class="excel-field">
                                    <select id="mapping-${field.name}" class="mapping-selector" data-field="${field.name}">
                                        <option value="">-- Select Excel Column --</option>
                                        ${headers.map((header, idx) => `
                                            <option value="${idx}">${header}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="mapping-actions">
                        <button id="save-mapping-btn">Save Mapping</button>
                        <button id="cancel-mapping-btn" class="secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = mappingHTML;
        this.attachMappingEventListeners();
    }

    // Get headers from the Excel sheet
    getSheetHeaders(sheet) {
        if (!sheet || !sheet.data || sheet.data.length === 0) {
            return [];
        }
        
        // Assume first row contains headers
        const headerRow = sheet.data[0];
        return headerRow.map(header => header || '');
    }

    // Attach event listeners for the mapping UI
    attachMappingEventListeners() {
        const saveBtn = document.getElementById('save-mapping-btn');
        const cancelBtn = document.getElementById('cancel-mapping-btn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const mappings = {};
                let isValid = true;
                
                // Get all mapping selections
                this.schemaFields.forEach(field => {
                    const selector = document.getElementById(`mapping-${field.name}`);
                    if (selector && selector.value) {
                        mappings[field.name] = parseInt(selector.value);
                    } else if (field.required) {
                        isValid = false;
                        selector.classList.add('error');
                        
                        // Show error message
                        const errorMsg = document.getElementById(`error-${field.name}`);
                        if (!errorMsg) {
                            const errorDiv = document.createElement('div');
                            errorDiv.id = `error-${field.name}`;
                            errorDiv.className = 'mapping-error';
                            errorDiv.textContent = 'This field is required';
                            selector.parentNode.appendChild(errorDiv);
                        }
                    }
                });
                
                if (!isValid) {
                    return;
                }
                
                // If valid, process the mappings
                const sheet = this.excelData.sheets[this.currentSheetIndex];
                
                this.options.onSave({
                    excelData: sheet.data.slice(1), // Skip header row
                    mappings: mappings
                });
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.options.onCancel();
            });
        }
    }

    // Set Excel data for mapping
    setExcelData(excelData) {
        console.log('MappingUI.setExcelData called with', excelData ? 'data' : 'null');
        if (!excelData || !excelData.sheets || excelData.sheets.length === 0) {
            console.error('Invalid Excel data provided to MappingUI');
            return;
        }
        
        this.excelData = excelData;
        this.currentSheetIndex = 0;
        console.log('Excel data set with', excelData.sheets.length, 'sheets');
        
        // If both schema fields and Excel data are available, render the UI
        if (this.excelData && this.schemaFields && this.schemaFields.length > 0) {
            console.log('Both Excel data and schema fields are available - rendering mapping UI');
            this.renderMappingUI();
        } else {
            console.log('Missing Excel data or schema fields:', 
                this.excelData ? 'Excel data: available' : 'Excel data: missing', 
                this.schemaFields && this.schemaFields.length > 0 ? 'Schema fields: available' : 'Schema fields: missing');
        }
    }
}

// Export module for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MappingUI;
} 

// Make it global for browser
if (typeof window !== 'undefined') {
    window.MappingUI = MappingUI;
    console.log('MappingUI exposed to window object');
} 
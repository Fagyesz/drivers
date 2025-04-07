const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const moment = require('moment');
const fs = require('fs');

/**
 * Excel Parser class for handling complex Excel files with merged cells
 */
class ExcelParser {
    /**
     * Parse an Excel file with special handling for merged cells
     * @param {string} filePath - Path to the Excel file
     * @param {Object} options - Parsing options
     * @returns {Object} Parsed data from the Excel file
     */
    async parseExcelFile(filePath, options = {}) {
        try {
            // Default options
            const defaultOptions = {
                headerRowDetection: true,
                dateFormat: 'YYYY-MM-DD',
                timeFormat: 'HH:mm:ss',
                emptyValue: null,
                sheetName: null
            };
            
            const mergedOptions = { ...defaultOptions, ...options };
            
            // Use ExcelJS for better merged cell handling
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            
            // Process each sheet or just the selected one
            const results = {};
            
            for (const worksheet of workbook.worksheets) {
                // Skip if we're only processing a specific sheet
                if (mergedOptions.sheetName && worksheet.name !== mergedOptions.sheetName) {
                    continue;
                }
                
                const sheetData = await this.processWorksheet(worksheet, mergedOptions);
                results[worksheet.name] = sheetData;
            }
            
            return results;
        } catch (error) {
            console.error('Error parsing Excel file:', error);
            throw new Error(`Failed to parse Excel file: ${error.message}`);
        }
    }
    
    /**
     * Process a worksheet, handling merged cells
     * @param {Worksheet} worksheet - ExcelJS worksheet
     * @param {Object} options - Processing options
     * @returns {Array} Processed data as array of objects
     */
    async processWorksheet(worksheet, options) {
        // First, resolve all merged cells
        const resolvedData = this.resolveMergedCells(worksheet);
        
        // Detect header row if enabled
        let headerRowIndex = 0;
        if (options.headerRowDetection) {
            headerRowIndex = this.detectHeaderRow(resolvedData);
        }
        
        // Extract headers
        const headers = resolvedData[headerRowIndex] || [];
        
        // Convert data to array of objects
        const result = [];
        for (let i = headerRowIndex + 1; i < resolvedData.length; i++) {
            const row = resolvedData[i];
            if (this.isEmptyRow(row)) continue;
            
            const rowData = {};
            headers.forEach((header, index) => {
                if (header) { // Only process cells with headers
                    let value = row[index];
                    
                    // Type conversion
                    if (value instanceof Date) {
                        value = moment(value).format(options.dateFormat);
                    } else if (typeof value === 'undefined' || value === '') {
                        value = options.emptyValue;
                    }
                    
                    // Use the header as the key for each value
                    rowData[header.trim()] = value;
                }
            });
            
            // Only add non-empty objects
            if (Object.keys(rowData).length > 0) {
                result.push(rowData);
            }
        }
        
        return result;
    }
    
    /**
     * Resolve merged cells in a worksheet into a 2D array
     * @param {Worksheet} worksheet - ExcelJS worksheet
     * @returns {Array} 2D array with resolved merged cells
     */
    resolveMergedCells(worksheet) {
        // Create a 2D array to store the worksheet data
        const data = [];
        
        // First, fill in all regular values
        worksheet.eachRow((row, rowNumber) => {
            if (!data[rowNumber - 1]) {
                data[rowNumber - 1] = [];
            }
            
            row.eachCell((cell, colNumber) => {
                data[rowNumber - 1][colNumber - 1] = cell.value;
            });
        });
        
        // Handle merged cells
        if (worksheet.mergeCells && worksheet.mergeCells.length > 0) {
            worksheet.mergeCells.forEach(mergeCell => {
                const { top, left, bottom, right } = mergeCell;
                const mergedValue = data[top - 1][left - 1];
                
                // Fill all cells in the merged range with the same value
                for (let row = top; row <= bottom; row++) {
                    if (!data[row - 1]) {
                        data[row - 1] = [];
                    }
                    
                    for (let col = left; col <= right; col++) {
                        data[row - 1][col - 1] = mergedValue;
                    }
                }
            });
        }
        
        return data;
    }
    
    /**
     * Detect the header row in the data
     * @param {Array} data - 2D array of data
     * @returns {number} Index of the detected header row
     */
    detectHeaderRow(data) {
        // Try to find the row with the most non-empty cells as the header
        let maxNonEmptyCells = 0;
        let headerRowIndex = 0;
        
        data.forEach((row, index) => {
            if (!row) return;
            
            const nonEmptyCells = row.filter(cell => {
                return cell !== null && cell !== undefined && cell !== '';
            }).length;
            
            if (nonEmptyCells > maxNonEmptyCells) {
                maxNonEmptyCells = nonEmptyCells;
                headerRowIndex = index;
            }
        });
        
        return headerRowIndex;
    }
    
    /**
     * Check if a row is empty
     * @param {Array} row - Row data
     * @returns {boolean} True if the row is empty
     */
    isEmptyRow(row) {
        if (!row) return true;
        
        return row.every(cell => {
            return cell === null || cell === undefined || cell === '';
        });
    }
    
    /**
     * Parse a specific sheet in the Excel file
     * @param {string} filePath - Path to the Excel file
     * @param {string} sheetName - Name of the sheet to parse
     * @param {Object} options - Parsing options
     * @returns {Array} Parsed data from the specified sheet
     */
    async parseSheet(filePath, sheetName, options = {}) {
        const allData = await this.parseExcelFile(filePath, {
            ...options,
            sheetName
        });
        
        return allData[sheetName] || [];
    }
    
    /**
     * Get all sheet names in an Excel file
     * @param {string} filePath - Path to the Excel file
     * @returns {Array} Array of sheet names
     */
    async getSheetNames(filePath) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            
            return workbook.worksheets.map(sheet => sheet.name);
        } catch (error) {
            console.error('Error getting sheet names:', error);
            throw new Error(`Failed to get sheet names: ${error.message}`);
        }
    }

    /**
     * Parse SysWeb Excel format specifically
     * @param {string} filePath - Path to the Excel file
     * @returns {Array} Array of records in the correct format for sys_web_temp table
     */
    async parseSysWebExcel(filePath) {
        try {
            console.log('Starting SysWeb Excel parsing from:', filePath);
            
            // Verify file exists
            if (!fs.existsSync(filePath)) {
                console.error(`File does not exist: ${filePath}`);
                throw new Error(`File not found: ${filePath}`);
            }
            
            const workbook = new ExcelJS.Workbook();
            console.log('Reading Excel file...');
            await workbook.xlsx.readFile(filePath);
            console.log('Excel file loaded successfully');
            
            // Assume we're working with the first worksheet
            const worksheet = workbook.worksheets[0];
            console.log(`Working with worksheet: ${worksheet.name}`);
            
            // First resolve all merged cells into a 2D array
            console.log('Resolving merged cells...');
            const resolvedData = this.resolveMergedCells(worksheet);
            console.log(`Resolved data has ${resolvedData.length} rows`);
            
            // Find all person sections in the file
            console.log('Searching for person sections...');
            const sectionIndices = [];
            
            // Detailed logging for the first few rows to help with debugging
            for (let i = 0; i < Math.min(20, resolvedData.length); i++) {
                console.log(`Debug Row ${i}:`, JSON.stringify(resolvedData[i]));
            }
            
            // Look for "Jelentési ív" which signals the start of a person section
            for (let i = 0; i < resolvedData.length; i++) {
                const row = resolvedData[i];
                if (!row) continue;
                
                for (let j = 0; j < row.length; j++) {
                    const cell = row[j];
                    if (cell && String(cell).trim().includes('Jelentési ív')) {
                        sectionIndices.push({ startIndex: i, nameRow: i + 1 });
                        console.log(`Found person section start at row ${i}`);
                        break;
                    }
                }
            }
            
            // If no sections found, try a more flexible search
            if (sectionIndices.length === 0) {
                console.log("No sections found with 'Jelentési ív'. Trying more flexible search...");
                for (let i = 0; i < resolvedData.length; i++) {
                    const row = resolvedData[i];
                    if (!row) continue;
                    
                    // Look for "Név:" which is a common field in these sheets
                    for (let j = 0; j < row.length; j++) {
                        const cell = row[j];
                        if (cell && String(cell).trim() === 'Név:') {
                            sectionIndices.push({ startIndex: i-2, nameRow: i });
                            console.log(`Found person section with "Név:" at row ${i}`);
                            break;
                        }
                    }
                }
            }
            
            // For each section start, find the corresponding end (Összesen row)
            for (let i = 0; i < sectionIndices.length; i++) {
                const sectionStart = sectionIndices[i];
                let endIndex = resolvedData.length - 1; // Default to end of data
                
                // Look for "Összesen" row after the current section start
                for (let j = sectionStart.startIndex + 1; j < resolvedData.length; j++) {
                    const row = resolvedData[j];
                    if (!row) continue;
                    
                    // Check if any cell in the row contains "Összesen"
                    for (let k = 0; k < row.length; k++) {
                        const cell = row[k];
                        if (cell && String(cell).trim() === 'Összesen') {
                            endIndex = j;
                            console.log(`Found section end (Összesen) at row ${j}`);
                            break;
                        }
                    }
                    
                    if (endIndex !== resolvedData.length - 1) {
                        break; // Found the end, stop searching
                    }
                    
                    // If we hit the next section start, use the row before as end
                    if (i < sectionIndices.length - 1 && j === sectionIndices[i + 1].startIndex - 1) {
                        endIndex = j;
                        break;
                    }
                }
                
                sectionIndices[i].endIndex = endIndex;
            }
            
            console.log(`Found ${sectionIndices.length} person sections`);
            
            // Process each person section
            const allRecords = [];
            
            for (let sectionIdx = 0; sectionIdx < sectionIndices.length; sectionIdx++) {
                const section = sectionIndices[sectionIdx];
                console.log(`Processing person section ${sectionIdx + 1} (rows ${section.startIndex}-${section.endIndex})`);
                
                // Extract data for this section
                const sectionData = resolvedData.slice(section.startIndex, section.endIndex + 1);
                
                // Extract employee info
                const employeeInfo = {
                    name: '',
                    jobtitle: '',
                    costcenter: ''
                };
                
                // Look for employee info in this section
                for (let i = 0; i < Math.min(15, sectionData.length); i++) {
                    const row = sectionData[i];
                    if (!row) continue;
                    
                    for (let j = 0; j < row.length; j++) {
                        const cell = row[j];
                        if (!cell) continue;
                        
                        const cellValue = String(cell).trim();
                        
                        // Name detection (handling different formats)
                        if (cellValue === 'Név:' && j + 1 < row.length) {
                            employeeInfo.name = row[j + 1] || '';
                            console.log(`Found name: ${employeeInfo.name}`);
                        } 
                        // Check if the name is in the next cell without a label
                        else if (j > 0 && row[j-1] && String(row[j-1]).trim() === 'Név:') {
                            employeeInfo.name = cellValue;
                            console.log(`Found name: ${employeeInfo.name}`);
                        }
                        
                        // Job title detection (handling different formats)
                        if ((cellValue === 'Munkarend:' || cellValue === 'Egység:') && j + 1 < row.length) {
                            employeeInfo.jobtitle = row[j + 1] || '';
                            console.log(`Found job title: ${employeeInfo.jobtitle}`);
                        } 
                        // Check if job title is in the next cell
                        else if (j > 0 && row[j-1] && (String(row[j-1]).trim() === 'Munkarend:' || String(row[j-1]).trim() === 'Egység:')) {
                            employeeInfo.jobtitle = cellValue;
                            console.log(`Found job title: ${employeeInfo.jobtitle}`);
                        }
                        
                        // Cost center detection (handling different formats)
                        if ((cellValue === 'Költséghely:' || cellValue === 'Állomány:') && j + 1 < row.length) {
                            employeeInfo.costcenter = row[j + 1] || '';
                            console.log(`Found cost center: ${employeeInfo.costcenter}`);
                        }
                        // Check if cost center is in the next cell
                        else if (j > 0 && row[j-1] && (String(row[j-1]).trim() === 'Költséghely:' || String(row[j-1]).trim() === 'Állomány:')) {
                            employeeInfo.costcenter = cellValue;
                            console.log(`Found cost center: ${employeeInfo.costcenter}`);
                        }
                    }
                }
                
                console.log(`Employee info for section ${sectionIdx + 1}:`, employeeInfo);
                
                // Find the data headers row with "Dátum", "Terv", "Tény", etc.
                let headerRow = -1;
                let dateCol = -1;
                let planedCol = -1;
                let actualCol = -1;
                let checkInCol = -1;
                let checkOutCol = -1;
                let workedTimeCol = -1;
                
                for (let i = 0; i < sectionData.length; i++) {
                    const row = sectionData[i];
                    if (!row) continue;
                    
                    let foundDatumHeader = false;
                    for (let j = 0; j < row.length; j++) {
                        const cell = row[j];
                        if (!cell) continue;
                        
                        const cellValue = String(cell).trim().toLowerCase();
                        
                        if (cellValue === 'dátum') {
                            headerRow = i;
                            dateCol = j;
                            foundDatumHeader = true;
                            console.log(`Found 'dátum' at section row ${i}, col ${j}`);
                        } else if (cellValue === 'terv') {
                            planedCol = j;
                            console.log(`Found 'terv' at section row ${i}, col ${j}`);
                        } else if (cellValue === 'tény') {
                            actualCol = j;
                            console.log(`Found 'tény' at section row ${i}, col ${j}`);
                        } else if (cellValue === 'ledolg.' || cellValue.includes('ledolg')) {
                            workedTimeCol = j;
                            console.log(`Found 'ledolg' at section row ${i}, col ${j}`);
                        }
                    }
                    
                    // If we found the header row, look for BE/KI in the next rows
                    if (foundDatumHeader && i + 1 < sectionData.length) {
                        // Look in the next 2 rows for BE/KI headers
                        for (let nextRow = 1; nextRow <= 2; nextRow++) {
                            if (i + nextRow >= sectionData.length) continue;
                            
                            const subHeaderRow = sectionData[i + nextRow];
                            if (!subHeaderRow) continue;
                            
                            for (let j = 0; j < subHeaderRow.length; j++) {
                                const cell = subHeaderRow[j];
                                if (!cell) continue;
                                
                                const cellValue = String(cell).trim().toLowerCase();
                                if (cellValue === 'be') {
                                    checkInCol = j;
                                    console.log(`Found 'be' at section row ${i+nextRow}, col ${j}`);
                                } else if (cellValue === 'ki') {
                                    checkOutCol = j;
                                    console.log(`Found 'ki' at section row ${i+nextRow}, col ${j}`);
                                }
                            }
                        }
                        
                        // If we found BE/KI, don't continue searching in more rows
                        if (checkInCol >= 0 || checkOutCol >= 0) {
                            break;
                        }
                    }
                }
                
                if (headerRow < 0 || dateCol < 0) {
                    console.warn(`Could not find date column in section ${sectionIdx + 1}, skipping`);
                    continue;
                }
                
                // Process rows of data for this person
                const sectionRecords = [];
                
                // Start from headerRow + (checkInCol >= 0 ? 3 : 1) to skip header and potential BE/KI row
                let dataStartRow = headerRow + (checkInCol >= 0 ? 3 : 1);
                console.log(`Starting to process data from section row ${dataStartRow}`);
                
                // Process until we hit the end of the section or "Összesen" row
                while (dataStartRow < sectionData.length) {
                    const row = sectionData[dataStartRow];
                    if (!row) break; // Stop at empty row
                    
                    // Check if this is the 'Összesen' row
                    let isTotal = false;
                    for (let j = 0; j < row.length; j++) {
                        const cell = row[j];
                        if (cell && String(cell).trim() === 'Összesen') {
                            isTotal = true;
                            break;
                        }
                    }
                    
                    // Skip the total row
                    if (isTotal) {
                        console.log(`Found 'Összesen' row at ${dataStartRow}, stopping data collection`);
                        break;
                    }
                    
                    // Check if we have a date in the date column
                    const dateCell = row[dateCol];
                    if (!dateCell) {
                        console.log(`No date found at row ${dataStartRow}, skipping`);
                        dataStartRow++;
                        continue;
                    }
                    
                    // Create the record with the data from this row
                    const record = {
                        name: employeeInfo.name,
                        jobtitle: employeeInfo.jobtitle,
                        costcenter: employeeInfo.costcenter,
                        date: dateCell,
                        planedshift: planedCol >= 0 ? (row[planedCol] || '') : '',
                        actual: actualCol >= 0 ? (row[actualCol] || '') : '',
                        check_in: checkInCol >= 0 ? (row[checkInCol] || '') : '',
                        check_out: checkOutCol >= 0 ? (row[checkOutCol] || '') : '',
                        workedTime: workedTimeCol >= 0 ? (row[workedTimeCol] || '') : ''
                    };
                    
                    // Format date if it's a Date object
                    if (record.date instanceof Date) {
                        record.date = moment(record.date).format('YYYY-MM-DD');
                    } else if (typeof record.date === 'string' && record.date.includes('.')) {
                        // Handle date format like "2023.03.01" -> "2023-03-01"
                        record.date = record.date.replace(/\./g, '-');
                    }
                    
                    // Log each record as we're processing
                    console.log(`Processing row ${dataStartRow}:`, record);
                    
                    sectionRecords.push(record);
                    dataStartRow++;
                }
                
                console.log(`Found ${sectionRecords.length} records in section ${sectionIdx + 1}`);
                allRecords.push(...sectionRecords);
            }
            
            console.log(`Total records found across all sections: ${allRecords.length}`);
            return allRecords;
        } catch (error) {
            console.error('Error parsing SysWeb Excel:', error);
            throw new Error(`Failed to parse SysWeb Excel: ${error.message}`);
        }
    }
}

module.exports = new ExcelParser(); 
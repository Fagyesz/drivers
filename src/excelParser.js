const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const moment = require('moment');
const fs = require('fs');
const logger = require('./logger');

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
            logger.error('Error parsing Excel file', { error: error.message });
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
            logger.error('Error getting sheet names', { error: error.message });
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
            logger.info('Starting SysWeb Excel parsing from:', filePath);
            
            // Verify file exists
            if (!fs.existsSync(filePath)) {
                logger.error(`File does not exist: ${filePath}`);
                throw new Error(`File not found: ${filePath}`);
            }
            
            const workbook = new ExcelJS.Workbook();
            logger.info('Reading Excel file...');
            await workbook.xlsx.readFile(filePath);
            logger.info('Excel file loaded successfully');
            
            // Assume we're working with the first worksheet
            const worksheet = workbook.worksheets[0];
            logger.info(`Working with worksheet: ${worksheet.name}`);
            
            // First resolve all merged cells into a 2D array
            logger.info('Resolving merged cells...');
            const resolvedData = this.resolveMergedCells(worksheet);
            logger.info(`Resolved data has ${resolvedData.length} rows`);
            
            // Detailed logging for the first few rows to help with debugging
            for (let i = 0; i < Math.min(3, resolvedData.length); i++) {
                logger.debug(`Debug Row ${i}:`, JSON.stringify(resolvedData[i]));
            }
            
            // Find all person sections in the file
            logger.info('Searching for person sections...');
            const sectionIndices = [];
            
            // Look for "Jelentési ív" which signals the start of a person section
            for (let i = 0; i < resolvedData.length; i++) {
                const row = resolvedData[i];
                if (!row) continue;
                
                for (let j = 0; j < row.length; j++) {
                    const cell = row[j];
                    if (cell && String(cell).trim().includes('Jelentési ív')) {
                        sectionIndices.push({ startIndex: i, nameRow: i + 1 });
                        logger.info(`Found person section start at row ${i}`);
                        break;
                    }
                }
            }
            
            // If no sections found, try a more flexible search
            if (sectionIndices.length === 0) {
                logger.info("No sections found with 'Jelentési ív'. Trying more flexible search...");
                for (let i = 0; i < resolvedData.length; i++) {
                    const row = resolvedData[i];
                    if (!row) continue;
                    
                    // Look for "Név:" which is a common field in these sheets
                    for (let j = 0; j < row.length; j++) {
                        const cell = row[j];
                        if (cell && String(cell).trim() === 'Név:') {
                            sectionIndices.push({ startIndex: i-2, nameRow: i });
                            logger.info(`Found person section with "Név:" at row ${i}`);
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
                            logger.info(`Found section end (Összesen) at row ${j}`);
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
            
            logger.info(`Found ${sectionIndices.length} person sections`);
            
            // Process each person section
            const allRecords = [];
            
            for (let sectionIdx = 0; sectionIdx < sectionIndices.length; sectionIdx++) {
                const section = sectionIndices[sectionIdx];
                logger.info(`Processing person section ${sectionIdx + 1} (rows ${section.startIndex}-${section.endIndex})`);
                
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
                            logger.info(`Found name: ${employeeInfo.name}`);
                        } 
                        // Check if the name is in the next cell without a label
                        else if (j > 0 && row[j-1] && String(row[j-1]).trim() === 'Név:') {
                            employeeInfo.name = cellValue;
                            logger.info(`Found name: ${employeeInfo.name}`);
                        }
                        
                        // Job title detection (handling different formats)
                        if ((cellValue === 'Munkarend:' || cellValue === 'Egység:') && j + 1 < row.length) {
                            employeeInfo.jobtitle = row[j + 1] || '';
                            logger.info(`Found job title: ${employeeInfo.jobtitle}`);
                        } 
                        // Check if job title is in the next cell
                        else if (j > 0 && row[j-1] && (String(row[j-1]).trim() === 'Munkarend:' || String(row[j-1]).trim() === 'Egység:')) {
                            employeeInfo.jobtitle = cellValue;
                            logger.info(`Found job title: ${employeeInfo.jobtitle}`);
                        }
                        
                        // Cost center detection (handling different formats)
                        if ((cellValue === 'Költséghely:' || cellValue === 'Állomány:') && j + 1 < row.length) {
                            employeeInfo.costcenter = row[j + 1] || '';
                            logger.info(`Found cost center: ${employeeInfo.costcenter}`);
                        }
                        // Check if cost center is in the next cell
                        else if (j > 0 && row[j-1] && (String(row[j-1]).trim() === 'Költséghely:' || String(row[j-1]).trim() === 'Állomány:')) {
                            employeeInfo.costcenter = cellValue;
                            logger.info(`Found cost center: ${employeeInfo.costcenter}`);
                        }
                    }
                }
                
                logger.info(`Employee info for section ${sectionIdx + 1}:`, employeeInfo);
                
                // Find the data headers row with "Dátum", "Terv", "Tény", etc.
                let headerRow = -1;
                let dateCol = -1;
                let plannedShiftCol = -1;
                let actualShiftCol = -1;
                let checkInCol = -1;
                let checkOutCol = -1;
                let workedTimeCol = -1;
                let mozgasokCol = -1;
                
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
                            logger.info(`Found 'dátum' at section row ${i}, col ${j}`);
                        } else if (cellValue === 'terv') {
                            plannedShiftCol = j;
                            logger.info(`Found 'terv' at section row ${i}, col ${j}`);
                        } else if (cellValue === 'tény') {
                            actualShiftCol = j;
                            logger.info(`Found 'tény' at section row ${i}, col ${j}`);
                        } else if (cellValue === 'ledolg.' || cellValue.includes('ledolg')) {
                            workedTimeCol = j;
                            logger.info(`Found 'ledolg' at section row ${i}, col ${j}`);
                        } else if (cellValue === 'mozgások' || cellValue.includes('mozgás')) {
                            mozgasokCol = j;
                            logger.info(`Found 'mozgások' at section row ${i}, col ${j}`);
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
                                    logger.info(`Found 'be' at section row ${i+nextRow}, col ${j}`);
                                } else if (cellValue === 'ki') {
                                    checkOutCol = j;
                                    logger.info(`Found 'ki' at section row ${i+nextRow}, col ${j}`);
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
                    logger.warn(`Could not find date column in section ${sectionIdx + 1}, skipping`);
                    continue;
                }
                
                // If we found Mozgások header but not specific BE/KI columns, 
                // assume standard column positions (S-V for BE, W-Z for KI)
                if (mozgasokCol >= 0 && (checkInCol < 0 || checkOutCol < 0)) {
                    logger.log('Using fixed columns for BE/KI based on Mozgások header');
                    
                    // Find the base column index (this would be column S or index 18 in 0-based)
                    // We'll try to find the actual index by looking at the column position of the Mozgások header
                    const baseColIndex = mozgasokCol;
                    
                    // Columns S-V (indices 18-21) for first set, BE
                    checkInCol = baseColIndex;
                    
                    // Columns W-Z (indices 22-25) for second set, KI
                    checkOutCol = baseColIndex + 4;
                    
                    logger.info(`Setting BE column to ${checkInCol} (S-V) and KI column to ${checkOutCol} (W-Z)`);
                    
                    // Worked time is typically in a dedicated column, but if not found, set a default
                    if (workedTimeCol < 0) {
                        // Set to a column after checkOut columns
                        workedTimeCol = checkOutCol + 4; 
                        logger.info(`Setting worked time column to ${workedTimeCol}`);
                    }
                }
                
                // Process rows of data for this person
                const sectionRecords = [];
                
                // Previously we were skipping too many rows after the header
                // let dataStartRow = headerRow + (checkInCol >= 0 ? 3 : 1);
                // Adjusted logic to ensure we don't miss the first days of the month
                let dataStartRow = headerRow + 1;

                // Add debugging to log where we're starting to read data
                logger.info(`[ExcelParser] Starting to read data from row ${dataStartRow}`);

                // Scan for the row containing the first date
                for (let i = dataStartRow; i < sectionData.length; i++) {
                    const row = sectionData[i];
                    if (row && row[dateCol] && typeof row[dateCol] === 'string') {
                        // Check if this row contains a date format (like 2024.07.01 or just 07.01)
                        if (/^\d{4}\.\d{2}\.\d{2}$|^\d{2}\.\d{2}$/.test(row[dateCol])) {
                            dataStartRow = i;
                            logger.info(`[ExcelParser] Found first date row at ${dataStartRow}: ${row[dateCol]}`);
                            break;
                        }
                    }
                }
                
                // Now create the records
                const records = [];
                
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
                    
                    // Skip the total row and any rows after it (signature lines, etc.)
                    if (isTotal) {
                        logger.info(`Found 'Összesen' row at ${dataStartRow}, stopping data collection`);
                        break;
                    }

                    // Also check for signature or other non-data rows (typically have "Munkahelyi vezető" or "Munkavállaló")
                    const rowText = row.join(' ').toLowerCase();
                    if (rowText.includes('munkahelyi vezető') || 
                        rowText.includes('munkavállaló') || 
                        rowText.includes('aláírás')) {
                        logger.info(`Skipping signature row at ${dataStartRow}`);
                        dataStartRow++;
                        continue;
                    }
                    
                    // Check if we have a date in the date column
                    const dateCell = row[dateCol];
                    if (!dateCell) {
                        logger.info(`No date found at row ${dataStartRow}, skipping`);
                        dataStartRow++;
                        continue;
                    }
                    
                    // Ensure early month days (like 03.01, 03.02) are properly processed
                    logger.info(`Processing date cell: "${dateCell}" at row ${dataStartRow}`);
                    
                    // Make sure we handle Hungarian date formats (potentially with periods)
                    let formattedDate = dateCell;
                    if (typeof dateCell === 'string') {
                        // Handle potential period-separated dates (03.01 -> 2025-03-01)
                        if (dateCell.includes('.')) {
                            const parts = dateCell.split('.');
                            if (parts.length >= 2) {
                                // Ensure we have year, month, day
                                let year = parts[0].trim();
                                const month = parts[1].trim().padStart(2, '0');
                                let day = parts.length > 2 ? parts[2].trim().padStart(2, '0') : '01';
                                
                                // If year is just 2 digits (like "25"), prepend "20"
                                if (year.length === 2) {
                                    year = `20${year}`;
                                }
                                
                                formattedDate = `${year}-${month}-${day}`;
                                logger.info(`Reformatted date from "${dateCell}" to "${formattedDate}"`);
                            }
                        }
                    }
                    
                    // Extract check-in and check-out times from their respective column ranges
                    let checkInTime = '';
                    let checkOutTime = '';
                    let workedTime = '';
                    
                    // First, get the worked time from its dedicated column
                    if (workedTimeCol >= 0 && row[workedTimeCol]) {
                        workedTime = String(row[workedTimeCol]).trim();
                    }
                    
                    // Clear debug log for this row
                    logger.info(`Row ${dataStartRow} raw data:`, 
                        checkInCol >= 0 && checkInCol < row.length ? `BE columns (${checkInCol}-${checkInCol+3}): ${row.slice(checkInCol, checkInCol+4)}` : 'BE cols not found',
                        checkOutCol >= 0 && checkOutCol < row.length ? `KI columns (${checkOutCol}-${checkOutCol+3}): ${row.slice(checkOutCol, checkOutCol+4)}` : 'KI cols not found',
                        workedTimeCol >= 0 && workedTimeCol < row.length ? `Worked time col (${workedTimeCol}): ${row[workedTimeCol]}` : 'Worked time col not found'
                    );
                    
                    // First, scan for values ending with BE/KI across all relevant columns
                    // Check both the expected BE and KI column ranges for proper values
                    let beFound = false;
                    let kiFound = false;
                    
                    // Function to check if value ends with BE or KI
                    const endsWith = (val, suffix) => {
                        if (!val) return false;
                        return String(val).trim().toLowerCase().endsWith(suffix.toLowerCase());
                    };
                    
                    // Check all potential columns for BE/KI values
                    for (let j = 0; j < row.length; j++) {
                        if (!row[j]) continue;
                        
                        const cellValue = String(row[j]).trim();
                        
                        // Assign to check-in if it ends with BE
                        if (endsWith(cellValue, 'BE') && !beFound) {
                            checkInTime = cellValue;
                            beFound = true;
                            logger.info(`Found check-in time with BE at col ${j}: ${checkInTime}`);
                        }
                        
                        // Assign to check-out if it ends with KI
                        if (endsWith(cellValue, 'KI') && !kiFound) {
                            checkOutTime = cellValue;
                            kiFound = true;
                            logger.info(`Found check-out time with KI at col ${j}: ${checkOutTime}`);
                        }
                    }
                    
                    // If we didn't find values with BE/KI postfixes, fall back to column positions
                    if (!beFound && checkInCol >= 0) {
                        // Try to find the first non-empty cell in the check-in columns
                        for (let j = 0; j < 4; j++) {
                            const colIndex = checkInCol + j;
                            if (colIndex < row.length && row[colIndex]) {
                                checkInTime = row[colIndex];
                                logger.info(`Fallback: Found check-in time at col ${colIndex}: ${checkInTime}`);
                                break;
                            }
                        }
                    }
                    
                    if (!kiFound && checkOutCol >= 0) {
                        // Try to find the first non-empty cell in the check-out columns
                        for (let j = 0; j < 4; j++) {
                            const colIndex = checkOutCol + j;
                            if (colIndex < row.length && row[colIndex]) {
                                checkOutTime = row[colIndex];
                                logger.info(`Fallback: Found check-out time at col ${colIndex}: ${checkOutTime}`);
                                break;
                            }
                        }
                    }
                    
                    // Debug log for what we found
                    logger.info(`Before cleanup - check-in: ${checkInTime}, check-out: ${checkOutTime}`);
                    
                    // Clean up the check-in and check-out times (remove BE/KI postfixes)
                    if (checkInTime) {
                        // Remove any "BE" postfix from check-in time
                        checkInTime = String(checkInTime).trim().replace(/\s*BE\s*$/i, '');
                    }
                    
                    if (checkOutTime) {
                        // Remove any "KI" postfix from check-out time
                        checkOutTime = String(checkOutTime).trim().replace(/\s*KI\s*$/i, '');
                    }
                    
                    logger.info(`After cleanup - check-in: ${checkInTime}, check-out: ${checkOutTime}`);
                    
                    // Create the record with the data from this row
                    const record = {
                        name: employeeInfo.name,
                        jobtitle: employeeInfo.jobtitle,
                        costcenter: employeeInfo.costcenter,
                        date: formattedDate,
                        planedshift: plannedShiftCol >= 0 ? (row[plannedShiftCol] || '') : '',
                        actual: actualShiftCol >= 0 ? (row[actualShiftCol] || '') : '',
                        check_in: checkInTime || '',
                        check_out: checkOutTime || '',
                        workedTime: workedTime || ''
                    };
                    
                    // Format date if it's a Date object
                    if (record.date instanceof Date) {
                        record.date = moment(record.date).format('YYYY-MM-DD');
                    } else if (typeof record.date === 'string' && record.date.includes('.')) {
                        // Handle date format like "2023.03.01" -> "2023-03-01"
                        record.date = record.date.replace(/\./g, '-');
                    }
                    
                    // Skip the "Összesen" (total) line from being added to the table
                    if (record.date && String(record.date).includes('Összesen')) {
                        logger.info(`Skipping "Összesen" row with date: ${record.date}`);
                        dataStartRow++;
                        continue;
                    }
                    
                    // Log each record as we're processing
                    logger.info(`Processing row ${dataStartRow}:`, record);
                    
                    sectionRecords.push(record);
                    dataStartRow++;
                }
                
                logger.info(`Found ${sectionRecords.length} records in section ${sectionIdx + 1}`);
                allRecords.push(...sectionRecords);
            }
            
            logger.info(`Total records found across all sections: ${allRecords.length}`);
            return allRecords;
        } catch (error) {
            logger.error('Error parsing SysWeb Excel', { error: error.message });
            throw new Error(`Failed to parse SysWeb Excel: ${error.message}`);
        }
    }

    /**
     * Parse alerts Excel format specifically
     * @param {string} filePath - Path to the Excel file
     * @returns {Array} Array of records in the correct format for stop_events_alert table
     */
    async parseAlertExcel(filePath) {
        try {
            logger.info('Starting Alert Excel parsing from:', filePath);
            
            // Verify file exists
            if (!fs.existsSync(filePath)) {
                logger.error(`File does not exist: ${filePath}`);
                throw new Error(`File not found: ${filePath}`);
            }
            
            let resolvedData = [];
            
            try {
                // First try with ExcelJS
                const workbook = new ExcelJS.Workbook();
                logger.info('Reading Excel file with ExcelJS...');
                await workbook.xlsx.readFile(filePath);
                logger.info('Excel file loaded successfully with ExcelJS');
                
                // Assume we're working with the first worksheet
                const worksheet = workbook.worksheets[0];
                logger.info(`Working with worksheet: ${worksheet.name}`);
                
                // Resolve all merged cells into a 2D array
                logger.info('Resolving merged cells...');
                resolvedData = this.resolveMergedCells(worksheet);
            } catch (error) {
                // If ExcelJS fails, try with XLSX library as fallback
                logger.log('ExcelJS failed, trying with XLSX library:', error.message);
                
                const XLSX = require('xlsx');
                logger.log('Reading Excel file with XLSX...');
                const workbook = XLSX.readFile(filePath);
                logger.log('Excel file loaded successfully with XLSX');
                
                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                logger.log(`Working with worksheet: ${firstSheetName}`);
                
                // Convert to array of arrays
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Use the JSON data as our resolved data
                resolvedData = jsonData;
            }
            
            logger.info(`Resolved data has ${resolvedData.length} rows`);
            
            // Detailed logging for the first few rows to help with debugging
            for (let i = 0; i < Math.min(3, resolvedData.length); i++) {
                logger.debug(`Debug Row ${i}:`, JSON.stringify(resolvedData[i]));
            }
            
            // Find the header row that contains the column titles
            let headerRow = -1;
            let plateNumberCol = -1;
            let arrivalTimeCol = -1;
            let statusCol = -1;
            let positionCol = -1;
            let importantPointCol = -1;
            
            // Look for header row with "rendszám", "érkezés időpont", etc.
            for (let i = 0; i < resolvedData.length; i++) {
                const row = resolvedData[i];
                if (!row) continue;
                
                let foundHeaders = false;
                for (let j = 0; j < row.length; j++) {
                    const cell = row[j];
                    if (!cell) continue;
                    
                    const cellValue = String(cell).trim().toLowerCase();
                    
                    if (cellValue === 'rendszám') {
                        headerRow = i;
                        plateNumberCol = j;
                        foundHeaders = true;
                        logger.info(`Found 'rendszám' at row ${i}, col ${j}`);
                    } else if (cellValue.includes('érkezés') || cellValue.includes('idopont') || cellValue.includes('időpont')) {
                        arrivalTimeCol = j;
                        logger.info(`Found 'érkezés időpont' at row ${i}, col ${j}`);
                    } else if (cellValue === 'állás' || cellValue === 'allas') {
                        statusCol = j;
                        logger.info(`Found 'állás' at row ${i}, col ${j}`);
                    } else if (cellValue.includes('pozíció') || cellValue.includes('pozicio')) {
                        positionCol = j;
                        logger.info(`Found 'pozíció' at row ${i}, col ${j}`);
                    } else if (cellValue.includes('fontos') || cellValue.includes('pont')) {
                        importantPointCol = j;
                        logger.info(`Found 'fontos pont' at row ${i}, col ${j}`);
                    }
                }
                
                if (foundHeaders) {
                    break; // We found the header row, no need to continue
                }
            }
            
            if (headerRow === -1 || plateNumberCol === -1 || arrivalTimeCol === -1) {
                logger.warn('Could not find required columns in the Excel file. Ensure the file contains at least "rendszám" and "érkezés időpont" columns.');
                return [];
            }
            
            // Process data rows
            const allRecords = [];
            const dataStartRow = headerRow + 1;
            
            for (let i = dataStartRow; i < resolvedData.length; i++) {
                const row = resolvedData[i];
                if (!row || !row[plateNumberCol] || !row[arrivalTimeCol]) {
                    // Skip rows without plate number or arrival time
                    continue;
                }
                
                const plateNumber = row[plateNumberCol] ? String(row[plateNumberCol]).trim() : '';
                const arrivalTime = row[arrivalTimeCol] ? String(row[arrivalTimeCol]).trim() : '';
                
                // status is actually a duration in minutes
                let status = '';
                if (statusCol >= 0 && row[statusCol]) {
                    status = String(row[statusCol]).trim();
                    
                    // If it's a numeric value (either plain number or Excel decimal time)
                    if (!isNaN(status)) {
                        let minutes = 0;
                        
                        // Check if it's an Excel decimal time (fraction of a day)
                        if (parseFloat(status) < 1) {
                            // Convert Excel time (fraction of day) to minutes
                            minutes = Math.round(parseFloat(status) * 24 * 60);
                            logger.info(`Converted Excel time ${status} to ${minutes} minutes`);
                        } else {
                            // Just a regular number of minutes
                            minutes = parseInt(status, 10);
                        }
                        
                        // Format as MM:SS if it's a valid number
                        if (!isNaN(minutes)) {
                            const hours = Math.floor(minutes / 60);
                            const mins = minutes % 60;
                            status = hours > 0 ? 
                                `${hours}:${mins.toString().padStart(2, '0')}` : 
                                `0:${mins.toString().padStart(2, '0')}`;
                            
                            logger.info(`Formatted standing duration: ${status} (${minutes} minutes)`);
                        }
                    }
                }
                
                const position = positionCol >= 0 && row[positionCol] ? String(row[positionCol]).trim() : '';
                
                // Determine if this is marked as an important point
                let importantPoint = '';
                if (importantPointCol >= 0 && row[importantPointCol]) {
                    importantPoint = String(row[importantPointCol]).trim();
                    logger.info(`Setting important_point to string value: "${importantPoint}"`);
                    
                    // Clean up the string - remove extra quotes if present
                    if (importantPoint.startsWith('"') && importantPoint.endsWith('"')) {
                        importantPoint = importantPoint.substring(1, importantPoint.length - 1);
                        logger.info(`Cleaned important_point value: "${importantPoint}"`);
                    }
                }
                
                // Format arrival time appropriately
                let formattedArrivalTime = arrivalTime;
                if (formattedArrivalTime) {
                    // If it's a numeric Excel date, convert it to a proper date string
                    if (!isNaN(formattedArrivalTime)) {
                        // Excel dates are number of days since 1/1/1900
                        // Convert Excel serial date to JavaScript date
                        const excelEpoch = new Date(1900, 0, 1);
                        let jsDate = new Date(excelEpoch);
                        jsDate.setDate(excelEpoch.getDate() + parseInt(formattedArrivalTime) - 2); // -2 adjustment for Excel date system
                        
                        // Get fractional part for time
                        const fraction = formattedArrivalTime - Math.floor(formattedArrivalTime);
                        const millisInDay = 24 * 60 * 60 * 1000;
                        jsDate = new Date(jsDate.getTime() + fraction * millisInDay);
                        
                        // Format as YYYY-MM-DD HH:MM:SS
                        const year = jsDate.getFullYear();
                        const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                        const day = String(jsDate.getDate()).padStart(2, '0');
                        const hours = String(jsDate.getHours()).padStart(2, '0');
                        const minutes = String(jsDate.getMinutes()).padStart(2, '0');
                        const seconds = String(jsDate.getSeconds()).padStart(2, '0');
                        
                        formattedArrivalTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                        logger.info(`Converted Excel date ${arrivalTime} to ${formattedArrivalTime}`);
                    }
                    // If it's in DD.MM.YYYY HH:MM:SS format, convert it
                    else if (formattedArrivalTime.includes('.')) {
                        const parts = formattedArrivalTime.split(' ');
                        if (parts.length > 0) {
                            const datePart = parts[0].split('.');
                            if (datePart.length >= 3) {
                                const day = datePart[0].trim().padStart(2, '0');
                                const month = datePart[1].trim().padStart(2, '0');
                                const year = datePart[2].trim();
                                const timePart = parts.length > 1 ? parts[1] : '00:00:00';
                                formattedArrivalTime = `${year}-${month}-${day} ${timePart}`;
                            }
                        }
                    }
                }
                
                // Create record
                const record = {
                    plate_number: plateNumber,
                    arrival_time: formattedArrivalTime,
                    status: status,
                    position: position,
                    important_point: importantPoint  // Use the actual string from the Excel
                };
                
                // Skip records with empty or invalid plate numbers
                if (!plateNumber || 
                    plateNumber.toLowerCase().includes('rendszám') || 
                    plateNumber.toLowerCase().includes('terület') || 
                    plateNumber.toLowerCase().includes('telephely') ||
                    plateNumber.toLowerCase() === 'irány' ||
                    plateNumber.toLowerCase() === 'időpont' ||
                    !this.isValidPlateNumber(plateNumber)) {
                    logger.warn(`Skipping record with invalid plate number: "${plateNumber}"`);
                    continue;
                }
                
                logger.info(`Parsed record at row ${i}:`, record);
                allRecords.push(record);
            }
            
            logger.info(`Total alert records found: ${allRecords.length}`);
            return allRecords;
        } catch (error) {
            logger.error('Error parsing Alert Excel', { error: error.message });
            throw new Error(`Failed to parse Alert Excel: ${error.message}`);
        }
    }
    
    /**
     * Validate a license plate number
     * @param {string} plate - License plate to validate
     * @returns {boolean} True if valid
     */
    isValidPlateNumber(plate) {
        if (!plate) return false;
        
        // Skip known header/label values
        const invalidTerms = ['rendszám', 'terület', 'telephely', 'időpont', 'irány', 
                             'töltött', 'megtett', 'állás', 'allas', 'pont', 'position'];
                             
        for (const term of invalidTerms) {
            if (plate.toLowerCase().includes(term)) {
                return false;
            }
        }
        
        // Must contain hyphen, be between 5-10 chars, and not be all numbers
        return plate.includes('-') && 
               plate.length >= 5 && 
               plate.length <= 10 && 
               /[A-Za-z]/.test(plate);
    }

    /**
     * Parse iFleet Excel file
     * @param {string} filePath - Path to the Excel file
     * @returns {Array} Array of parsed records
     */
    async parseIFleetExcel(filePath) {
        try {
            logger.info('Parsing iFleet Excel file', { filePath });
            
            // Use the XLSX library for simpler parsing
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
            logger.info(`iFleet data has ${jsonData.length} rows`);
            
            // Headers we expect to find
            const expectedHeaders = ['rendszám', 'időpont', 'terület neve', 'irány', 'területen töltött idő', 'területen megtett táv'];
            const headerMap = {
                'rendszám': 'platenumber',
                'időpont': 'timestamp',
                'terület neve': 'area_name',
                'irány': 'direction',
                'területen töltött idő': 'time_spent',
                'területen megtett táv': 'distance'
            };
            
            // Look for the header row - based on our inspection, it's likely around row 13
            let headerRow = -1;
            const startRow = Math.max(0, 10); // Start looking from row 10
            const endRow = Math.min(jsonData.length, 20); // Look up to row 20
            
            for (let i = startRow; i < endRow; i++) {
                const row = jsonData[i];
                if (!row) continue;
                
                // Convert row values to lowercase for comparison
                const lowerRow = row.map(cell => {
                    if (cell === null) return null;
                    return String(cell).toLowerCase().trim();
                });
                
                // Check how many headers match
                let matchCount = 0;
                expectedHeaders.forEach(header => {
                    if (lowerRow.some(cell => cell === header.toLowerCase())) {
                        matchCount++;
                    }
                });
                
                if (matchCount >= 3) { // At least 3 headers match
                    headerRow = i;
                    logger.info(`Found header row at index ${headerRow}`);
                    break;
                }
            }
            
            if (headerRow === -1) {
                throw new Error('Could not find header row in the Excel file');
            }
            
            // Get the headers from the identified row
            const headerCells = jsonData[headerRow];
            
            // Map column indices to our field names
            const columnIndices = {};
            headerCells.forEach((cell, index) => {
                if (cell) {
                    const lowerCell = String(cell).toLowerCase().trim();
                    for (const [excelHeader, fieldName] of Object.entries(headerMap)) {
                        if (lowerCell === excelHeader.toLowerCase()) {
                            columnIndices[fieldName] = index;
                            break;
                        }
                    }
                }
            });
            
            logger.info('Column mapping: ', columnIndices);
            
            // Check if we found all required columns
            const requiredColumns = ['platenumber', 'timestamp'];
            const missingColumns = requiredColumns.filter(col => columnIndices[col] === undefined);
            
            if (missingColumns.length > 0) {
                throw new Error(`Required columns missing: ${missingColumns.join(', ')}`);
            }
            
            // Data starts after the header row
            const dataStartRow = headerRow + 1;
            
            // Parse data rows
            const records = [];
            for (let i = dataStartRow; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row) continue;
                
                // Skip empty rows or rows with no plate number
                if (!row[columnIndices.platenumber]) continue;
                
                const record = {};
                
                // Extract data using the mapped column indices
                for (const [fieldName, colIndex] of Object.entries(columnIndices)) {
                    const cellValue = row[colIndex];
                    
                    // Skip if no value
                    if (cellValue === null || cellValue === undefined) {
                        record[fieldName] = null;
                        continue;
                    }
                    
                    // Process specific fields
                    switch (fieldName) {
                        case 'platenumber':
                            record.platenumber = String(cellValue).trim();
                            break;
                            
                        case 'timestamp':
                            // Handle Excel date number
                            let timestamp = cellValue;
                            if (typeof cellValue === 'number') {
                                // Excel date number - convert to JS date
                                const excelDate = XLSX.SSF.parse_date_code(cellValue);
                                const jsDate = new Date(
                                    excelDate.y, 
                                    excelDate.m - 1, 
                                    excelDate.d, 
                                    excelDate.H, 
                                    excelDate.M, 
                                    excelDate.S
                                );
                                timestamp = jsDate.toISOString();
                            } else if (cellValue instanceof Date) {
                                timestamp = cellValue.toISOString();
                            } else {
                                // String date - keep as is
                                timestamp = String(cellValue).trim();
                            }
                            record.timestamp = timestamp;
                            break;
                            
                        case 'area_name':
                            record.area_name = cellValue ? String(cellValue).trim() : null;
                            break;
                            
                        case 'direction':
                            record.direction = cellValue ? String(cellValue).trim() : null;
                            break;
                            
                        case 'time_spent':
                            // Convert time to minutes or keep as is
                            if (typeof cellValue === 'number') {
                                // Could be minutes or Excel time
                                if (cellValue < 1) {
                                    // Excel time (fraction of day)
                                    record.time_spent = Math.round(cellValue * 24 * 60);
                                } else {
                                    record.time_spent = Math.round(cellValue);
                                }
                            } else if (typeof cellValue === 'string') {
                                // Try to parse time format like "HH:MM"
                                const timeParts = cellValue.trim().split(':');
                                if (timeParts.length === 2) {
                                    const hours = parseInt(timeParts[0], 10);
                                    const minutes = parseInt(timeParts[1], 10);
                                    if (!isNaN(hours) && !isNaN(minutes)) {
                                        record.time_spent = hours * 60 + minutes;
                                    } else {
                                        record.time_spent = null;
                                    }
                                } else {
                                    record.time_spent = null;
                                }
                            } else {
                                record.time_spent = null;
                            }
                            break;
                            
                        case 'distance':
                            // Parse distance as number
                            if (typeof cellValue === 'number') {
                                record.distance = cellValue;
                            } else if (typeof cellValue === 'string') {
                                // Try to parse string as number
                                const parsedValue = parseFloat(cellValue.trim().replace(',', '.'));
                                record.distance = isNaN(parsedValue) ? null : parsedValue;
                            } else {
                                record.distance = null;
                            }
                            break;
                            
                        default:
                            // For other fields, just store as is
                            record[fieldName] = cellValue;
                    }
                }
                
                // Only add if we have required fields
                if (record.platenumber && record.timestamp) {
                    records.push(record);
                }
            }
            
            logger.info(`Parsed ${records.length} iFleet records`);
            return records;
        } catch (error) {
            logger.error('Error parsing iFleet Excel', { error: error.message });
            throw new Error(`Failed to parse iFleet Excel: ${error.message}`);
        }
    }

    /**
     * Parse Routes Excel format (Járatok)
     * @param {string} filePath - Path to the Excel file
     * @returns {Array} Array of records in the correct format for the routes table
     */
    async parseRoutesExcel(filePath) {
        try {
            logger.info('Starting Routes Excel parsing from:', filePath);
            
            // Verify file exists
            if (!fs.existsSync(filePath)) {
                logger.error(`File does not exist: ${filePath}`);
                throw new Error(`File not found: ${filePath}`);
            }
            
            // Load the workbook
            const workbook = XLSX.readFile(filePath);
            
            // Find the 'Járatok' sheet or use the first sheet
            const sheetName = workbook.SheetNames.find(name => name === 'Járatok') || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Convert sheet to JSON
            const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            // Identify the header row
            const headerRow = rawData[0];
            
            // Define column mappings
            const columnMappings = {
                'Járatkód': 'route_code',
                'Járműkód': 'vehicle_code',
                'Dátum': 'date',
                'Sofőr': 'driver',
                'Tömeg kapacitás': 'weight_capacity',
                'Telephely': 'depot',
                'Elindítás dátuma': 'start_date',
                'Szállítás rekordok száma': 'delivery_records_count',
                'Fuvarkör kód': 'transport_code',
                'Menetszám': 'journey_number'
            };
            
            // Get the current date as ISO string for import_date
            const importDate = new Date().toISOString();
            
            // Map the columns
            const data = [];
            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;
                
                const record = {};
                
                // Map each column using the header names
                headerRow.forEach((header, index) => {
                    if (header && columnMappings[header]) {
                        const fieldName = columnMappings[header];
                        record[fieldName] = row[index];
                    }
                });
                
                // Convert date values (Excel date format) to ISO string
                if (record.date) {
                    record.date = this.excelDateToString(record.date);
                }
                
                if (record.start_date) {
                    record.start_date = this.excelDateToString(record.start_date);
                }
                
                // Add import_date
                record.import_date = importDate;
                
                // Add the record if it has at least the route code and vehicle code
                if (record.route_code && record.vehicle_code) {
                    data.push(record);
                }
            }
            
            logger.info(`Parsed ${data.length} route records`);
            return data;
        } catch (error) {
            logger.error('Error parsing Routes Excel:', { error: error.message });
            throw new Error(`Failed to parse Routes Excel: ${error.message}`);
        }
    }

    /**
     * Convert Excel date number to ISO string
     * @param {number} excelDate - Excel date number
     * @returns {string} ISO date string
     */
    excelDateToString(excelDate) {
        // Excel dates are days since 1899-12-30
        // JavaScript dates are milliseconds since 1970-01-01
        if (typeof excelDate !== 'number') {
            return excelDate;
        }
        
        const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
    }
}

module.exports = new ExcelParser(); 
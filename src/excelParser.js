const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const moment = require('moment');

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
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            
            // Assume we're working with the first worksheet
            const worksheet = workbook.worksheets[0];
            
            // First resolve all merged cells into a 2D array
            const resolvedData = this.resolveMergedCells(worksheet);
            
            // Find key rows and columns based on headers
            let nameRow = -1;
            let dateRow = -1;
            let dateCol = -1;
            let planedCol = -1;
            let actualCol = -1;
            let checkInCol = -1;
            let checkOutCol = -1;
            let workedTimeCol = -1;
            
            // Look for key headers
            for (let i = 0; i < resolvedData.length; i++) {
                const row = resolvedData[i];
                if (!row) continue;
                
                for (let j = 0; j < row.length; j++) {
                    const cell = row[j];
                    if (!cell) continue;
                    
                    const cellValue = String(cell).trim().toLowerCase();
                    
                    if (cellValue === 'név:') {
                        nameRow = i;
                    } else if (cellValue === 'dátum') {
                        dateRow = i;
                        dateCol = j;
                    } else if (cellValue === 'terv') {
                        planedCol = j;
                    } else if (cellValue === 'tény') {
                        actualCol = j;
                    } else if (cellValue === 'mozgások') {
                        // Look for BE/KI in the next row
                        if (resolvedData[i + 1]) {
                            for (let k = j; k < resolvedData[i + 1].length; k++) {
                                const subHeader = resolvedData[i + 1][k];
                                if (!subHeader) continue;
                                
                                const subHeaderValue = String(subHeader).trim().toLowerCase();
                                if (subHeaderValue === 'be') {
                                    checkInCol = k;
                                } else if (subHeaderValue === 'ki') {
                                    checkOutCol = k;
                                }
                            }
                        }
                    } else if (cellValue === 'ledolg.') {
                        workedTimeCol = j;
                    }
                }
            }
            
            // Extract employee info (name, jobtitle, costcenter)
            const employeeInfo = {
                name: '',
                jobtitle: '',
                costcenter: ''
            };
            
            if (nameRow >= 0) {
                const nameCell = resolvedData[nameRow].findIndex(cell => 
                    cell && String(cell).trim().toLowerCase() === 'név:');
                
                if (nameCell >= 0 && nameCell + 1 < resolvedData[nameRow].length) {
                    employeeInfo.name = resolvedData[nameRow][nameCell + 1] || '';
                }
                
                const jobTitleCell = resolvedData[nameRow + 1]?.findIndex(cell => 
                    cell && String(cell).trim().toLowerCase() === 'egység:');
                
                if (jobTitleCell >= 0 && jobTitleCell + 1 < resolvedData[nameRow + 1].length) {
                    employeeInfo.jobtitle = resolvedData[nameRow + 1][jobTitleCell + 1] || '';
                }
                
                // Look for costcenter (költséghely)
                const costCenterRow = nameRow + 1;
                if (costCenterRow < resolvedData.length) {
                    const costCenterCell = resolvedData[costCenterRow].findIndex(cell => 
                        cell && String(cell).trim().toLowerCase() === 'költséghely:');
                    
                    if (costCenterCell >= 0 && costCenterCell + 1 < resolvedData[costCenterRow].length) {
                        employeeInfo.costcenter = resolvedData[costCenterRow][costCenterCell + 1] || '';
                    }
                }
            }
            
            // Process data rows
            const result = [];
            
            // Start from date row + 1 (where actual data starts)
            if (dateRow >= 0 && dateCol >= 0) {
                // Find first data row (typically this is dateRow + 2)
                let dataStartRow = dateRow + 2;
                
                // Process until we hit an empty row or end of data
                while (dataStartRow < resolvedData.length && 
                      resolvedData[dataStartRow] && 
                      resolvedData[dataStartRow][dateCol]) {
                    
                    const row = resolvedData[dataStartRow];
                    
                    const record = {
                        name: employeeInfo.name,
                        jobtitle: employeeInfo.jobtitle,
                        costcenter: employeeInfo.costcenter,
                        date: row[dateCol] || '',
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
                    
                    result.push(record);
                    dataStartRow++;
                }
            }
            
            return result;
        } catch (error) {
            console.error('Error parsing SysWeb Excel:', error);
            throw new Error(`Failed to parse SysWeb Excel: ${error.message}`);
        }
    }
}

module.exports = new ExcelParser(); 
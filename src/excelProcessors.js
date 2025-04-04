// Excel Processors for handling different Excel file formats
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class ExcelProcessors {
    /**
     * Process ifleet.xlsx format (Vehicle movements)
     * Format: platenumber, date, area name, way(in/out), time spent, distance
     */
    static async processIFleetMovements(filePath) {
        try {
            console.log(`Processing iFleet movements file: ${filePath}`);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            
            const worksheet = workbook.getWorksheet(1); // Assuming data is in the first sheet
            const data = [];
            
            // Skip header row
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber <= 1) return; // Skip header
                
                try {
                    const rowData = {
                        platenumber: row.getCell(1).text.trim(),
                        date: this.formatDate(row.getCell(2).value),
                        area_name: row.getCell(3).text.trim(),
                        way: row.getCell(4).text.trim(),
                        time_spent: parseInt(row.getCell(5).value) || 0,
                        distance: parseFloat(row.getCell(6).value) || 0
                    };
                    
                    // Validate required fields
                    if (rowData.platenumber && rowData.date) {
                        data.push(rowData);
                    } else {
                        console.warn(`Skipping row ${rowNumber}: Missing required fields`);
                    }
                } catch (err) {
                    console.error(`Error processing row ${rowNumber}:`, err);
                }
            });
            
            console.log(`Processed ${data.length} vehicle movement records`);
            return data;
        } catch (error) {
            console.error('Error processing iFleet file:', error);
            throw error;
        }
    }
    
    /**
     * Process ifleet-allas-lista.xls format (Stop events)
     * Format: platenumber, arrival time, stay time, ignition, location, important info
     */
    static async processIFleetStopEvents(filePath) {
        try {
            console.log(`Processing iFleet stop events file: ${filePath}`);
            
            // Use XLSX for older .xls format
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const headers = rawData[0];
            const data = [];
            
            // Process each row (skip header)
            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row[0]) continue; // Skip empty rows
                
                try {
                    const rowData = {
                        platenumber: row[0]?.toString().trim(),
                        arrival_time: this.formatDateTime(row[1]),
                        stay_time: parseInt(row[2]) || 0,
                        ignition: row[3]?.toString() || '',
                        location: row[4]?.toString() || '',
                        important_info: row[5] ? true : false
                    };
                    
                    // Validate required fields
                    if (rowData.platenumber && rowData.arrival_time) {
                        data.push(rowData);
                    } else {
                        console.warn(`Skipping row ${i+1}: Missing required fields`);
                    }
                } catch (err) {
                    console.error(`Error processing row ${i+1}:`, err);
                }
            }
            
            console.log(`Processed ${data.length} stop event records`);
            return data;
        } catch (error) {
            console.error('Error processing iFleet stop events file:', error);
            throw error;
        }
    }
    
    /**
     * Process sysweb.xlsx format (Personnel time records with merged cells)
     * Format: person name, job title, cost center, date, planned shift, actual shift, check-in, check-out
     */
    static async processSyswebTimeRecords(filePath) {
        try {
            console.log(`Processing Sysweb time records file: ${filePath}`);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            
            const worksheet = workbook.getWorksheet(1);
            const data = [];
            
            // Track current values for merged cells
            let currentPerson = null;
            let currentJobTitle = null;
            let currentCostCenter = null;
            
            // Process each row
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber <= 1) return; // Skip header
                
                try {
                    // Check for merged cells - use existing value if cell is empty
                    const nameCell = row.getCell(1);
                    if (nameCell.text && nameCell.text.trim()) {
                        currentPerson = nameCell.text.trim();
                    }
                    
                    const jobTitleCell = row.getCell(2);
                    if (jobTitleCell.text && jobTitleCell.text.trim()) {
                        currentJobTitle = jobTitleCell.text.trim();
                    }
                    
                    const costCenterCell = row.getCell(3);
                    if (costCenterCell.text && costCenterCell.text.trim()) {
                        currentCostCenter = costCenterCell.text.trim();
                    }
                    
                    // Process date and shifts
                    const dateCell = row.getCell(4);
                    const plannedShiftCell = row.getCell(5);
                    const actualShiftCell = row.getCell(6);
                    const checkInCell = row.getCell(7);
                    const checkOutCell = row.getCell(8);
                    
                    // Only process rows with a date
                    if (dateCell.value) {
                        const rowData = {
                            person_name: currentPerson,
                            job_title: currentJobTitle,
                            cost_center: currentCostCenter,
                            date: this.formatDate(dateCell.value),
                            planned_shift: plannedShiftCell.text || '',
                            actual_shift: actualShiftCell.text || '',
                            check_in: checkInCell.text || '',
                            check_out: checkOutCell.text || ''
                        };
                        
                        // Validate required fields
                        if (rowData.person_name && rowData.date) {
                            data.push(rowData);
                        } else {
                            console.warn(`Skipping row ${rowNumber}: Missing required fields`);
                        }
                    }
                } catch (err) {
                    console.error(`Error processing row ${rowNumber}:`, err);
                }
            });
            
            console.log(`Processed ${data.length} time record entries`);
            return data;
        } catch (error) {
            console.error('Error processing Sysweb file:', error);
            throw error;
        }
    }
    
    /**
     * Helper function to format dates consistently
     */
    static formatDate(dateValue) {
        if (!dateValue) return null;
        
        try {
            if (dateValue instanceof Date) {
                return dateValue.toISOString().split('T')[0]; // YYYY-MM-DD
            } else if (typeof dateValue === 'string') {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            } else if (typeof dateValue === 'number') {
                // Handle Excel serial date
                const date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            console.error('Error formatting date:', e);
        }
        
        return dateValue.toString();
    }
    
    /**
     * Helper function to format date times consistently
     */
    static formatDateTime(dateTimeValue) {
        if (!dateTimeValue) return null;
        
        try {
            if (dateTimeValue instanceof Date) {
                return dateTimeValue.toISOString();
            } else if (typeof dateTimeValue === 'string') {
                const date = new Date(dateTimeValue);
                if (!isNaN(date.getTime())) {
                    return date.toISOString();
                }
            } else if (typeof dateTimeValue === 'number') {
                // Handle Excel serial date
                const date = new Date(Math.round((dateTimeValue - 25569) * 86400 * 1000));
                return date.toISOString();
            }
        } catch (e) {
            console.error('Error formatting datetime:', e);
        }
        
        return dateTimeValue.toString();
    }
    
    /**
     * Helper function to detect Excel file type based on content
     */
    static async detectExcelType(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            const filename = path.basename(filePath).toLowerCase();
            
            // Try to identify by filename pattern first
            if (filename.includes('allas-lista')) {
                return 'stop-events';
            } else if (filename.includes('sysweb')) {
                return 'time-records';
            } else if (filename.includes('ifleet')) {
                return 'vehicle-movements';
            }
            
            // If filename doesn't help, try to analyze content
            // Use different libraries based on extension
            if (ext === '.xls') {
                const workbook = XLSX.readFile(filePath);
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0];
                
                // Check headers to determine file type
                if (headers.some(h => h && h.toString().includes('ignition'))) {
                    return 'stop-events';
                }
            } else {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.readFile(filePath);
                const worksheet = workbook.getWorksheet(1);
                const headers = [];
                
                // Get first row as headers
                worksheet.getRow(1).eachCell((cell) => {
                    headers.push(cell.text);
                });
                
                // Look for characteristic headers
                if (headers.some(h => h && h.includes('check-in') || h.includes('checking')) || 
                    headers.some(h => h && h.includes('planned shift'))) {
                    return 'time-records';
                } else if (headers.some(h => h && h.includes('area') || h.includes('way'))) {
                    return 'vehicle-movements';
                }
            }
            
            // Default to vehicle movements if can't determine
            return 'unknown';
        } catch (error) {
            console.error('Error detecting Excel type:', error);
            return 'unknown';
        }
    }
}

module.exports = ExcelProcessors; 
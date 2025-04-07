// Excel inspection tool
const ExcelJS = require('exceljs');
const path = require('path');
const XLSX = require('xlsx');

async function inspectExcel(filePath) {
    try {
        console.log(`Inspecting Excel file: ${filePath}`);
        
        // Load the workbook with ExcelJS
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        // Print worksheets
        console.log(`Workbook has ${workbook.worksheets.length} worksheets:`);
        
        // Also try with XLSX library for comparison
        console.log("\nXLSX Library Inspection:");
        const xlsxWorkbook = XLSX.readFile(filePath);
        const sheetName = xlsxWorkbook.SheetNames[0];
        const sheet = xlsxWorkbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        
        // Print the first 10 rows
        console.log("\nFirst 10 rows from XLSX library:");
        jsonData.slice(0, 10).forEach((row, i) => {
            console.log(`Row ${i+1}: ${JSON.stringify(row)}`);
        });
        
        // Look for headers
        let headerRow = null;
        const possibleHeaders = ['rendszám', 'időpont', 'terület neve', 'irány', 'területen töltött idő', 'területen megtett táv'];
        
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
            const row = jsonData[i];
            if (!row) continue;
            
            // Convert row values to lowercase for comparison
            const lowerRow = row.map(cell => {
                if (cell === null) return null;
                return String(cell).toLowerCase().trim();
            });
            
            // Check how many headers match
            let matchCount = 0;
            possibleHeaders.forEach(header => {
                if (lowerRow.some(cell => cell === header.toLowerCase())) {
                    matchCount++;
                }
            });
            
            if (matchCount >= 3) {
                headerRow = i;
                console.log(`\nFound likely header row at index ${headerRow}:`);
                console.log(JSON.stringify(row));
                break;
            }
        }
        
        if (headerRow !== null) {
            // Print some sample data rows
            console.log("\nSample data rows:");
            for (let i = headerRow + 1; i < Math.min(headerRow + 6, jsonData.length); i++) {
                console.log(`Row ${i+1}: ${JSON.stringify(jsonData[i])}`);
            }
        } else {
            console.log("\nCould not identify a clear header row.");
            
            // Try to identify columns with plate numbers or dates
            console.log("\nLooking for columns with plate numbers or dates...");
            
            const platePattern = /^[A-Za-z]{3}-\d{3}$/;  // Common plate format
            
            for (let i = 0; i < 30; i++) {
                for (let j = 0; j < jsonData[i]?.length || 0; j++) {
                    const cell = jsonData[i][j];
                    if (!cell) continue;
                    
                    // Check if it looks like a plate number
                    if (typeof cell === 'string' && (cell.includes('-') || platePattern.test(cell))) {
                        console.log(`Possible plate number at row ${i+1}, column ${j+1}: ${cell}`);
                    }
                    
                    // Check if it might be a date
                    if (cell instanceof Date || 
                        (typeof cell === 'string' && /\d{2,4}[.\/-]\d{1,2}[.\/-]\d{1,2}/.test(cell))) {
                        console.log(`Possible date at row ${i+1}, column ${j+1}: ${cell}`);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Error inspecting Excel file:', error);
    }
}

// File path
const filePath = path.resolve(__dirname, 'excel_examples', 'ifleet.xlsx');

// Run the inspection
inspectExcel(filePath); 
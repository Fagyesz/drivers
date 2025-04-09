const XLSX = require('xlsx');
const fs = require('fs');

// Path to the Excel file
const filePath = 'excel_examples/Járatok_20250409_083330.xlsx';

try {
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  
  // Get sheet names
  console.log('Sheet Names:', workbook.SheetNames);
  
  // Get the first sheet
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Convert sheet to JSON
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Display the headers (first row)
  if (data.length > 0) {
    console.log('Headers:', data[0]);
  }
  
  // Display a few sample rows
  console.log('\nSample Data:');
  for (let i = 1; i < Math.min(5, data.length); i++) {
    console.log(`Row ${i}:`, data[i]);
  }
  
  // Save full data to a JSON file for inspection
  fs.writeFileSync('temp-excel-data.json', JSON.stringify(data, null, 2));
  console.log('\nFull data saved to temp-excel-data.json');
  
} catch (error) {
  console.error('Error processing Excel file:', error);
} 
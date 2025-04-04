// Test renderer script
console.log('Test renderer started');

try {
    const { ipcRenderer } = require('electron');
    console.log('Successfully imported electron modules');
} catch (error) {
    console.error('Error importing electron:', error);
}

try {
    const XLSX = require('xlsx');
    console.log('Successfully imported XLSX');
} catch (error) {
    console.error('Error importing XLSX:', error);
}

try {
    const moment = require('moment');
    console.log('Successfully imported moment');
} catch (error) {
    console.error('Error importing moment:', error);
}

// DOM ready event
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM is fully loaded');
    
    // Check if we can find UI elements
    document.querySelectorAll('.tab-btn').forEach(btn => {
        console.log('Found tab button:', btn.dataset.tab);
    });
    
    // Add a visible element to the page to confirm script execution
    const testDiv = document.createElement('div');
    testDiv.style.padding = '20px';
    testDiv.style.margin = '20px';
    testDiv.style.backgroundColor = 'red';
    testDiv.style.color = 'white';
    testDiv.textContent = 'Test script executed successfully';
    document.body.appendChild(testDiv);
}); 
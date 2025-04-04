const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

document.addEventListener('DOMContentLoaded', () => {
    const logsOutput = document.getElementById('logs-output');
    const refreshLogsBtn = document.getElementById('refresh-logs-btn');
    const backBtn = document.getElementById('back-btn');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    const exportLogsBtn = document.getElementById('export-logs-btn');
    const logLevelFilter = document.getElementById('log-level-filter');
    const logSearch = document.getElementById('log-search');
    
    let currentLogs = '';
    let filteredLogs = '';
    
    // Handle back button click
    backBtn.addEventListener('click', () => {
        window.location.href = 'faq.html';
    });
    
    // Handle refresh button click
    refreshLogsBtn.addEventListener('click', () => {
        loadLogs();
    });
    
    // Handle clear logs button
    clearLogsBtn.addEventListener('click', async () => {
        try {
            const result = await ipcRenderer.invoke('clear-logs');
            if (result.success) {
                logsOutput.textContent = '--- Logs cleared ---';
                currentLogs = '';
                filteredLogs = '';
            } else {
                showError('Failed to clear logs: ' + result.error);
            }
        } catch (error) {
            showError('Error clearing logs: ' + error.message);
        }
    });
    
    // Handle export logs button
    exportLogsBtn.addEventListener('click', async () => {
        try {
            const savePath = await ipcRenderer.invoke('export-logs');
            if (savePath) {
                showMessage(`Logs exported to: ${savePath}`, 'success');
            }
        } catch (error) {
            showError('Error exporting logs: ' + error.message);
        }
    });
    
    // Handle level filter change
    logLevelFilter.addEventListener('change', () => {
        filterLogs();
    });
    
    // Handle search input
    logSearch.addEventListener('input', () => {
        filterLogs();
    });
    
    // Load logs on page load
    loadLogs();
    
    // Function to load logs
    async function loadLogs() {
        try {
            logsOutput.textContent = 'Loading logs...';
            currentLogs = await ipcRenderer.invoke('get-all-logs');
            
            if (!currentLogs || currentLogs.length === 0) {
                logsOutput.textContent = 'No logs found.';
                return;
            }
            
            filterLogs();
        } catch (error) {
            showError('Error loading logs: ' + error.message);
        }
    }
    
    // Function to filter logs
    function filterLogs() {
        const level = logLevelFilter.value;
        const searchText = logSearch.value.toLowerCase();
        
        // Start with all logs
        let logs = currentLogs;
        
        // Filter by level
        if (level !== 'all') {
            const lines = logs.split('\n');
            const filteredLines = lines.filter(line => {
                const lowerLine = line.toLowerCase();
                
                if (level === 'error') {
                    return lowerLine.includes('[error]');
                } else if (level === 'warn') {
                    return lowerLine.includes('[error]') || lowerLine.includes('[warn]');
                } else if (level === 'info') {
                    return lowerLine.includes('[error]') || lowerLine.includes('[warn]') || lowerLine.includes('[info]');
                } else if (level === 'debug') {
                    return lowerLine.includes('[error]') || lowerLine.includes('[warn]') || 
                           lowerLine.includes('[info]') || lowerLine.includes('[debug]');
                }
                
                return true;
            });
            
            logs = filteredLines.join('\n');
        }
        
        // Filter by search text
        if (searchText) {
            const lines = logs.split('\n');
            const filteredLines = lines.filter(line => 
                line.toLowerCase().includes(searchText)
            );
            
            logs = filteredLines.join('\n');
        }
        
        // Update filtered logs and display
        filteredLogs = logs;
        
        // Apply syntax highlighting
        logsOutput.innerHTML = highlightLogSyntax(filteredLogs);
        
        // Display message if no logs match the filters
        if (!filteredLogs.trim()) {
            logsOutput.textContent = 'No logs match the current filters.';
        }
    }
    
    // Function to highlight log syntax
    function highlightLogSyntax(logText) {
        if (!logText) return '';
        
        return logText
            .replace(/\[ERROR\]/gi, '<span class="log-error">[ERROR]</span>')
            .replace(/\[WARN\]/gi, '<span class="log-warn">[WARN]</span>')
            .replace(/\[INFO\]/gi, '<span class="log-info">[INFO]</span>')
            .replace(/\[DEBUG\]/gi, '<span class="log-debug">[DEBUG]</span>')
            .replace(/\[(.*?)\]/g, '<span class="log-timestamp">[$1]</span>')
            .replace(/{.*}/g, match => `<span class="log-json">${match}</span>`);
    }
    
    // Function to show error message
    function showError(message) {
        logsOutput.innerHTML = `<span class="log-error">ERROR: ${message}</span>`;
    }
    
    // Function to show success/info message
    function showMessage(message, type = 'info') {
        const tempContent = logsOutput.innerHTML;
        
        // Show message at the top
        logsOutput.innerHTML = `<div class="log-message ${type}">${message}</div>${tempContent}`;
        
        // Remove message after 3 seconds
        setTimeout(() => {
            const messageElem = logsOutput.querySelector('.log-message');
            if (messageElem) {
                messageElem.remove();
            }
        }, 3000);
    }
}); 
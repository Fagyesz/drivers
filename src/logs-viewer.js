try {
    console.log('Loading logs-viewer.js');
    const electron = require('electron');
    const ipcRenderer = electron.ipcRenderer;
    const fs = require('fs');
    const path = require('path');
    
    console.log('Electron modules loaded successfully in logs viewer');
    
    window.onload = function() {
        console.log('Window loaded in logs viewer');
        try {
            const logsOutput = document.getElementById('logs-output');
            const refreshLogsBtn = document.getElementById('refresh-logs-btn');
            const backBtn = document.getElementById('back-btn');
            const clearLogsBtn = document.getElementById('clear-logs-btn');
            const exportLogsBtn = document.getElementById('export-logs-btn');
            const logLevelFilter = document.getElementById('log-level-filter');
            const logSearch = document.getElementById('log-search');
            
            console.log('UI elements found:',
                'logsOutput:', !!logsOutput,
                'refreshLogsBtn:', !!refreshLogsBtn,
                'backBtn:', !!backBtn,
                'clearLogsBtn:', !!clearLogsBtn,
                'exportLogsBtn:', !!exportLogsBtn
            );
            
            let currentLogs = '';
            let filteredLogs = '';
            
            // Handle back button click - should return to FAQ
            if (backBtn) {
                backBtn.addEventListener('click', function() {
                    console.log('Back button clicked in logs viewer');
                    ipcRenderer.send('close-logs-viewer');
                });
                console.log('Back button event listener attached in logs viewer');
            }
            
            // Handle refresh button click
            if (refreshLogsBtn) {
                refreshLogsBtn.addEventListener('click', function() {
                    console.log('Refresh button clicked');
                    loadLogs();
                });
                console.log('Refresh button event listener attached');
            }
            
            // Handle clear logs button
            if (clearLogsBtn) {
                clearLogsBtn.addEventListener('click', async function() {
                    console.log('Clear logs button clicked');
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
                console.log('Clear logs button event listener attached');
            }
            
            // Handle export logs button
            if (exportLogsBtn) {
                exportLogsBtn.addEventListener('click', async function() {
                    console.log('Export logs button clicked');
                    try {
                        const savePath = await ipcRenderer.invoke('export-logs');
                        if (savePath) {
                            showMessage(`Logs exported to: ${savePath}`, 'success');
                        }
                    } catch (error) {
                        showError('Error exporting logs: ' + error.message);
                    }
                });
                console.log('Export logs button event listener attached');
            }
            
            // Handle level filter change
            if (logLevelFilter) {
                logLevelFilter.addEventListener('change', function() {
                    console.log('Log level filter changed');
                    filterLogs();
                });
                console.log('Level filter event listener attached');
            }
            
            // Handle search input
            if (logSearch) {
                logSearch.addEventListener('input', function() {
                    console.log('Log search input changed');
                    filterLogs();
                });
                console.log('Search input event listener attached');
            }
            
            // Load logs on page load
            loadLogs();
            
            // Function to load logs
            async function loadLogs() {
                console.log('Loading logs...');
                try {
                    if (logsOutput) logsOutput.textContent = 'Loading logs...';
                    currentLogs = await ipcRenderer.invoke('get-all-logs');
                    
                    if (!currentLogs || currentLogs.length === 0) {
                        if (logsOutput) logsOutput.textContent = 'No logs found.';
                        return;
                    }
                    
                    filterLogs();
                } catch (error) {
                    console.error('Error loading logs:', error);
                    showError('Error loading logs: ' + error.message);
                }
            }
            
            // Function to filter logs
            function filterLogs() {
                console.log('Filtering logs...');
                if (!logLevelFilter || !logsOutput) return;
                
                const level = logLevelFilter.value;
                const searchText = logSearch ? logSearch.value.toLowerCase() : '';
                
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
                console.error(message);
                if (logsOutput) {
                    logsOutput.innerHTML = `<span class="log-error">ERROR: ${message}</span>`;
                }
            }
            
            // Function to show success/info message
            function showMessage(message, type = 'info') {
                console.log(message);
                if (!logsOutput) return;
                
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
        } catch (error) {
            console.error('Error initializing logs viewer:', error);
            // Show error in the UI for debugging
            const errorDiv = document.createElement('div');
            errorDiv.style.color = 'red';
            errorDiv.style.padding = '10px';
            errorDiv.style.margin = '10px 0';
            errorDiv.style.border = '1px solid red';
            errorDiv.innerHTML = `<strong>Error initializing logs viewer:</strong> ${error.message}`;
            document.body.prepend(errorDiv);
        }
    };
} catch (error) {
    console.error('Critical error loading logs-viewer.js:', error);
    // We can't do much here since the script is still loading
    window.onload = function() {
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '10px';
        errorDiv.style.margin = '10px 0';
        errorDiv.style.border = '1px solid red';
        errorDiv.innerHTML = `<strong>Critical error:</strong> ${error.message}`;
        document.body.prepend(errorDiv);
    };
} 
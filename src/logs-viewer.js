try {
    console.log('Loading logs-viewer.js');
    
    // Add a global error handler to catch any uncaught errors
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('Global error caught:', message, 'at', source, ':', lineno, ':', colno);
        console.error('Error details:', error);
        
        // Display error in UI
        setTimeout(() => {
            const errorDiv = document.createElement('div');
            errorDiv.style.color = 'red';
            errorDiv.style.padding = '10px';
            errorDiv.style.margin = '10px 0';
            errorDiv.style.border = '1px solid red';
            errorDiv.innerHTML = `<strong>Error:</strong> ${message}<br>Source: ${source}:${lineno}:${colno}`;
            document.body.prepend(errorDiv);
        }, 500);
        
        return true; // Prevents the default error handling
    };
    
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
            const hideDebugRows = document.getElementById('hide-debug-rows');
            
            console.log('UI elements found:',
                'logsOutput:', !!logsOutput,
                'refreshLogsBtn:', !!refreshLogsBtn,
                'backBtn:', !!backBtn,
                'clearLogsBtn:', !!clearLogsBtn,
                'exportLogsBtn:', !!exportLogsBtn,
                'hideDebugRows:', !!hideDebugRows
            );
            
            // Add new button listeners for the updated HTML
            const refreshButton = document.getElementById('refresh-button');
            const backButton = document.getElementById('back-button');
            
            if (refreshButton) {
                refreshButton.addEventListener('click', function() {
                    console.log('New refresh button clicked');
                    loadLogs();
                });
                console.log('New refresh button event listener attached');
            }
            
            if (backButton) {
                backButton.addEventListener('click', function() {
                    console.log('New back button clicked');
                    if (window.electron) {
                        window.electron.goBack();
                    } else {
                        window.history.back();
                    }
                });
                console.log('New back button event listener attached');
            }
            
            let currentLogs = '';
            let filteredLogs = '';
            
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
            
            // Handle hide debug rows checkbox
            if (hideDebugRows) {
                hideDebugRows.addEventListener('change', function() {
                    console.log('Hide debug rows changed:', hideDebugRows.checked);
                    filterLogs();
                });
                console.log('Hide debug rows event listener attached');
            }
            
            // Handle back button click - should return to FAQ
            if (backBtn) {
                backBtn.addEventListener('click', function() {
                    console.log('Back button clicked in logs viewer');
                    if (window.electron) {
                        window.electron.goBack();
                    } else {
                        window.history.back();
                    }
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
            
            // Load logs on page load
            loadLogs();
            
            // Add force reload capability
            window.forceReload = function() {
                console.log('Force reloading page...');
                // Clear cache and reload
                if (electron.webFrame) {
                    electron.webFrame.clearCache();
                }
                location.reload(true);
            };
            
            // Add keyboard shortcut for force reload (Ctrl+R or Cmd+R)
            document.addEventListener('keydown', function(event) {
                if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                    event.preventDefault();
                    window.forceReload();
                }
            });
            
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
                const shouldHideDebugRows = hideDebugRows ? hideDebugRows.checked : false;
                
                console.log('Applying filters:', { level, searchText, shouldHideDebugRows });
                
                // Start with all logs
                let logs = currentLogs;
                
                // First filter out debug rows if enabled - do this first to reduce the amount of data to process
                if (shouldHideDebugRows) {
                    const lines = logs.split('\n');
                    const filteredLines = lines.filter(line => 
                        !line.includes('Debug Row')
                    );
                    
                    logs = filteredLines.join('\n');
                    console.log(`Filtered out ${lines.length - filteredLines.length} debug rows`);
                }
                
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
                    console.log(`Applied level filter "${level}": ${filteredLines.length} lines remaining`);
                }
                
                // Filter by search text
                if (searchText) {
                    const lines = logs.split('\n');
                    const filteredLines = lines.filter(line => 
                        line.toLowerCase().includes(searchText)
                    );
                    
                    logs = filteredLines.join('\n');
                    console.log(`Applied search filter "${searchText}": ${filteredLines.length} lines remaining`);
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
                
                // First, split the log into lines to handle multi-line error logs
                const lines = logText.split('\n');
                
                const highlightedLines = lines.map(line => {
                    let highlightedLine = line
                        // Highlight log levels with different colors
                        .replace(/\[ERROR\]/gi, '<span class="log-error">[ERROR]</span>')
                        .replace(/\[WARN\]/gi, '<span class="log-warn">[WARN]</span>')
                        .replace(/\[INFO\]/gi, '<span class="log-info">[INFO]</span>')
                        .replace(/\[DEBUG\]/gi, '<span class="log-debug">[DEBUG]</span>')
                        // Highlight timestamps
                        .replace(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]/g, match => `<span class="log-timestamp">${match}</span>`)
                        // Highlight other brackets
                        .replace(/\[(.*?)\]/g, '<span class="log-bracket">[$1]</span>');
                    
                    // Highlight error specific lines (improved detection)
                    if (line.toLowerCase().includes('[error]') || 
                        line.includes('ERROR:') || 
                        line.includes('error:') || 
                        line.includes('failed') ||
                        line.includes('exception') ||
                        line.includes('failed') ||
                        line.includes('Invalid')) {
                        return `<span class="log-error-line">${highlightedLine}</span>`;
                    }
                    // Highlight stack trace lines
                    else if (line.includes('STACK:') || line.match(/at .+\(.+:\d+:\d+\)/) || line.includes('Object.error')) {
                        return `<span class="log-stack">${highlightedLine}</span>`;
                    }
                    
                    return highlightedLine;
                });
                
                // Join the lines back with line breaks
                let highlightedText = highlightedLines.join('<br>');
                
                // Now handle JSON objects (which might span multiple lines)
                // This is a simple approach - a more complex parser would be needed for nested objects
                highlightedText = highlightedText.replace(/{.+}/gs, match => {
                    try {
                        // Try to parse and pretty print the JSON
                        const jsonObj = JSON.parse(match);
                        const prettyJson = JSON.stringify(jsonObj, null, 2)
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
                                let cls = 'log-json-number';
                                if (/^"/.test(match)) {
                                    if (/:$/.test(match)) {
                                        cls = 'log-json-key';
                                    } else {
                                        cls = 'log-json-string';
                                    }
                                } else if (/true|false/.test(match)) {
                                    cls = 'log-json-boolean';
                                } else if (/null/.test(match)) {
                                    cls = 'log-json-null';
                                }
                                return `<span class="${cls}">${match}</span>`;
                            });
                        
                        return `<div class="log-json">${prettyJson.replace(/\n/g, '<br>').replace(/\s{2}/g, '&nbsp;&nbsp;')}</div>`;
                    } catch (e) {
                        // If can't parse as JSON, just highlight the whole thing
                        return `<span class="log-json">${match}</span>`;
                    }
                });
                
                return highlightedText;
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
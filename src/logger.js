const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Logger class for handling application logs
 */
class Logger {
    constructor(options = {}) {
        // Default options
        this.options = {
            logDir: path.join(app ? app.getPath('userData') : __dirname, 'logs'),
            maxLogFiles: 10,
            maxLogSize: 5 * 1024 * 1024, // 5 MB
            logLevel: 'info',
            ...options
        };
        
        // Create log directory if it doesn't exist
        if (!fs.existsSync(this.options.logDir)) {
            fs.mkdirSync(this.options.logDir, { recursive: true });
        }
        
        // Set up log levels
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        // Current log file
        this.currentLogFile = path.join(
            this.options.logDir, 
            `app-${new Date().toISOString().split('T')[0]}.log`
        );
        
        // Initialize log file
        this.initLogFile();
    }
    
    /**
     * Initialize log file
     */
    initLogFile() {
        // Check if log file exists and create it if not
        if (!fs.existsSync(this.currentLogFile)) {
            fs.writeFileSync(
                this.currentLogFile, 
                `=== Driver Alerts Log Started at ${new Date().toISOString()} ===\n`,
                { encoding: 'utf8' }
            );
        }
        
        // Rotate logs if current log is too large
        this.rotateLogsIfNeeded();
    }
    
    /**
     * Rotate logs if current log file is too large
     */
    rotateLogsIfNeeded() {
        try {
            // Check if log file exists
            if (fs.existsSync(this.currentLogFile)) {
                const stats = fs.statSync(this.currentLogFile);
                
                // If file size exceeds maximum, create a new log file
                if (stats.size > this.options.maxLogSize) {
                    const timestamp = new Date().toISOString().replace(/:/g, '-');
                    const newLogFile = path.join(
                        this.options.logDir, 
                        `app-${timestamp}.log`
                    );
                    
                    // Create new log file
                    fs.writeFileSync(
                        newLogFile,
                        `=== Log Rotated from ${this.currentLogFile} at ${new Date().toISOString()} ===\n`,
                        { encoding: 'utf8' }
                    );
                    
                    // Set current log file to new file
                    this.currentLogFile = newLogFile;
                    
                    // Clean up old log files
                    this.cleanupOldLogs();
                }
            }
        } catch (error) {
            console.error('Error rotating logs:', error);
        }
    }
    
    /**
     * Clean up old log files
     */
    cleanupOldLogs() {
        try {
            // Get all log files
            const logFiles = fs.readdirSync(this.options.logDir)
                .filter(file => file.startsWith('app-') && file.endsWith('.log'))
                .map(file => path.join(this.options.logDir, file));
            
            // Sort log files by creation time (oldest first)
            logFiles.sort((a, b) => {
                return fs.statSync(a).birthtime.getTime() - fs.statSync(b).birthtime.getTime();
            });
            
            // Delete oldest log files if there are too many
            if (logFiles.length > this.options.maxLogFiles) {
                const filesToDelete = logFiles.slice(0, logFiles.length - this.options.maxLogFiles);
                
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file);
                });
            }
        } catch (error) {
            console.error('Error cleaning up old logs:', error);
        }
    }
    
    /**
     * Write a log entry
     * @param {string} level - Log level (error, warn, info, debug)
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    log(level, message, data = null) {
        // Check if log level is enabled
        if (this.logLevels[level] > this.logLevels[this.options.logLevel]) {
            return;
        }
        
        try {
            // Format log entry
            let logEntry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
            
            // Add data if provided
            if (data) {
                let dataStr = '';
                try {
                    dataStr = JSON.stringify(data);
                } catch (e) {
                    dataStr = `[Cannot stringify: ${e.message}]`;
                }
                logEntry += ` ${dataStr}`;
            }
            
            // Add newline
            logEntry += '\n';
            
            // Rotate logs if needed
            this.rotateLogsIfNeeded();
            
            // Write log entry to file
            fs.appendFileSync(this.currentLogFile, logEntry, { encoding: 'utf8' });
            
            // Also log to console if in development mode
            if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
                console[level](message, data || '');
            }
        } catch (error) {
            console.error('Error writing log entry:', error);
        }
    }
    
    /**
     * Log an error message
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    error(message, data = null) {
        this.log('error', message, data);
    }
    
    /**
     * Log a warning message
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    warn(message, data = null) {
        this.log('warn', message, data);
    }
    
    /**
     * Log an info message
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    info(message, data = null) {
        this.log('info', message, data);
    }
    
    /**
     * Log a debug message
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    debug(message, data = null) {
        this.log('debug', message, data);
    }
    
    /**
     * Get recent logs
     * @param {number} count - Number of log entries to retrieve
     * @returns {string} Recent log entries
     */
    getRecentLogs(count = 100) {
        try {
            // Check if log file exists
            if (fs.existsSync(this.currentLogFile)) {
                // Read log file
                const logContent = fs.readFileSync(this.currentLogFile, { encoding: 'utf8' });
                
                // Split log content into lines
                const logLines = logContent.split('\n');
                
                // Get last N lines
                return logLines.slice(-count).join('\n');
            }
            
            return '';
        } catch (error) {
            console.error('Error getting recent logs:', error);
            return '';
        }
    }
    
    /**
     * Get all logs
     * @returns {Array<string>} All log files
     */
    getAllLogs() {
        try {
            // Get all log files
            const logFiles = fs.readdirSync(this.options.logDir)
                .filter(file => file.startsWith('app-') && file.endsWith('.log'))
                .map(file => path.join(this.options.logDir, file));
            
            // Sort log files by creation time (newest first)
            logFiles.sort((a, b) => {
                return fs.statSync(b).birthtime.getTime() - fs.statSync(a).birthtime.getTime();
            });
            
            return logFiles;
        } catch (error) {
            console.error('Error getting all logs:', error);
            return [];
        }
    }
}

// Export logger instance
module.exports = new Logger(); 
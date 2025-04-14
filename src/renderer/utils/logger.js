/**
 * Logging utility for consistent logging across the application
 */

// Define log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level (can be changed at runtime)
let currentLogLevel = LOG_LEVELS.INFO;

/**
 * Set the current log level
 * @param {number|string} level - Log level to set (0-3 or name)
 */
function setLogLevel(level) {
  if (typeof level === 'string') {
    // Convert string level to number
    const levelUpper = level.toUpperCase();
    if (LOG_LEVELS.hasOwnProperty(levelUpper)) {
      currentLogLevel = LOG_LEVELS[levelUpper];
      return;
    }
  } else if (typeof level === 'number' && level >= 0 && level <= 3) {
    currentLogLevel = level;
    return;
  }
  
  console.warn(`Invalid log level: ${level}. Using default INFO level.`);
}

/**
 * Add timestamp to log message
 * @returns {string} Current timestamp in ISO format
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format additional data for logging
 * @param {any} data - Data to format
 * @returns {string} Formatted data
 */
function formatData(data) {
  if (!data) return '';
  
  try {
    if (typeof data === 'string') return data;
    return JSON.stringify(data);
  } catch (error) {
    return String(data);
  }
}

/**
 * Create a logger instance
 * @param {string} moduleName - Name of the module for the logger
 * @returns {Object} Logger object with log methods
 */
function createLogger(moduleName) {
  return {
    /**
     * Log an error message
     * @param {string} message - Error message
     * @param {Object} [data] - Additional data to log
     */
    error(message, data) {
      if (currentLogLevel >= LOG_LEVELS.ERROR) {
        const timestamp = getTimestamp();
        const formattedData = data ? formatData(data) : '';
        console.error(`[${timestamp}] [ERROR] [${moduleName}] ${message} ${formattedData}`);
      }
    },
    
    /**
     * Log a warning message
     * @param {string} message - Warning message
     * @param {Object} [data] - Additional data to log
     */
    warn(message, data) {
      if (currentLogLevel >= LOG_LEVELS.WARN) {
        const timestamp = getTimestamp();
        const formattedData = data ? formatData(data) : '';
        console.warn(`[${timestamp}] [WARN] [${moduleName}] ${message} ${formattedData}`);
      }
    },
    
    /**
     * Log an info message
     * @param {string} message - Info message
     * @param {Object} [data] - Additional data to log
     */
    info(message, data) {
      if (currentLogLevel >= LOG_LEVELS.INFO) {
        const timestamp = getTimestamp();
        const formattedData = data ? formatData(data) : '';
        console.info(`[${timestamp}] [INFO] [${moduleName}] ${message} ${formattedData}`);
      }
    },
    
    /**
     * Log a debug message
     * @param {string} message - Debug message
     * @param {Object} [data] - Additional data to log
     */
    debug(message, data) {
      if (currentLogLevel >= LOG_LEVELS.DEBUG) {
        const timestamp = getTimestamp();
        const formattedData = data ? formatData(data) : '';
        console.debug(`[${timestamp}] [DEBUG] [${moduleName}] ${message} ${formattedData}`);
      }
    }
  };
}

// Create pre-configured loggers for common modules
const renderer = createLogger('Renderer');
const main = createLogger('Main');
const database = createLogger('Database');
const ipc = createLogger('IPC');

module.exports = {
  LOG_LEVELS,
  setLogLevel,
  createLogger,
  renderer,
  main,
  database,
  ipc
}; 
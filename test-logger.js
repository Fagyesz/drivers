// Test logger functionality
const logger = require('./src/logger');

// Force logger level to debug
logger.setLogLevel('debug');
console.log('Logger level set to debug');

// Generate test logs at different levels
logger.debug('This is a debug message');
logger.info('This is an info message');
logger.warn('This is a warning message');
logger.error('This is a basic error message');

// Test with complex error object
logger.error('Error with stack trace', new Error('Test error with stack trace'));

// Test with custom error object
logger.error('Error with custom data', {
    error: 'Something failed',
    context: {
        operation: 'file_import',
        filename: 'test.xlsx',
        timestamp: new Date().toISOString()
    }
});

console.log('Test logs generated. Check your logs viewer.'); 
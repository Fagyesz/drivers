const moment = require('moment');

/**
 * DataMapper class for mapping and validating data from Excel to database schemas
 */
class DataMapper {
    constructor() {
        this.schemas = {};
        this.mappings = {};
    }
    
    /**
     * Add a schema definition
     * @param {string} schemaName - Name of the schema
     * @param {Object} schema - Schema definition with field types and validations
     */
    addSchema(schemaName, schema) {
        this.schemas[schemaName] = schema;
    }
    
    /**
     * Add a mapping configuration
     * @param {string} mappingName - Name of the mapping configuration
     * @param {Object} mapping - Mapping rules between Excel columns and DB fields
     */
    addMapping(mappingName, mapping) {
        this.mappings[mappingName] = mapping;
    }
    
    /**
     * Map data from Excel format to database schema
     * @param {Array} data - Array of data objects from Excel
     * @param {string} mappingName - Name of the mapping to use
     * @param {string} schemaName - Name of the schema to validate against
     * @returns {Object} Result with mapped data and validation errors
     */
    mapData(data, mappingName, schemaName) {
        const mapping = this.mappings[mappingName];
        const schema = this.schemas[schemaName];
        
        if (!mapping) {
            throw new Error(`Mapping '${mappingName}' not found`);
        }
        
        if (!schema) {
            throw new Error(`Schema '${schemaName}' not found`);
        }
        
        const result = {
            data: [],
            errors: []
        };
        
        // Process each row of data
        data.forEach((row, rowIndex) => {
            try {
                const mappedItem = this.mapItem(row, mapping, schema);
                result.data.push(mappedItem);
            } catch (error) {
                result.errors.push({
                    row: rowIndex + 1,
                    error: error.message
                });
            }
        });
        
        return result;
    }
    
    /**
     * Map a single data item
     * @param {Object} item - Data item from Excel
     * @param {Object} mapping - Mapping configuration
     * @param {Object} schema - Schema definition
     * @returns {Object} Mapped data item
     */
    mapItem(item, mapping, schema) {
        const mappedItem = {};
        const errors = [];
        
        // Apply each mapping rule
        Object.entries(mapping).forEach(([dbField, rule]) => {
            let value;
            
            // If rule is a string, it's a simple field mapping
            if (typeof rule === 'string') {
                value = item[rule];
            } 
            // If rule is a function, it's a transformation
            else if (typeof rule === 'function') {
                value = rule(item);
            }
            // If rule is an object, it's a complex mapping with transformations
            else if (typeof rule === 'object' && rule !== null) {
                const { field, transform } = rule;
                value = item[field];
                
                if (transform && typeof transform === 'function') {
                    value = transform(value, item);
                }
            }
            
            // Validate and convert value based on schema
            try {
                if (schema[dbField]) {
                    value = this.validateAndConvert(value, schema[dbField], dbField);
                }
                
                mappedItem[dbField] = value;
            } catch (error) {
                errors.push(`Field '${dbField}': ${error.message}`);
            }
        });
        
        // If there are validation errors, throw an exception
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        
        return mappedItem;
    }
    
    /**
     * Validate and convert a value based on schema definition
     * @param {any} value - Value to validate and convert
     * @param {Object} fieldSchema - Schema for this field
     * @param {string} fieldName - Name of the field
     * @returns {any} Validated and converted value
     */
    validateAndConvert(value, fieldSchema, fieldName) {
        const { type, required, validate, default: defaultValue } = fieldSchema;
        
        // Check if required
        if (required && (value === null || value === undefined || value === '')) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new Error(`Field '${fieldName}' is required`);
        }
        
        // Use default value if value is empty
        if ((value === null || value === undefined || value === '') && defaultValue !== undefined) {
            return defaultValue;
        }
        
        // Skip further validation if value is null or undefined
        if (value === null || value === undefined || value === '') {
            return null;
        }
        
        // Convert and validate based on type
        switch (type) {
            case 'string':
                value = String(value);
                break;
                
            case 'integer':
                if (isNaN(Number(value))) {
                    throw new Error(`Value '${value}' is not a valid integer`);
                }
                value = parseInt(value, 10);
                break;
                
            case 'float':
            case 'real':
            case 'number':
                if (isNaN(Number(value))) {
                    throw new Error(`Value '${value}' is not a valid number`);
                }
                value = parseFloat(value);
                break;
                
            case 'boolean':
                if (typeof value === 'string') {
                    value = value.toLowerCase();
                    value = ['true', 'yes', '1', 'y'].includes(value);
                } else {
                    value = Boolean(value);
                }
                break;
                
            case 'date':
                try {
                    const momentDate = moment(value);
                    if (!momentDate.isValid()) {
                        throw new Error('Invalid date');
                    }
                    value = momentDate.format('YYYY-MM-DD');
                } catch (error) {
                    throw new Error(`Value '${value}' is not a valid date`);
                }
                break;
                
            case 'datetime':
                try {
                    const momentDate = moment(value);
                    if (!momentDate.isValid()) {
                        throw new Error('Invalid datetime');
                    }
                    value = momentDate.format('YYYY-MM-DD HH:mm:ss');
                } catch (error) {
                    throw new Error(`Value '${value}' is not a valid datetime`);
                }
                break;
                
            case 'time':
                try {
                    // Handle different time formats
                    let momentTime;
                    
                    if (typeof value === 'string' && value.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
                        // Format HH:MM or HH:MM:SS
                        momentTime = moment(value, ['HH:mm:ss', 'HH:mm']);
                    } else {
                        momentTime = moment(value);
                    }
                    
                    if (!momentTime.isValid()) {
                        throw new Error('Invalid time');
                    }
                    
                    value = momentTime.format('HH:mm:ss');
                } catch (error) {
                    throw new Error(`Value '${value}' is not a valid time`);
                }
                break;
        }
        
        // Run custom validation if provided
        if (validate && typeof validate === 'function') {
            const isValid = validate(value);
            if (!isValid) {
                throw new Error(`Value '${value}' failed validation`);
            }
        }
        
        return value;
    }
    
    /**
     * Load predefined schemas from configuration
     * @param {Object} schemas - Object with schema definitions
     */
    loadSchemas(schemas) {
        Object.entries(schemas).forEach(([name, schema]) => {
            this.addSchema(name, schema);
        });
    }
    
    /**
     * Load predefined mappings from configuration
     * @param {Object} mappings - Object with mapping definitions
     */
    loadMappings(mappings) {
        Object.entries(mappings).forEach(([name, mapping]) => {
            this.addMapping(name, mapping);
        });
    }
}

module.exports = new DataMapper(); 
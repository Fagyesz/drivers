/**
 * Validation utilities for data checking
 */

/**
 * Check if a value is a valid date
 * @param {any} dateValue - Value to check
 * @returns {boolean} True if valid date
 */
function isValidDate(dateValue) {
  if (!dateValue) return false;
  
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return !isNaN(date.getTime());
  } catch (error) {
    return false;
  }
}

/**
 * Check if a value is a valid time
 * @param {string} timeValue - Time value to check (expected format: HH:MM or HH:MM:SS)
 * @returns {boolean} True if valid time
 */
function isValidTime(timeValue) {
  if (!timeValue || typeof timeValue !== 'string') return false;
  
  // Regular expression for time format HH:MM or HH:MM:SS
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
  return timeRegex.test(timeValue);
}

/**
 * Check if a value is a valid plate number
 * @param {string} plateNumber - Plate number to validate
 * @returns {boolean} True if valid plate number
 */
function isValidPlateNumber(plateNumber) {
  if (!plateNumber || typeof plateNumber !== 'string') return false;
  
  // Remove spaces and special characters
  const cleanPlate = plateNumber.replace(/[^a-zA-Z0-9]/g, '');
  
  // Plate should have at least 2 characters after cleaning
  if (cleanPlate.length < 2) return false;
  
  // Must contain at least one letter and one number
  return /[a-zA-Z]/.test(cleanPlate) && /[0-9]/.test(cleanPlate);
}

/**
 * Check if a value is a valid email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if a value is a valid phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  
  // Remove all non-numeric characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Should have at least 8 digits
  return cleanPhone.length >= 8;
}

/**
 * Check if a value is a non-empty string
 * @param {any} value - Value to check
 * @returns {boolean} True if non-empty string
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a positive number
 * @param {any} value - Value to check
 * @returns {boolean} True if positive number
 */
function isPositiveNumber(value) {
  if (value === null || value === undefined) return false;
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

/**
 * Check if a value is a non-negative number (zero or positive)
 * @param {any} value - Value to check
 * @returns {boolean} True if non-negative number
 */
function isNonNegativeNumber(value) {
  if (value === null || value === undefined) return false;
  const num = Number(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Validate a required field
 * @param {any} value - Value to check
 * @param {string} fieldName - Name of the field for error message
 * @returns {Object} Object with isValid flag and error message
 */
function validateRequired(value, fieldName) {
  const valid = value !== null && value !== undefined && value !== '';
  return {
    isValid: valid,
    message: valid ? '' : `${fieldName} is required`
  };
}

/**
 * Validate an object against a schema
 * @param {Object} data - Data object to validate
 * @param {Object} schema - Validation schema with field name keys and validation function values
 * @returns {Object} Object with isValid flag and errors object
 */
function validateSchema(data, schema) {
  const errors = {};
  let isValid = true;
  
  for (const field in schema) {
    if (schema.hasOwnProperty(field)) {
      const validator = schema[field];
      const value = data[field];
      
      // Run the validator for this field
      const result = validator(value);
      
      if (!result.isValid) {
        errors[field] = result.message;
        isValid = false;
      }
    }
  }
  
  return { isValid, errors };
}

module.exports = {
  isValidDate,
  isValidTime,
  isValidPlateNumber,
  isValidEmail,
  isValidPhone,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  validateRequired,
  validateSchema
}; 
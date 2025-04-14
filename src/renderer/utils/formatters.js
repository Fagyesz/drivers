/**
 * Formatting utilities for consistent data display
 */

/**
 * Format a date to YYYY-MM-DD format
 * @param {Date|string} dateValue - Date object or date string
 * @returns {string} Formatted date string or empty string if invalid
 */
function formatDateYYYYMMDD(dateValue) {
  if (!dateValue) return "";
  
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return "";
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
}

/**
 * Format a date to a localized format
 * @param {Date|string} dateValue - Date object or date string
 * @returns {string} Formatted date string or empty string if invalid
 */
function formatDate(dateValue) {
  if (!dateValue) return "";
  
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return "";
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
}

/**
 * Format a time to HH:MM format
 * @param {Date|string} timeValue - Date object or time string
 * @returns {string} Formatted time string or empty string if invalid
 */
function formatTime(timeValue) {
  if (!timeValue) return "";
  
  try {
    const date = timeValue instanceof Date ? timeValue : new Date(timeValue);
    if (isNaN(date.getTime())) return "";
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error("Error formatting time:", error);
    return "";
  }
}

/**
 * Format a date and time
 * @param {Date|string} dateTimeValue - Date object or date/time string
 * @returns {string} Formatted date/time string or empty string if invalid
 */
function formatDateTime(dateTimeValue) {
  if (!dateTimeValue) return "";
  
  try {
    const date = dateTimeValue instanceof Date ? dateTimeValue : new Date(dateTimeValue);
    if (isNaN(date.getTime())) return "";
    
    return date.toLocaleString();
  } catch (error) {
    console.error("Error formatting date/time:", error);
    return "";
  }
}

/**
 * Calculate duration between two times
 * @param {string} checkIn - Check-in time string
 * @param {string} checkOut - Check-out time string
 * @returns {string} Formatted duration or empty string if invalid
 */
function calculateDuration(checkIn, checkOut) {
  if (!checkIn || !checkOut) return "";
  
  try {
    // Parse times
    const timeIn = new Date(`1970-01-01T${checkIn}`);
    const timeOut = new Date(`1970-01-01T${checkOut}`);
    
    if (isNaN(timeIn.getTime()) || isNaN(timeOut.getTime())) return "";
    
    // Calculate duration in minutes
    let diff = (timeOut.getTime() - timeIn.getTime()) / 1000 / 60;
    
    // Handle overnight shifts
    if (diff < 0) {
      diff += 24 * 60;
    }
    
    const hours = Math.floor(diff / 60);
    const minutes = Math.floor(diff % 60);
    
    return `${hours}h ${minutes}m`;
  } catch (error) {
    console.error("Error calculating duration:", error);
    return "";
  }
}

/**
 * Get a date range string from an array of records
 * @param {Array} records - Array of objects with date properties
 * @param {string} dateField - Name of the date field to use
 * @returns {string} Formatted date range or message if no records
 */
function getDateRange(records, dateField = 'date') {
  if (!records || !records.length) return "No records available";
  
  try {
    // Map dates and filter out invalid ones
    const dates = records
      .map(record => record[dateField] ? new Date(record[dateField]) : null)
      .filter(date => date instanceof Date && !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (!dates.length) return "No valid dates";
    
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    // Format the start and end dates
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    
    return start === end ? start : `${start} - ${end}`;
  } catch (error) {
    console.error("Error getting date range:", error);
    return "Date range unavailable";
  }
}

/**
 * Format a vehicle plate number for consistency
 * @param {string} plateNumber - Raw plate number
 * @returns {string} Formatted plate number
 */
function formatPlateNumber(plateNumber) {
  if (!plateNumber) return "";
  
  // Remove all non-alphanumeric characters and convert to uppercase
  return plateNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

module.exports = {
  formatDateYYYYMMDD,
  formatDate,
  formatTime,
  formatDateTime,
  calculateDuration,
  getDateRange,
  formatPlateNumber
}; 
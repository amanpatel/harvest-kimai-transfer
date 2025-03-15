/**
 * Date utility functions for handling date operations
 */
class DateUtils {
  /**
   * Get the start and end date for the current month
   * @returns {Object} Object containing from and to dates
   */
  static getCurrentMonth() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      from: this.formatDate(from),
      to: this.formatDate(to)
    };
  }

  /**
   * Get yesterday's date
   * @returns {Object} Object containing from and to dates (both set to yesterday)
   */
  static getYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateStr = this.formatDate(yesterday);
    
    return {
      from: dateStr,
      to: dateStr
    };
  }

  /**
   * Format date as YYYY-MM-DD
   * @param {Date} date - The date to format
   * @returns {String} Formatted date string
   */
  static formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Validate date string format (YYYY-MM-DD)
   * @param {String} dateString - The date string to validate
   * @returns {Boolean} True if valid, false otherwise
   */
  static isValidDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
}

module.exports = DateUtils;

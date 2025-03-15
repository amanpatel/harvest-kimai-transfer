require('dotenv').config();
const logger = require('./logger');

/**
 * Configuration manager that loads and validates environment variables
 */
class Config {
  /**
   * Get Harvest API configuration
   * @returns {Object} Harvest API configuration
   */
  static getHarvestConfig() {
    const accessToken = process.env.HARVEST_ACCESS_TOKEN;
    const accountId = process.env.HARVEST_ACCOUNT_ID;
    
    if (!accessToken) {
      logger.error('Missing Harvest API credentials in environment variables');
      throw new Error('HARVEST_ACCESS_TOKEN is required');
    }
    
    if (!accountId) {
      logger.error('Missing Harvest Account ID in environment variables');
      throw new Error('HARVEST_ACCOUNT_ID is required');
    }

    return {
      accessToken,
      accountId
    };
  }

  /**
   * Get Kimai API configuration
   * @returns {Object} Kimai API configuration
   */
  static getKimaiConfig() {
    const url = process.env.KIMAI_URL;
    const username = process.env.KIMAI_API_USERNAME;
    const token = process.env.KIMAI_API_TOKEN;
    
    if (!url || !username || !token) {
      logger.error('Missing Kimai API credentials in environment variables');
      throw new Error('KIMAI_URL, KIMAI_API_USERNAME, and KIMAI_API_TOKEN are required');
    }

    return {
      url,
      username,
      token
    };
  }
}

module.exports = Config;

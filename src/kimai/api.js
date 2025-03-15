const axios = require('axios');
const logger = require('../utils/logger');
const Config = require('../utils/config');

/**
 * Kimai API client for interacting with Kimai time tracking
 */
class KimaiApi {
  constructor() {
    const { url, username, token } = Config.getKimaiConfig();

    this.client = axios.create({
      baseURL: `${url}/api`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Create a time entry in Kimai
   * @param {Object} timeEntry - Time entry data
   * @returns {Promise<Object>} Created time entry
   */
  async createTimesheet(timeEntry) {
    try {
      logger.info(`Creating timesheet entry in Kimai for ${timeEntry.date}`);
      const response = await this.client.post('/timesheets', timeEntry);
      return response.data;
    } catch (error) {
      logger.error(`Error creating timesheet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get projects from Kimai for mapping
   * @returns {Promise<Array>} List of projects
   */
  async getProjects() {
    try {
      const response = await this.client.get('/projects');
      return response.data;
    } catch (error) {
      logger.error(`Error fetching projects: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get activities from Kimai for mapping
   * @returns {Promise<Array>} List of activities
   */
  async getActivities() {
    try {
      logger.info('Fetching activities from Kimai');
      const response = await this.client.get('/activities', {
        params: { visible: 1 }
      });
      logger.info(`Retrieved ${response.data.length} activities from Kimai`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching activities: ${error.message}`);
      throw error;
    }
  }
}

module.exports = KimaiApi;

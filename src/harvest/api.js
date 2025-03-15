const axios = require('axios');
const logger = require('../utils/logger');
const Config = require('../utils/config');

/**
 * Harvest API client for interacting with Harvest time entries
 */
class HarvestApi {
  constructor() {
    const { accessToken, accountId } = Config.getHarvestConfig();
    
    this.client = axios.create({
      baseURL: 'https://api.harvestapp.com/v2',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Harvest-Account-ID': accountId,
        'User-Agent': 'Harvest-Kimai Transfer Tool',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetch time entries from Harvest for a given date range
   * @param {String} from - Start date (YYYY-MM-DD)
   * @param {String} to - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of time entries
   */
  async getTimeEntries(from, to) {
    try {
      logger.info(`Fetching Harvest time entries from ${from} to ${to}`);
      
      let allEntries = [];
      let page = 1;
      let response;
      
      // Paginate through all results
      do {
        response = await this.client.get('/time_entries', {
          params: {
            from,
            to,
            page
          }
        });
        
        allEntries = allEntries.concat(response.data.time_entries);
        page++;
        
      } while (response.data.links.next);
      
      logger.info(`Retrieved ${allEntries.length} time entries from Harvest`);
      return allEntries;
    } catch (error) {
      logger.error(`Error fetching time entries: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Fetch all tasks from Harvest
   * @returns {Promise<Array>} Array of tasks
   */
  async getTasks() {
    try {
      logger.info('Fetching Harvest tasks');
      
      let allTasks = [];
      let page = 1;
      let response;
      
      // Paginate through all results
      do {
        response = await this.client.get('/tasks', {
          params: { page }
        });
        
        allTasks = allTasks.concat(response.data.tasks);
        page++;
        
      } while (response.data.links.next);
      
      logger.info(`Retrieved ${allTasks.length} tasks from Harvest`);
      return allTasks;
    } catch (error) {
      logger.error(`Error fetching tasks: ${error.message}`);
      throw error;
    }
  }
}

module.exports = HarvestApi;

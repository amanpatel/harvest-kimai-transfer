const HarvestApi = require('./api');
const KimaiApi = require('../kimai/api');
const Storage = require('../db/storage');
const logger = require('../utils/logger');

/**
 * Handles extraction of time entries from Harvest
 */
class HarvestExtractor {
  constructor() {
    this.api = new HarvestApi();
    this.kimaiApi = new KimaiApi();
    this.storage = new Storage();
  }

  /**
   * Extract time entries for a given date range and store them
   * @param {String} from - Start date (YYYY-MM-DD)
   * @param {String} to - End date (YYYY-MM-DD)
   * @returns {Promise<number>} Number of entries extracted
   */
  async extractTimeEntries(from, to) {
    try {
      logger.info(`Starting extraction of time entries from ${from} to ${to}`);
      
      // Get entries from Harvest
      const entries = await this.api.getTimeEntries(from, to);
      logger.info(`Retrieved ${entries.length} time entries from Harvest. First entry ID: ${entries[0]?.id}`);
      
      // Store entries in database
      logger.info('Starting database storage operation for time entries');
      console.log("Entries to store:", entries);
      const result = await this.storage.storeHarvestEntries(entries);
      
      // Verify entries were stored by retrieving them
      const storedEntries = await this.getPendingEntries(from, to);
      logger.info(`Verification: ${storedEntries.length} time entries found in database for the given date range`);
      
      // Log summary of changes
      logger.info(`Sync summary: ${result.inserted} new entries, ${result.updated} updated entries, ${result.unchanged} unchanged entries`);
      
      return entries.length;
    } catch (error) {
      logger.error(`Error extracting time entries: ${error.stack}`);
      throw error;
    }
  }
  
  /**
   * Get pending entries for verification
   * @param {String} from - Start date
   * @param {String} to - End date 
   * @returns {Promise<Array>} Array of entries
   */
  async getPendingEntries(from, to) {
    return this.storage.getPendingEntries(from, to);
  }
  
  /**
   * Extract tasks from Harvest and store them
   * @returns {Promise<{harvestTasks: number, kimaiActivities: number, matched: number}>} Number of tasks extracted and matched
   */
  async extractTasks() {
    logger.info("Starting task extraction process");
    try {
      // STEP 1: Extract Harvest tasks
      logger.info('Fetching tasks from Harvest API');
      
      // Get tasks from Harvest
      const tasks = await this.api.getTasks();
      
      if (!tasks || tasks.length === 0) {
        logger.warn('No tasks returned from Harvest API');
        return { harvestTasks: 0, kimaiActivities: 0, matched: 0 };
      }
      
      logger.info(`Retrieved ${tasks.length} tasks from Harvest. First task ID: ${tasks[0]?.id}`);
      
      // Truncate the tasks table first
      logger.info('Truncating existing tasks table');
      await this.storage.truncateTasks();
      
      // Store tasks in database
      logger.info('Starting database storage operation');
      await this.storage.storeTasks(tasks);
      
      // STEP 2: Extract Kimai activities
      logger.info('Fetching activities from Kimai API');
      
      // Get activities from Kimai
      const activities = await this.kimaiApi.getActivities();
      
      if (!activities || activities.length === 0) {
        logger.warn('No activities returned from Kimai API');
        return { harvestTasks: tasks.length, kimaiActivities: 0, matched: 0 };
      }
      
      logger.info(`Retrieved ${activities.length} activities from Kimai. First activity ID: ${activities[0]?.id}`);
      
      // Truncate the tasks_kimai table first
      logger.info('Truncating existing tasks_kimai table');
      await this.storage.truncateKimaiTasks();
      
      // Store activities in database
      logger.info('Starting Kimai activities storage operation');
      await this.storage.storeKimaiActivities(activities);
      
      // STEP 3: Match Harvest tasks with Kimai activities
      logger.info('Starting task matching process');
      const matchResult = await this.storage.matchTasksWithActivities();
      
      // Verify everything worked
      const storedTasks = await this.storage.getTasks();
      const storedActivities = await this.storage.getKimaiActivities();
      logger.info(`Verification: ${storedTasks.length} harvest tasks and ${storedActivities.length} kimai activities found in database`);
      logger.info(`Task matching results: ${matchResult.matched} tasks matched with Kimai activities, ${matchResult.unmatched} unmatched`);
      
      return { 
        harvestTasks: tasks.length, 
        kimaiActivities: activities.length,
        matched: matchResult.matched
      };
    } catch (error) {
      logger.error(`Error extracting tasks: ${error.stack}`);
      throw error;
    }
  }
}

module.exports = HarvestExtractor;

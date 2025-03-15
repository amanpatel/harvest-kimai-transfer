const KimaiApi = require('./api');
const Storage = require('../db/storage');
const logger = require('../utils/logger');

/**
 * Handles importing time entries to Kimai
 */
class KimaiImporter {
  constructor() {
    this.api = new KimaiApi();
    this.storage = new Storage();
  }

  /**
   * Import all pending time entries
   * @returns {Promise<number>} Number of entries imported
   */
  async importTimeEntries() {
    try {
      logger.info('Starting import of all pending time entries');
      
      // Get all pending entries from storage
      const entries = await this.storage.getAllPendingEntries();
      logger.info(`Found ${entries.length} entries to import`);
      
      if (entries.length === 0) {
        logger.info('No pending entries to import');
        return 0;
      }
      
      let imported = 0;
      let failed = 0;
      
      for (const entry of entries) {
        try {
          // Skip entries without project or activity mapping
          if (!entry.kimai_project_id || !entry.kimai_activity_id) {
            logger.warn(`Skipping entry ${entry.harvest_id} - Missing project or activity mapping`);
            continue;
          }
          
          // Transform Harvest entry to Kimai format
          const kimaiEntry = this.transformEntry(entry);
          
          logger.debug(`Importing entry ${entry.harvest_id} to Kimai`, { kimaiEntry });
          
          // Upload to Kimai
          const result = await this.api.createTimesheet(kimaiEntry);
          
          // Mark as imported
          await this.storage.markAsImported(entry.harvest_id, result.id);
          imported++;
          logger.debug(`Successfully imported entry ${entry.harvest_id} as Kimai ID ${result.id}`);
        } catch (error) {
          logger.error(`Failed to import entry ${entry.harvest_id}: ${error.message}`);
          failed++;
        }
      }
      
      logger.info(`Import complete: ${imported} entries imported, ${failed} entries failed`);
      return imported;
    } catch (error) {
      logger.error(`Error importing time entries: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transform Harvest entry to Kimai format
   * @param {Object} entry - Entry from storage with task mapping
   * @returns {Object} Entry formatted for Kimai
   */
  transformEntry(entry) {
    // Parse created_at as the begin time
    const beginTime = entry.created_at ? new Date(entry.created_at) : new Date();
    
    // Calculate end time by adding hours
    const endTime = new Date(beginTime.getTime());
    endTime.setMinutes(endTime.getMinutes() + Math.round(entry.hours * 60));
    
    return {
      begin: beginTime.toISOString(),
      end: endTime.toISOString(),
      description: entry.notes || '',
      project: parseInt(entry.kimai_project_id, 10),
      activity: parseInt(entry.kimai_activity_id, 10)
    };
  }
}

module.exports = KimaiImporter;

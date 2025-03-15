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
      
      // Sort entries by date to maintain sequential order
      entries.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let imported = 0;
      let failed = 0;
      
      // Track the latest end time for each date to avoid overlaps
      const dateEndTimeMap = new Map();
      
      for (const entry of entries) {
        try {
          // Skip entries without project or activity mapping
          if (!entry.kimai_project_id || !entry.kimai_activity_id) {
            logger.warn(`Skipping entry ${entry.harvest_id} - Missing project or activity mapping`);
            continue;
          }
          
          // Transform Harvest entry to Kimai format
          const kimaiEntry = this.transformEntry(entry, dateEndTimeMap);
          
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
   * @param {Map} dateEndTimeMap - Map tracking end times for each date
   * @returns {Object} Entry formatted for Kimai
   */
  transformEntry(entry, dateEndTimeMap) {
    let beginTime;
    const entryDate = entry.date;
    
    // Check if created_at exists
    if (entry.created_at) {
      const createdAtDate = new Date(entry.created_at);
      const dateObj = new Date(entryDate);
      
      // Compare date portions (year, month, day) to see if they're the same
      const sameDate = createdAtDate.getFullYear() === dateObj.getFullYear() &&
                        createdAtDate.getMonth() === dateObj.getMonth() &&
                        createdAtDate.getDate() === dateObj.getDate();
      
      if (sameDate) {
        // If same date, use the created_at timestamp
        logger.debug(`Entry ${entry.harvest_id}: Using created_at time since date matches entry date`);
        beginTime = createdAtDate;
      } else {
        // If different date, check if we have an end time for this date already
        if (dateEndTimeMap.has(entryDate)) {
          // Use the last entry's end time as our start time
          beginTime = new Date(dateEndTimeMap.get(entryDate));
          logger.debug(`Entry ${entry.harvest_id}: Using sequential time ${beginTime.toTimeString()}`);
        } else {
          // Start from 9:00 AM for first entry of the day
          beginTime = new Date(entryDate);
          beginTime.setHours(9, 0, 0, 0);
          logger.debug(`Entry ${entry.harvest_id}: Using 9:00 AM as start time for new date`);
        }
      }
    } else {
      // No created_at, check if we have an end time for this date already
      if (dateEndTimeMap.has(entryDate)) {
        // Use the last entry's end time as our start time
        beginTime = new Date(dateEndTimeMap.get(entryDate));
        logger.debug(`Entry ${entry.harvest_id}: Using sequential time ${beginTime.toTimeString()}`);
      } else {
        // Start from 9:00 AM for first entry of the day
        beginTime = new Date(entryDate);
        beginTime.setHours(9, 0, 0, 0);
        logger.debug(`Entry ${entry.harvest_id}: Using 9:00 AM as start time for new date`);
      }
    }
    
    // Calculate end time by adding hours
    const endTime = new Date(beginTime.getTime());
    endTime.setMinutes(endTime.getMinutes() + Math.round(entry.hours * 60));
    
    // Update the map with the latest end time for this date
    dateEndTimeMap.set(entryDate, endTime);
    
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

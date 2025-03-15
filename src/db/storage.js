const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

/**
 * Storage class for handling local data persistence
 */
class Storage {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/timeEntries.db');
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        logger.error(`Error connecting to database: ${err.message}`);
      } else {
        logger.info('Connected to the time entries database');
        this.initDatabase();
      }
    });
  }

  /**
   * Initialize database tables if they don't exist
   */
  initDatabase() {
    this.db.serialize(() => {
      // Create time entries table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS time_entries (
          id INTEGER PRIMARY KEY,
          harvest_id TEXT UNIQUE,
          kimai_id TEXT,
          date TEXT,
          client TEXT,
          project TEXT,
          task TEXT,
          notes TEXT,
          hours REAL,
          started_time TEXT,
          ended_time TEXT,
          imported INTEGER DEFAULT 0,
          created_at TEXT
        )
      `, (err) => {
        if (err) {
          logger.error(`Error creating time entries schema: ${err.message}`);
        } else {
          logger.info('Time entries table initialized');
        }
      });
      
      // Create tasks table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY,
          harvest_id TEXT UNIQUE,
          name TEXT,
          is_active BOOLEAN,
          created_at TEXT,
          updated_at TEXT
        )
      `, (err) => {
        if (err) {
          logger.error(`Error creating tasks schema: ${err.message}`);
        } else {
          logger.info('Tasks table initialized');
          
          // Check if columns exist and add them if they don't
          this.addMissingColumns();
        }
      });

      // Create tasks_kimai table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks_kimai (
          id INTEGER PRIMARY KEY,
          kimai_project_id TEXT,
          kimai_activity_id TEXT,
          task_name TEXT,
          parent_title TEXT,
          created_at TEXT
        )
      `, (err) => {
        if (err) {
          logger.error(`Error creating tasks_kimai schema: ${err.message}`);
        } else {
          logger.info('Tasks_kimai table initialized');
        }
      });
    });
  }
  
  /**
   * Add missing columns to the tasks table if they don't exist
   */
  addMissingColumns() {
    // Check if the kimai columns exist
    this.db.get("PRAGMA table_info(tasks)", (err, rows) => {
      if (err) {
        logger.error(`Error checking table schema: ${err.message}`);
        return;
      }
      
      // A helper function to add a column if it doesn't exist
      const addColumnIfNeeded = (columnName) => {
        return new Promise((resolve, reject) => {
          this.db.run(`ALTER TABLE tasks ADD COLUMN ${columnName} TEXT DEFAULT NULL`, (err) => {
            if (err) {
              // Column might already exist
              logger.debug(`Note: ${columnName} column may already exist: ${err.message}`);
            } else {
              logger.info(`Added ${columnName} column to tasks table`);
            }
            resolve();
          });
        });
      };
      
      // Add each column sequentially
      this.db.serialize(async () => {
        try {
          await addColumnIfNeeded('kimai_project_id');
          await addColumnIfNeeded('kimai_activity_id');
          await addColumnIfNeeded('kimai_activity_name');
          logger.info('Schema update complete');
        } catch (error) {
          logger.error(`Error updating schema: ${error.message}`);
        }
      });
    });
  }

  /**
   * Store Harvest time entries
   * @param {Array} entries - Array of time entries from Harvest
   * @returns {Promise<{inserted: number, updated: number, unchanged: number}>}
   */
  storeHarvestEntries(entries) {
    return new Promise((resolve, reject) => {
      logger.info(`Processing ${entries.length} time entries for database storage`);
      
      if (!entries || entries.length === 0) {
        logger.warn('No time entries to store, returning early');
        return resolve({ inserted: 0, updated: 0, unchanged: 0 });
      }
      
      // First, get all existing harvest_ids for the date range
      const harvestIds = entries.map(entry => entry.id.toString());
      
      this.db.all(
        `SELECT harvest_id, date, client, project, task, notes, hours, started_time, ended_time 
         FROM time_entries 
         WHERE harvest_id IN (${harvestIds.map(() => '?').join(',')})`,
        harvestIds,
        (err, existingEntries) => {
          if (err) {
            logger.error(`Error fetching existing entries: ${err.message}`);
            return reject(err);
          }
          
          // Convert existing entries to a map for easy lookup
          const existingEntriesMap = new Map();
          existingEntries.forEach(entry => {
            existingEntriesMap.set(entry.harvest_id, entry);
          });
          
          // Sort entries into new and updated
          const newEntries = [];
          const updatedEntries = [];
          const unchangedEntries = [];
          
          entries.forEach(entry => {
            const harvestId = entry.id.toString();
            const existing = existingEntriesMap.get(harvestId);
            
            if (!existing) {
              newEntries.push(entry);
            } else {
              // Check if any fields have changed
              const hasChanged = 
                existing.date !== entry.spent_date ||
                existing.client !== (entry.client?.name || '') ||
                existing.project !== (entry.project?.name || '') ||
                existing.task !== (entry.task?.name || '') ||
                existing.notes !== (entry.notes || '') ||
                existing.hours !== entry.hours ||
                existing.started_time !== entry.started_time ||
                existing.ended_time !== entry.ended_time;
                
              if (hasChanged) {
                updatedEntries.push(entry);
              } else {
                unchangedEntries.push(entry);
              }
            }
          });
          
          logger.info(`Found ${newEntries.length} new entries, ${updatedEntries.length} changed entries, and ${unchangedEntries.length} unchanged entries`);
          
          // Move these variables to a higher scope so they're available in all code blocks
          let insertedCount = 0;
          let insertErrorCount = 0;
          let updatedCount = 0;
          let updateErrorCount = 0;
          
          this.db.serialize(() => {
            // Process new entries
            if (newEntries.length > 0) {
              const insertStmt = this.db.prepare(`
                INSERT INTO time_entries 
                (harvest_id, date, client, project, task, notes, hours, started_time, ended_time, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);
              
              try {
                newEntries.forEach(entry => {
                  try {
                    logger.debug(`Inserting new time entry: ${entry.id} - ${entry.spent_date}`);
                    
                    insertStmt.run(
                      entry.id.toString(),
                      entry.spent_date,
                      entry.client?.name || '',
                      entry.project?.name || '',
                      entry.task?.name || '',
                      entry.notes || '',
                      entry.hours,
                      entry.started_time,
                      entry.ended_time,
                      entry.created_at || new Date().toISOString(), // Use Harvest's created_at field if available
                      function(err) {
                        if (err) {
                          logger.error(`Error inserting time entry ${entry.id}: ${err.message}`);
                          insertErrorCount++;
                        } else {
                          insertedCount++;
                        }
                      }
                    );
                  } catch (entryError) {
                    logger.error(`Error processing new entry ${entry.id}: ${entryError.message}`);
                    insertErrorCount++;
                  }
                });
                
                insertStmt.finalize(err => {
                  if (err) {
                    logger.error(`Error finalizing insert statement: ${err.message}`);
                  }
                  logger.info(`Inserted ${insertedCount} new entries, with ${insertErrorCount} errors`);
                  
                  // Only resolve here if there are no updates to process
                  if (updatedEntries.length === 0) {
                    resolve({ 
                      inserted: insertedCount, 
                      updated: 0, 
                      unchanged: unchangedEntries.length 
                    });
                  }
                });
              } catch (error) {
                logger.error(`Error in insert operation: ${error.message}`);
                // Don't reject here, try to continue with updates
              }
            }
            
            // Process updated entries
            if (updatedEntries.length > 0) {
              const updateStmt = this.db.prepare(`
                UPDATE time_entries 
                SET date = ?, client = ?, project = ?, task = ?, notes = ?, 
                    hours = ?, started_time = ?, ended_time = ?
                WHERE harvest_id = ?
              `);
              
              try {
                updatedEntries.forEach(entry => {
                  try {
                    logger.debug(`Updating time entry: ${entry.id} - ${entry.spent_date}`);
                    
                    updateStmt.run(
                      entry.spent_date,
                      entry.client?.name || '',
                      entry.project?.name || '',
                      entry.task?.name || '',
                      entry.notes || '',
                      entry.hours,
                      entry.started_time,
                      entry.ended_time,
                      entry.id.toString(),
                      function(err) {
                        if (err) {
                          logger.error(`Error updating time entry ${entry.id}: ${err.message}`);
                          updateErrorCount++;
                        } else {
                          updatedCount++;
                        }
                      }
                    );
                  } catch (entryError) {
                    logger.error(`Error processing updated entry ${entry.id}: ${entryError.message}`);
                    updateErrorCount++;
                  }
                });
                
                updateStmt.finalize(err => {
                  if (err) {
                    logger.error(`Error finalizing update statement: ${err.message}`);
                  }
                  logger.info(`Updated ${updatedCount} entries, with ${updateErrorCount} errors`);
                  
                  // Always resolve after updates complete
                  resolve({ 
                    inserted: insertedCount, 
                    updated: updatedCount, 
                    unchanged: unchangedEntries.length 
                  });
                });
              } catch (error) {
                logger.error(`Error in update operation: ${error.message}`);
                reject(error);
              }
            } else if (newEntries.length === 0) {
              // If we had no changes at all, resolve immediately
              resolve({ inserted: 0, updated: 0, unchanged: unchangedEntries.length });
            }
            // Note: The case where newEntries.length > 0 and updatedEntries.length === 0 
            // is handled in the insertStmt.finalize callback above
          });
        }
      );
    });
  }

  /**
   * Truncate the tasks table
   * @returns {Promise<void>}
   */
  truncateTasks() {
    return new Promise((resolve, reject) => {
      logger.info('Truncating tasks table');
      this.db.run('DELETE FROM tasks', (err) => {
        if (err) {
          logger.error(`Error truncating tasks table: ${err.message}`);
          reject(err);
        } else {
          logger.info('Tasks table successfully truncated');
          resolve();
        }
      });
    });
  }

  /**
   * Truncate the tasks_kimai table
   * @returns {Promise<void>}
   */
  truncateKimaiTasks() {
    return new Promise((resolve, reject) => {
      logger.info('Truncating tasks_kimai table');
      this.db.run('DELETE FROM tasks_kimai', (err) => {
        if (err) {
          logger.error(`Error truncating tasks_kimai table: ${err.message}`);
          reject(err);
        } else {
          logger.info('Tasks_kimai table successfully truncated');
          resolve();
        }
      });
    });
  }

  /**
   * Store Harvest tasks
   * @param {Array} tasks - Array of tasks from Harvest
   * @returns {Promise<void>}
   */
  storeTasks(tasks) {
    return new Promise((resolve, reject) => {
      logger.info(`Starting to store ${tasks.length} tasks in database`);
      
      if (!tasks || tasks.length === 0) {
        logger.warn('No tasks to store, returning early');
        return resolve();
      }
      
      this.db.serialize(() => {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO tasks 
          (harvest_id, name, is_active, kimai_project_id, kimai_activity_id, kimai_activity_name, created_at, updated_at)
          VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)
        `);

        let insertedCount = 0;
        let errorCount = 0;

        try {
          tasks.forEach((task, index) => {
            try {
              if (!task.id) {
                logger.warn(`Task at index ${index} missing ID, skipping`);
                return;
              }
              
              logger.debug(`Inserting task: ${task.id} - ${task.name}`);
              
              stmt.run(
                task.id.toString(),
                task.name,
                task.is_active ? 1 : 0,
                task.created_at,
                task.updated_at,
                function(err) {
                  if (err) {
                    logger.error(`Error inserting task ${task.id}: ${err.message}`);
                    errorCount++;
                  } else {
                    insertedCount++;
                    logger.debug(`Successfully inserted task: ${task.id}`);
                  }
                }
              );
            } catch (taskError) {
              logger.error(`Error processing task at index ${index}: ${taskError.message}`);
              errorCount++;
            }
          });
          
          stmt.finalize(err => {
            if (err) {
              logger.error(`Error finalizing task statement: ${err.message}`);
              return reject(err);
            }
            
            logger.info(`Task storage complete: ${insertedCount} tasks inserted, ${errorCount} errors`);
            resolve();
          });
        } catch (error) {
          logger.error(`Error in task storage operation: ${error.message}`);
          reject(error);
        }
      });
    });
  }

  /**
   * Store Kimai activities
   * @param {Array} activities - Array of activities from Kimai
   * @returns {Promise<void>}
   */
  storeKimaiActivities(activities) {
    return new Promise((resolve, reject) => {
      logger.info(`Starting to store ${activities.length} activities in database`);
      
      if (!activities || activities.length === 0) {
        logger.warn('No activities to store, returning early');
        return resolve();
      }
      
      this.db.serialize(() => {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO tasks_kimai 
          (kimai_project_id, kimai_activity_id, task_name, parent_title, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);

        let insertedCount = 0;
        let errorCount = 0;

        try {
          activities.forEach((activity, index) => {
            try {
              if (!activity.id) {
                logger.warn(`Activity at index ${index} missing ID, skipping`);
                return;
              }
              
              // Concatenate parentTitle and name
              const taskName = activity.parentTitle ? `${activity.parentTitle}: ${activity.name}` : activity.name;
              
              logger.debug(`Inserting Kimai activity: ${activity.id} - ${taskName}`);
              
              stmt.run(
                activity.project?.toString() || null,
                activity.id.toString(),
                taskName,
                activity.parentTitle || '',
                new Date().toISOString(),
                function(err) {
                  if (err) {
                    logger.error(`Error inserting activity ${activity.id}: ${err.message}`);
                    errorCount++;
                  } else {
                    insertedCount++;
                    logger.debug(`Successfully inserted activity: ${activity.id}`);
                  }
                }
              );
            } catch (activityError) {
              logger.error(`Error processing activity at index ${index}: ${activityError.message}`);
              errorCount++;
            }
          });
          
          stmt.finalize(err => {
            if (err) {
              logger.error(`Error finalizing activity statement: ${err.message}`);
              return reject(err);
            }
            
            logger.info(`Activity storage complete: ${insertedCount} activities inserted, ${errorCount} errors`);
            resolve();
          });
        } catch (error) {
          logger.error(`Error in activity storage operation: ${error.message}`);
          reject(error);
        }
      });
    });
  }

  /**
   * Match Harvest tasks with Kimai activities
   * @returns {Promise<{matched: number, unmatched: number}>}
   */
  matchTasksWithActivities() {
    return new Promise((resolve, reject) => {
      logger.info('Starting to match Harvest tasks with Kimai activities');
      
      // First, get all Kimai activities
      this.db.all(
        `SELECT kimai_project_id, kimai_activity_id, task_name 
         FROM tasks_kimai`,
        [],
        (err, kimaiActivities) => {
          if (err) {
            logger.error(`Error fetching Kimai activities: ${err.message}`);
            return reject(err);
          }
          
          logger.info(`Found ${kimaiActivities.length} Kimai activities for matching`);
          
          if (kimaiActivities.length === 0) {
            logger.warn('No Kimai activities found, skipping matching');
            return resolve({ matched: 0, unmatched: 0 });
          }

          // Get all Harvest tasks
          this.db.all(
            `SELECT id, harvest_id, name FROM tasks`,
            [],
            (err, harvestTasks) => {
              if (err) {
                logger.error(`Error fetching Harvest tasks: ${err.message}`);
                return reject(err);
              }

              logger.info(`Found ${harvestTasks.length} Harvest tasks for matching`);
              
              if (harvestTasks.length === 0) {
                logger.warn('No Harvest tasks found, skipping matching');
                return resolve({ matched: 0, unmatched: 0 });
              }

              let matchedCount = 0;
              let unmatchedCount = harvestTasks.length;
              let updatePromises = [];
              
              // Loop through Kimai activities
              kimaiActivities.forEach(activity => {
                // Find matching Harvest tasks (exact name match)
                const matchingTask = harvestTasks.find(task => 
                  task.name.trim().toLowerCase() === activity.task_name.trim().toLowerCase()
                );
                
                if (matchingTask) {
                  // Update the Harvest task with Kimai activity info
                  updatePromises.push(
                    new Promise((resolveSingle, rejectSingle) => {
                      this.db.run(
                        `UPDATE tasks 
                         SET kimai_project_id = ?, 
                             kimai_activity_id = ?, 
                             kimai_activity_name = ?
                         WHERE id = ?`,
                        [
                          activity.kimai_project_id, 
                          activity.kimai_activity_id, 
                          activity.task_name,
                          matchingTask.id
                        ],
                        function(err) {
                          if (err) {
                            logger.error(`Error updating task ${matchingTask.id}: ${err.message}`);
                            rejectSingle(err);
                          } else {
                            logger.debug(`Matched and updated: Harvest task "${matchingTask.name}" with Kimai activity "${activity.task_name}"`);
                            matchedCount++;
                            unmatchedCount--;
                            resolveSingle();
                          }
                        }
                      );
                    })
                  );
                }
              });
              
              // Wait for all updates to complete
              Promise.all(updatePromises)
                .then(() => {
                  logger.info(`Task matching complete: ${matchedCount} matched, ${unmatchedCount} unmatched`);
                  resolve({ matched: matchedCount, unmatched: unmatchedCount });
                })
                .catch(error => {
                  logger.error(`Error in task matching: ${error.message}`);
                  reject(error);
                });
            }
          );
        }
      );
    });
  }

  /**
   * Get all stored tasks
   * @returns {Promise<Array>} Array of tasks
   */
  getTasks() {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM tasks`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get all stored Kimai activities
   * @returns {Promise<Array>} Array of activities
   */
  getKimaiActivities() {
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM tasks_kimai`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get pending entries that haven't been imported to Kimai
   * @param {String} from - Start date
   * @param {String} to - End date
   * @returns {Promise<Array>} Array of entries
   */
  getPendingEntries(from, to) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM time_entries 
        WHERE imported = 0
        AND date >= ? AND date <= ?
      `, [from, to], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
  
  /**
   * Get all pending entries that haven't been imported to Kimai
   * @returns {Promise<Array>} Array of entries with task mapping
   */
  getAllPendingEntries() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT te.*, t.kimai_project_id, t.kimai_activity_id 
        FROM time_entries te
        LEFT JOIN tasks t ON te.task = t.name
        WHERE te.imported = 0
      `, [], (err, rows) => {
        if (err) {
          logger.error(`Error fetching pending entries: ${err.message}`);
          reject(err);
        } else {
          logger.info(`Found ${rows.length} pending entries to import`);
          resolve(rows);
        }
      });
    });
  }

  /**
   * Mark an entry as imported
   * @param {String} harvestId - Harvest entry ID
   * @param {String} kimaiId - Kimai entry ID
   * @returns {Promise<void>}
   */
  markAsImported(harvestId, kimaiId) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE time_entries
        SET imported = 1, kimai_id = ?
        WHERE harvest_id = ?
      `, [kimaiId, harvestId], function(err) {
        if (err) {
          reject(err);
        } else {
          logger.debug(`Marked entry ${harvestId} as imported to Kimai with ID ${kimaiId}`);
          resolve();
        }
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close(err => {
      if (err) {
        logger.error(`Error closing database: ${err.message}`);
      } else {
        logger.info('Database connection closed');
      }
    });
  }
}

module.exports = Storage;

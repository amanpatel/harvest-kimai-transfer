#!/usr/bin/env node

const yargs = require('yargs');
const HarvestExtractor = require('../src/harvest/extract');
const DateUtils = require('../src/utils/date');
const logger = require('../src/utils/logger');

// Configure command line interface
const argv = yargs
  .option('from', {
    describe: 'Start date (YYYY-MM-DD)',
    type: 'string'
  })
  .option('to', {
    describe: 'End date (YYYY-MM-DD)',
    type: 'string'
  })
  .option('current-month', {
    describe: 'Extract entries for current month',
    type: 'boolean'
  })
  .option('yesterday', {
    describe: 'Extract entries for yesterday',
    type: 'boolean'
  })
  .option('tasks', {
    describe: 'Extract all tasks from Harvest',
    type: 'boolean'
  })
  .check((argv) => {
    // If tasks option is specified, no date validation needed
    if (argv.tasks) {
      return true;
    }
    
    if (argv.from && !DateUtils.isValidDate(argv.from)) {
      throw new Error('From date must be in YYYY-MM-DD format');
    }
    if (argv.to && !DateUtils.isValidDate(argv.to)) {
      throw new Error('To date must be in YYYY-MM-DD format');
    }
    
    // Must specify a date range option or tasks
    if (!argv.from && !argv.to && !argv['current-month'] && !argv.yesterday && !argv.tasks) {
      throw new Error('You must specify a date range using --from/--to, --current-month, --yesterday, or use --tasks');
    }
    
    return true;
  })
  .help()
  .argv;

async function main() {
  let extractor = null;
  
  try {
    extractor = new HarvestExtractor();
    
    // Check if we need to extract tasks
    if (argv.tasks) {
      logger.info("Extracting all tasks from Harvest and matching with Kimai activities...");
      const result = await extractor.extractTasks();
      logger.info(`Task extraction complete: ${result.harvestTasks} Harvest tasks, ${result.kimaiActivities} Kimai activities, ${result.matched} tasks matched`);
      return;
    }
    
    let from, to;
    
    // Determine date range
    if (argv['current-month']) {
      const range = DateUtils.getCurrentMonth();
      from = range.from;
      to = range.to;
    } else if (argv.yesterday) {
      const range = DateUtils.getYesterday();
      from = range.from;
      to = range.to;
    } else {
      from = argv.from;
      to = argv.to || from; // If only from is provided, use it for to as well
    }
    
    // Extract time entries
    const entriesCount = await extractor.extractTimeEntries(from, to);
    
    logger.info(`Extracted ${entriesCount} time entries from Harvest`);
  } catch (error) {
    logger.error(`Error in harvest-extract: ${error.message}`);
    process.exit(1);
  } finally {
    // Ensure we properly close the database connection
    if (extractor && extractor.storage) {
      logger.info('Closing database connection...');
      extractor.storage.close();
    }
    process.exit(0);
  }
}

main();

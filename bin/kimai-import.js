#!/usr/bin/env node

const yargs = require('yargs');
const KimaiImporter = require('../src/kimai/import');
const logger = require('../src/utils/logger');

// Configure command line interface with minimal options
const argv = yargs
  .usage('Usage: $0 [options]')
  .option('verbose', {
    alias: 'v',
    describe: 'Run with verbose logging',
    type: 'boolean'
  })
  .help()
  .argv;

async function main() {
  try {
    // Set verbose logging if requested
    if (argv.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }
    
    const importer = new KimaiImporter();
    
    // Import all pending time entries
    const importedCount = await importer.importTimeEntries();
    
    logger.info(`Imported ${importedCount} time entries to Kimai`);
    process.exit(0);
  } catch (error) {
    logger.error(`Error in kimai-import: ${error.message}`);
    process.exit(1);
  }
}

main();

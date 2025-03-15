# Harvest to Kimai Time Entry Transfer

A command line utility to extract time entries from Harvest and transfer them to Kimai.

## Overview

This project consists of two main components:
1. **Harvest Extractor**: Fetches time entries from Harvest API and stores them locally
2. **Kimai Importer**: Uploads stored time entries to Kimai via its API

## Installation

```bash
# Clone the repository
git clone https://github.com/apatel/harvest-kimai-transfer.git
cd harvest-kimai-transfer

# Install dependencies
yarn
```

## Configuration

Create a `.env` file in the project root with the following environment variables:

```
# Harvest API credentials
HARVEST_ACCESS_TOKEN=your_harvest_access_token

# Kimai API credentials
KIMAI_URL=https://your-kimai-instance.com
KIMAI_API_USERNAME=your_kimai_username
KIMAI_API_TOKEN=your_kimai_api_token
```

## Usage

### Extracting Time Entries from Harvest

```bash
yarn run harvest-extract  --tasks

yarn run harvest-extract  --current-month
yarn run harvest-extract  --from=2025-02-01 --to=2025-03-01
yarn run harvest-extract  --from=2025-03-01 --to=2025-04-01

# Extract entries for the current month
node harvest-extract.js --current-month

# Extract entries for yesterday
node harvest-extract.js --yesterday
```

### Uploading Time Entries to Kimai

```bash
# Upload all pending entries
node kimai-import.js --all

# Upload entries for a specific date range
node kimai-import.js --from 2023-01-01 --to 2023-01-31
```

## Project Structure

```
harvest-kimai/
├── src/
│   ├── harvest/
│   │   ├── api.js        # Harvest API client
│   │   └── extract.js    # Time entry extraction logic
│   ├── kimai/
│   │   ├── api.js        # Kimai API client
│   │   └── import.js     # Time entry import logic
│   ├── db/
│   │   └── storage.js    # Data storage implementation
│   └── utils/
│       ├── date.js       # Date handling utilities
│       └── config.js     # Configuration loading
├── bin/
│   ├── harvest-extract.js # CLI for Harvest extraction
│   └── kimai-import.js    # CLI for Kimai import
├── .env                   # Environment configuration
└── package.json
```

## Development Plan

### Phase 1: Project Setup
- [x] Initialize npm project and repository
- [ ] Set up basic project structure
- [ ] Configure environment variables
- [ ] Set up error handling and logging

### Phase 2: Harvest Integration
- [ ] Develop Harvest API client
- [ ] Implement time entry fetching
- [ ] Add date range filtering
- [ ] Format Harvest data for storage

### Phase 3: Local Storage
- [ ] Implement SQLite database schema
- [ ] Create data access layer
- [ ] Add functions to store Harvest entries
- [ ] Add query functions to retrieve stored entries

### Phase 4: Kimai Integration
- [ ] Develop Kimai API client
- [ ] Map Harvest data format to Kimai format
- [ ] Implement entry upload functionality
- [ ] Add validation and error handling

### Phase 5: Command Line Interface
- [ ] Create CLI for Harvest extraction
- [ ] Create CLI for Kimai import
- [ ] Add command line arguments and help text
- [ ] Implement progress reporting

### Phase 6: Testing and Documentation
- [ ] Write tests for core functionality
- [ ] Complete documentation
- [ ] Create sample usage scripts

## Dependencies

This project relies on the following npm packages:
- `axios` - For API requests
- `yargs` - For command line argument parsing
- `dotenv` - For environment variable management
- `sqlite3` - For local data storage
- `winston` - For logging

## License

MIT

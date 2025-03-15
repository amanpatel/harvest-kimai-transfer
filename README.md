# Harvest to Kimai Time Entry Transfer

A command line utility to extract time entries from Harvest and transfer them to Kimai. This also allows you to import tasks from Harvest and map them to the activities and projects in Kimai. This only works for me at present, but can be modified to work for you.

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


## License

MIT

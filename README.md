# OpenSauce Agenda Scraper

This project uses Playwright to scrape the OpenSauce 2025 conference agenda from https://opensauce.com/agenda/

## Overview

The scraper navigates to the OpenSauce agenda page and extracts schedule information for all three days of the conference (Friday July 18, Saturday July 19, and Sunday July 20, 2025).

## Files

- `opensauce-agenda-final.json` - The final cleaned schedule data
- `scrape-opensauce-final.js` - The main scraping script
- `clean-opensauce-data.js` - Script to clean and format the raw scraped data

## Data Structure

The JSON file contains:
- **metadata**: Event name, dates, and scrape timestamp
- **schedule**: Organized by day (friday, saturday, sunday) with events containing:
  - time
  - duration
  - title
  - location (when available)
  - speakers (when available)
  - description (when available)

## Usage

1. Install dependencies:
```bash
npm install
```

2. Run the scraper:
```bash
node scrape-opensauce-final.js
```

3. Clean the data:
```bash
node clean-opensauce-data.js
```

## Results

Successfully scraped 23 events across all three days:
- Friday: 4 events (Industry Day)
- Saturday: 9 events (Day 1)
- Sunday: 10 events (Day 2)

The data includes panels, talks, workshops, and social events featuring various content creators and tech personalities.

## Live Demo

Visit the mobile-friendly schedule at: https://[your-username].github.io/[your-repo-name]/

## GitHub Pages Deployment

1. Push this repository to GitHub
2. Go to Settings → Pages
3. Set Source to "GitHub Actions"
4. The site will automatically deploy when you push to main/master branch

## Local Development

To run the webpage locally:
```bash
node serve.js
```
Then visit http://localhost:8080
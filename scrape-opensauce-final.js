const { chromium } = require('playwright');
const fs = require('fs').promises;

async function scrapeOpenSauceAgenda() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigating to OpenSauce agenda...');
  await page.goto('https://opensauce.com/agenda/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const scheduleData = {
    friday: [],
    saturday: [],
    sunday: []
  };
  
  // Helper function to extract schedule from current page
  async function extractCurrentSchedule() {
    return await page.evaluate(() => {
      const events = [];
      
      // First, let's find all the event containers
      // Based on the screenshot, events seem to be in a grid/list format
      const possibleContainers = document.querySelectorAll(
        '.event, .schedule-item, .agenda-item, ' +
        '[class*="event"], [class*="schedule"], [class*="session"], ' +
        'article, .card, [class*="card"]'
      );
      
      // Also try to find events by looking for time patterns
      const allElements = document.querySelectorAll('*');
      const timeRegex = /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i;
      
      const processedTexts = new Set();
      
      allElements.forEach(element => {
        // Skip if element has many children (likely a container)
        if (element.children.length > 5) return;
        
        const text = element.textContent.trim();
        
        // Skip if we've already processed this text
        if (processedTexts.has(text)) return;
        processedTexts.add(text);
        
        // Check if this element contains a time
        if (timeRegex.test(text)) {
          const event = {};
          
          // Extract time
          const timeMatch = text.match(timeRegex);
          if (timeMatch) {
            event.time = timeMatch[0];
          }
          
          // Look for duration (e.g., "(30 mins)")
          const durationMatch = text.match(/\((\d+)\s*mins?\)/i);
          if (durationMatch) {
            event.duration = durationMatch[0];
          }
          
          // Try to find the title - usually the largest text near the time
          let titleElement = element;
          let attempts = 0;
          while (titleElement && attempts < 5) {
            const nextSibling = titleElement.nextElementSibling;
            const parent = titleElement.parentElement;
            
            // Check siblings
            if (nextSibling) {
              const siblingText = nextSibling.textContent.trim();
              if (siblingText.length > 10 && siblingText.length < 200 && 
                  !timeRegex.test(siblingText) && 
                  !siblingText.match(/^\(.*\)$/)) {
                event.title = siblingText;
                break;
              }
            }
            
            // Check parent's other children
            if (parent) {
              const siblings = Array.from(parent.children);
              for (const sibling of siblings) {
                const sibText = sibling.textContent.trim();
                if (sibText !== text && sibText.length > 10 && sibText.length < 200 &&
                    !timeRegex.test(sibText) && 
                    !sibText.match(/^\(.*\)$/)) {
                  event.title = sibText;
                  break;
                }
              }
            }
            
            titleElement = parent;
            attempts++;
          }
          
          // Look for location/stage info
          const stageMatch = text.match(/\b(MAIN\s*STAGE|SECOND\s*STAGE|WORKSHOP|STAGE)\b/i);
          if (stageMatch) {
            event.location = stageMatch[0];
          }
          
          // Look for speakers (usually after the title)
          if (event.title) {
            const parentText = element.parentElement ? element.parentElement.textContent : '';
            // Remove time, title, and stage from parent text
            let speakerText = parentText.replace(event.time, '').replace(event.title, '');
            if (event.location) speakerText = speakerText.replace(event.location, '');
            
            // Split by newlines and filter
            const potentialSpeakers = speakerText.split(/\n/).map(s => s.trim()).filter(s => 
              s.length > 2 && 
              s.length < 50 && 
              !s.match(/^\(.*\)$/) &&
              !s.match(/\d{1,2}:\d{2}/) &&
              !s.match(/^(FRIDAY|SATURDAY|SUNDAY|DAY \d|OPEN SAUCE)/i)
            );
            
            if (potentialSpeakers.length > 0) {
              event.speakers = potentialSpeakers;
            }
          }
          
          // Only add if we have at least time and title
          if (event.time && event.title) {
            events.push(event);
          }
        }
      });
      
      // Deduplicate events
      const uniqueEvents = [];
      const seenTitles = new Set();
      
      events.forEach(event => {
        if (!seenTitles.has(event.title)) {
          seenTitles.add(event.title);
          uniqueEvents.push(event);
        }
      });
      
      return uniqueEvents;
    });
  }
  
  // Function to click on day tabs
  async function selectDayTab(day) {
    const dayUpper = day.toUpperCase();
    
    // Try multiple strategies to find and click the day tab
    const strategies = [
      // Strategy 1: Click on text directly
      async () => {
        const elements = await page.locator(`text="${dayUpper}"`).all();
        for (const el of elements) {
          const box = await el.boundingBox();
          if (box && box.width < 200) { // Likely a tab, not a heading
            await el.click();
            return true;
          }
        }
        return false;
      },
      // Strategy 2: Click on parent of text
      async () => {
        const element = await page.locator(`text="${dayUpper}"`).first();
        if (await element.isVisible()) {
          const parent = await element.locator('..').first();
          await parent.click();
          return true;
        }
        return false;
      },
      // Strategy 3: Look for clickable elements containing the day
      async () => {
        const clickables = await page.locator(`button:has-text("${dayUpper}"), a:has-text("${dayUpper}")`).all();
        if (clickables.length > 0) {
          await clickables[0].click();
          return true;
        }
        return false;
      }
    ];
    
    for (const strategy of strategies) {
      try {
        console.log(`Trying to click ${day} tab...`);
        if (await strategy()) {
          await page.waitForTimeout(2000); // Wait for content to load
          console.log(`Successfully clicked ${day} tab`);
          return true;
        }
      } catch (e) {
        // Continue to next strategy
      }
    }
    
    return false;
  }
  
  try {
    // Extract schedule for each day
    const days = ['Friday', 'Saturday', 'Sunday'];
    
    for (const day of days) {
      console.log(`\nExtracting ${day} schedule...`);
      
      if (await selectDayTab(day)) {
        const events = await extractCurrentSchedule();
        scheduleData[day.toLowerCase()] = events;
        console.log(`Found ${events.length} events for ${day}`);
        
        // Take a screenshot for each day
        await page.screenshot({ 
          path: `opensauce-${day.toLowerCase()}.png`, 
          fullPage: true 
        });
      } else {
        console.log(`Could not navigate to ${day} tab`);
      }
    }
    
    // If we couldn't get any events, try one more time with the visible content
    const totalEvents = scheduleData.friday.length + scheduleData.saturday.length + scheduleData.sunday.length;
    if (totalEvents === 0) {
      console.log('\nNo events found via tabs. Extracting all visible events...');
      const visibleEvents = await extractCurrentSchedule();
      
      // Check which day is currently shown
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('SUNDAY')) {
        scheduleData.sunday = visibleEvents;
      } else if (pageText.includes('SATURDAY')) {
        scheduleData.saturday = visibleEvents;
      } else if (pageText.includes('FRIDAY')) {
        scheduleData.friday = visibleEvents;
      }
      
      console.log(`Found ${visibleEvents.length} events in visible content`);
    }
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    // Keep browser open for 5 seconds to review
    await page.waitForTimeout(5000);
    await browser.close();
  }
  
  return scheduleData;
}

// Main execution
(async () => {
  console.log('OpenSauce Agenda Scraper\n' + '='.repeat(50));
  
  const data = await scrapeOpenSauceAgenda();
  
  // Clean up the data
  const cleanedData = {
    metadata: {
      event: "Open Sauce 2025",
      dates: {
        friday: "July 18, 2025",
        saturday: "July 19, 2025",
        sunday: "July 20, 2025"
      },
      scraped_at: new Date().toISOString()
    },
    schedule: data
  };
  
  // Save to JSON file
  await fs.writeFile('opensauce-agenda.json', JSON.stringify(cleanedData, null, 2));
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('Scraping complete! Data saved to opensauce-agenda.json');
  console.log('\nSummary:');
  console.log(`- Friday: ${data.friday.length} events`);
  console.log(`- Saturday: ${data.saturday.length} events`);
  console.log(`- Sunday: ${data.sunday.length} events`);
  console.log(`- Total: ${data.friday.length + data.saturday.length + data.sunday.length} events`);
  
  // Show sample events
  if (data.friday.length > 0) {
    console.log('\nSample Friday event:');
    console.log(JSON.stringify(data.friday[0], null, 2));
  }
  if (data.saturday.length > 0) {
    console.log('\nSample Saturday event:');
    console.log(JSON.stringify(data.saturday[0], null, 2));
  }
  if (data.sunday.length > 0) {
    console.log('\nSample Sunday event:');
    console.log(JSON.stringify(data.sunday[0], null, 2));
  }
})();
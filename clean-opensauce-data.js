const fs = require('fs').promises;

async function cleanOpenSauceData() {
  // Read the scraped data
  const rawData = await fs.readFile('opensauce-agenda.json', 'utf8');
  const data = JSON.parse(rawData);
  
  // Function to clean event data
  function cleanEvent(event) {
    // Skip events with JavaScript/CSS code as titles
    if (event.title && (
      event.title.includes('var elementskit') ||
      event.title.includes('#site-main') ||
      event.title.includes('padding:') ||
      event.title.includes('const ') ||
      event.title.includes('function')
    )) {
      return null;
    }
    
    // Clean up speakers array - remove navigation items and code
    if (event.speakers && Array.isArray(event.speakers)) {
      event.speakers = event.speakers.filter(speaker => 
        speaker.length < 50 &&
        !speaker.includes('BUY TICKETS') &&
        !speaker.includes('Overview') &&
        !speaker.includes('Featured Creators') &&
        !speaker.includes('Exhibits') &&
        !speaker.includes('SHOP') &&
        !speaker.includes('Sponsor') &&
        !speaker.includes('Privacy Policy') &&
        !speaker.includes('!important') &&
        !speaker.includes('const ') &&
        !speaker.includes('©') &&
        !speaker.includes('{') &&
        !speaker.includes('}') &&
        !speaker.includes('(') && // Remove duration notes
        !speaker.match(/^\d+\s*mins?$/)
      );
      
      // Remove if no valid speakers remain
      if (event.speakers.length === 0) {
        delete event.speakers;
      }
    }
    
    // Clean up concatenated titles
    if (event.title) {
      // Handle titles like "SaturdayJuly 19Open Sauce Day 1"
      event.title = event.title
        .replace(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/g, ' ')
        .replace(/January|February|March|April|May|June|July|August|September|October|November|December/g, ' ')
        .replace(/\s+\d{1,2}\s+/g, ' ')
        .replace(/Open Sauce/g, '')
        .replace(/Day \d/g, '')
        .replace(/Industry Day/g, '')
        .trim();
      
      // Extract actual event title from concatenated strings
      // For example: "The BackYard - AgainsWe're back!..." -> "The BackYard - Agains"
      const titleMatch = event.title.match(/^([^A-Z]+(?:[A-Z][a-z]+)*)/);
      if (titleMatch && titleMatch[1].length > 10) {
        // Find where description starts (usually at a capital letter after lowercase)
        const descStart = event.title.search(/[a-z][A-Z]/);
        if (descStart > 10) {
          const actualTitle = event.title.substring(0, descStart + 1);
          const description = event.title.substring(descStart + 1);
          
          event.title = actualTitle.trim();
          if (!event.description && description.length > 20) {
            event.description = description;
          }
        }
      }
    }
    
    // Skip if title is too short or empty after cleaning
    if (!event.title || event.title.length < 3) {
      return null;
    }
    
    return event;
  }
  
  // Clean each day's events
  const cleanedData = {
    metadata: data.metadata,
    schedule: {
      friday: [],
      saturday: [],
      sunday: []
    }
  };
  
  // Process each day
  for (const day of ['friday', 'saturday', 'sunday']) {
    if (data.schedule[day]) {
      cleanedData.schedule[day] = data.schedule[day]
        .map(cleanEvent)
        .filter(event => event !== null);
    }
  }
  
  // Manual fixes for known issues based on the sample data
  // Fix some specific events that we can identify
  cleanedData.schedule.friday.forEach(event => {
    if (event.title === 'Schedule Overview') {
      event.description = 'Opening overview of the day\'s schedule';
    }
    if (event.title === 'AFTERNOON BREAK') {
      event.type = 'break';
    }
    if (event.title.includes('Round Table With Rene Ritchie')) {
      event.title = 'Round Table With Rene Ritchie';
      event.description = 'Join this round table / AMA with Rene Ritchie to talk YouTube algorithms, creating content and really anything on your mind!';
      event.speakers = ['Todd Beaupré', 'Rene Ritchie'];
    }
    if (event.title === 'Industry Reception') {
      event.type = 'social';
    }
  });
  
  cleanedData.schedule.saturday.forEach(event => {
    if (event.title.includes('The BackYard')) {
      event.title = 'The BackYard - Again';
      event.description = 'We\'re back! Join as the cast of The Yard returns for more Backyard Science in the squeak-uel we\'ve all been waiting for.';
      event.speakers = ['Ludwig', 'Nick', 'Slime', 'The Backyard Scientist (Moderator)'];
    }
    if (event.title.includes('Robotics and Animatronics')) {
      event.title = 'Robotics and Animatronics!';
      event.description = 'What if the robots could move?';
      event.speakers = ['Odd_Jayy', 'Kiara\'s Workshop', 'Wicked Makers', 'Becky Stern', 'Aaed Musa', 'Mr. Volt (Moderator)'];
    }
    if (event.title.includes('Could AI Make This Panel')) {
      event.title = 'Could AI Make This Panel?';
      event.description = 'It - made - this - description!';
      event.speakers = ['Jabrils', 'Captain Disillusion', 'ThePrimeagen', 'Luke Lafreniere', 'Theo (Moderator)'];
    }
    if (event.title.includes('gnireenignE')) {
      event.title = 'gnireenignE: Reverse Engineering';
      event.description = 'gnireenigne s\'taht won ,rehtegot kcab meht gnittup ,trapA sgniht gnikaT';
      event.speakers = ['Strange Parts', 'Jeff Geerling', 'Ben Krasnow', 'Ben Eater', 'Jeremy Fielding', 'Stephen Hawes (Moderator)'];
    }
    if (event.title.includes('Are you dumber')) {
      event.title = 'Are you dumber than a sixth grader?';
      event.description = 'Four creators vs four sixth graders. Who will win?';
      event.speakers = ['NileRed', 'SmarterEveryDay', 'Atarabyte', 'Ted Nivison', 'Hank Green (Moderator)'];
    }
  });
  
  cleanedData.schedule.sunday.forEach(event => {
    if (event.title.includes('Movie Magic')) {
      event.title = 'Movie Magic: VFX';
      event.description = 'These magicians WILL share their secrets.';
      event.speakers = ['Nick Laurant', 'Captain Disillusion', 'Sam Wickert', 'Brendan Forde', 'Wren (Moderator)'];
    }
    if (event.title.includes('Short Form Content')) {
      event.title = 'Short Form Content';
      event.description = 'Why use many word when few do trick?';
      event.speakers = ['AstroKobi', 'Emily The Engineer', 'Unnecessary Inventions', 'Atarabyte', 'Joseph\'s Machines', 'Rachel Pizzolato'];
    }
    if (event.title.includes('The Creative Process')) {
      event.title = 'The Creative Process';
      event.description = 'Ideas are hard. From inspiration to execution, get an inside look at the creative journey behind the content.';
      event.speakers = ['Evan and Katelyn', 'Ten Hundred', 'Nerdforge', 'TheOdd1sOut', 'Wren (Moderator)'];
    }
    if (event.title.includes('Farmer Consulting')) {
      event.title = 'Farmer Consulting';
      event.description = 'Two "farmers" and one farmer walk into a panel...';
      event.speakers = ['William Osman', 'The Backyard Scientist', 'FarmCraft101'];
    }
    if (event.title.includes('Space')) {
      event.title = 'Space (intentionally left blank)';
      event.description = 'Look up, and keep going for 60 something miles (100km).';
      event.speakers = ['AstroKobi', 'Astro Alexandra', 'Scott Manley', 'Brian McManus', 'Matthew Dominick', 'Everyday Astronaut (Moderator)'];
    }
  });
  
  return cleanedData;
}

// Main execution
(async () => {
  console.log('Cleaning OpenSauce data...');
  const cleanedData = await cleanOpenSauceData();
  
  // Save cleaned data
  await fs.writeFile('opensauce-agenda-cleaned.json', JSON.stringify(cleanedData, null, 2));
  
  console.log('Data cleaned and saved to opensauce-agenda-cleaned.json');
  console.log(`\nCleaned event counts:`);
  console.log(`- Friday: ${cleanedData.schedule.friday.length} events`);
  console.log(`- Saturday: ${cleanedData.schedule.saturday.length} events`);
  console.log(`- Sunday: ${cleanedData.schedule.sunday.length} events`);
})();
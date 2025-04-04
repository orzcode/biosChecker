/**
 * Generates a placehold.co image URL displaying motherboard updates,
 * new boards, and user activity based on input data.
 *
 * @param {object} data The input data object. Expected structure:
 * {
 * userMobos?: { [boardName: string]: { signups?: number } },
 * weeklyUpdates?: {
 * [boardName: string]: { heldversion?: string, notified?: number },
 * newBoards?: { [boardName: string]: any }
 * }
 * }
 * @returns {string} The generated placehold.co URL.
 */
export async function generatePlaceholdUrl(data) {
	// --- Configuration ---
	const width = 1036;
	const height = 740;
	const bgColor = 'efe7db';
	const textColor = '000000'; // Black
	const format = 'png';
	const font = 'open+sans'; // Google Font name, use '+' for spaces
  
	// --- Data Processing ---
	let updateList = [];
	let newBoardList = [];
	let totalNotified = 0;
	let totalSignups = 0;
	let outputTextLines = [];
  
	// Process Updates and calculate totalNotified
	const weeklyUpdates = data?.weeklyUpdates;
	if (weeklyUpdates) {
	  for (const [key, value] of Object.entries(weeklyUpdates)) {
		// Skip the nested 'newBoards' object if it exists
		if (key === 'newBoards') {
		  continue;
		}
		// Check if it's a valid update entry with a version
		if (typeof value === 'object' && value !== null && value.hasOwnProperty('heldversion')) {
		  updateList.push(` - ${key} ${value.heldversion}`);
		  totalNotified += Number(value.notified) || 0; // Add notified count, default 0
		}
	  }
	}
  
	// Process New Boards (check if nested under weeklyUpdates)
	const newBoards = weeklyUpdates?.newBoards;
	if (typeof newBoards === 'object' && newBoards !== null) {
	  for (const key of Object.keys(newBoards)) {
		newBoardList.push(` - ${key}`);
	  }
	}
  
	// Process User Mobos for totalSignups
	const userMobos = data?.userMobos;
	if (userMobos) {
	  for (const moboData of Object.values(userMobos)) {
		if (typeof moboData === 'object' && moboData !== null && moboData.hasOwnProperty('signups')) {
		   totalSignups += Number(moboData.signups) || 0; // Add signups count, default 0
		}
	  }
	}
  
	// --- Assemble Output Text ---
	let addedSection = false; // To manage blank line separators
  
	// Add Updates section if present
	if (updateList.length > 0) {
	  outputTextLines.push(`Updates this week: ${updateList.length}`);
	  outputTextLines.push(...updateList);
	  addedSection = true;
	}
  
	// Add New Boards section if present
	if (newBoardList.length > 0) {
	  if (addedSection) {
		outputTextLines.push(''); // Add blank line before if updates were present
	  }
	  outputTextLines.push('New boards this week:');
	  outputTextLines.push(...newBoardList);
	  addedSection = true;
	}
  
	// Always add User Activity section
	if (addedSection) {
	  outputTextLines.push(''); // Add blank line before if updates/new boards were present
	}
	outputTextLines.push('User activity this week:');
	outputTextLines.push(`Users notified: ${totalNotified}`);
	outputTextLines.push(`New signups: ${totalSignups}`);
  
	// --- Encode Text for URL ---
	const rawText = outputTextLines.join('\n');
  
	// Manual encoding for placehold.co (space -> +, newline -> %0A, and escape other URL-problematic chars)
	const encodedText = rawText
	  .replace(/%/g, '%25')  // 1. Escape existing percent signs FIRST
	  .replace(/\n/g, '%0A') // 2. Newlines
	  .replace(/ /g, '+')    // 3. Spaces
	  .replace(/#/g, '%23')  // 4. Hash symbols
	  .replace(/&/g, '%26')  // 5. Ampersands
	  .replace(/\?/g, '%3F'); // 6. Question marks
	  // Add more specific replacements here if other special characters cause issues
  
	// --- Construct Final URL ---
	// Format: https://placehold.co/{Width}x{Height}/{BGColor}/{TextColor}.{Format}?font={Font}&text={Text}
	const url = `https://placehold.co/${width}x${height}/${bgColor}/${textColor}.${format}?font=${font}&text=${encodedText}`;
  
	return url;
  }
  
  // --- Example Usage ---
  
  // Example Data 1: All sections populated
  const exampleDataFull = {
	"snapshotDate": "2025/3/24",
	"userMobos": {
	  "X870E Taichi Lite": { "socket": "AM5", "maker": "AMD", "count": 1, "signups": 0 },
	  "Z790 PG Lightning": { "socket": "1700", "maker": "Intel", "count": 3, "signups": 1 },
	  "B650 Aorus Pro": { "socket": "AM5", "maker": "AMD", "count": 5, "signups": 2 }
	},
	"weeklyUpdates": {
	  "X870E Taichi Lite": { "helddate": "2025/3/24", "heldversion": "1.0.0", "notified": 1 },
	  "Z790 PG Lightning": { "helddate": "2025/3/23", "heldversion": "F10a", "notified": 3 },
	  "newBoards": {
		 "X990 New Mobo": { "socket": "AM5", "maker": "AMD", "release": "2024/12/3" },
		 "Z890 Dark Hero": { "socket": "18XX", "maker": "Intel", "release": "2025/01/15" }
	  }
	}
  };
  
  // Example Data 2: No new boards this week
  const exampleDataNoNew = {
	"snapshotDate": "2025/3/24",
	"userMobos": {
	  "X870E Taichi Lite": { "socket": "AM5", "maker": "AMD", "count": 1, "signups": 0 }
	},
	"weeklyUpdates": {
	  "X870E Taichi Lite": { "helddate": "2025/3/24", "heldversion": "1.0.0", "notified": 1 }
	  // 'newBoards' key is missing
	}
  };
  
  // Example Data 3: No updates or new boards, only user activity
  const exampleDataOnlyActivity = {
	 "snapshotDate": "2025/3/24",
	 "userMobos": {
	  "Z790 PG Lightning": { "socket": "1700", "maker": "Intel", "count": 3, "signups": 1 }
	},
	 "weeklyUpdates": {
		// Empty or missing weeklyUpdates implies no updates/new boards
	 }
  };
  
  // Example Data 4: Empty data object
  const exampleDataEmpty = {};
  
  // Generate URLs
  const urlFull = generatePlaceholdUrl(exampleDataFull);
  const urlNoNew = generatePlaceholdUrl(exampleDataNoNew);
  const urlOnlyActivity = generatePlaceholdUrl(exampleDataOnlyActivity);
  const urlEmpty = generatePlaceholdUrl(exampleDataEmpty);
  
  // Log the results (you would use these URLs in your application)
  console.log("--- Full Data Example URL ---");
  console.log(urlFull);
  console.log("\n--- No New Boards Example URL ---");
  console.log(urlNoNew);
  console.log("\n--- Only Activity Example URL ---");
  console.log(urlOnlyActivity);
  console.log("\n--- Empty Data Example URL ---");
  console.log(urlEmpty);
  
  /*
  // You can test the generated URLs by pasting them into your browser.
  // Example output text for 'urlFull' before encoding:
  Updates this week: 2
   - X870E Taichi Lite 1.0.0
   - Z790 PG Lightning F10a
  
  New boards this week:
   - X990 New Mobo
   - Z890 Dark Hero
  
  User activity this week:
  Users notified: 4
  New signups: 3
  */
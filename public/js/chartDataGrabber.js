import sql from "./db.js";
import { today, getSevenDaysAgoStartOfDay, parseYYYYMD } from "./dater.js";

// Current output:
// {
// 	'snapshotDate': '2025/3/24',
// 	'userMobos': {
//  'X870E Taichi Lite': { socket: 'AM5', maker: 'AMD', count: 1, signups: 0 }},
//  'Z790 PG Lightning': { socket: '1700', maker: 'Intel', count: 3, signups: 1 }},
// 	// ... more items
// 	}
// 	'weeklyUpdates': {
//  'X870E Taichi Lite': { helddate: '2025/3/24', heldversion: '1.0.0', notified: 1 },
//   }

export async function getChartData() {
  // Calculate the threshold DATE OBJECT once
  const sevenDaysAgoThreshold = getSevenDaysAgoStartOfDay();

  // Helper function for comparison using the threshold
  const isDateStringRecent = (dateString) => {
    const dateObj = parseYYYYMD(dateString); // Parse the string from DB
    // Compare timestamps (works because threshold is start of day)
    return (
      dateObj instanceof Date &&
      dateObj.getTime() >= sevenDaysAgoThreshold.getTime()
    );
  };

  try {
    const combinedResults = await sql`
            SELECT 
                u.mobo, u.signupdate, u.lastcontacted, u.givendate,
                m.socket, m.maker, m.helddate, m.heldversion
            FROM users u LEFT JOIN models m ON u.mobo = m.model
            WHERE u.mobo != 'dummy'
            UNION ALL
            SELECT
                m.model AS mobo, NULL, NULL, NULL,
                m.socket, m.maker, m.helddate, m.heldversion
            FROM models m
            WHERE m.model != 'dummy' AND m.helddate IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.mobo = m.model);
        `;

    // --- Process & combine results ---
    const userMobos = {};
    const weeklyUpdates = {};
    const modelsSeenForUpdates = new Set();

    for (const row of combinedResults.rows || combinedResults) {
      const moboName = row.mobo;
      const isUserRow = row.signupdate !== null;

      // --- Determine Recency in JavaScript ---
      const isRecentSignup = isUserRow && isDateStringRecent(row.signupdate);
      const isRecentHeldDate = row.helddate && isDateStringRecent(row.helddate);
      const isRecentLastContact =
        isUserRow && isDateStringRecent(row.lastcontacted);
      const isRecentGivenDate = isUserRow && isDateStringRecent(row.givendate);
      // ---

      // Initialize userMobos entry only if it's a user-owned motherboard
      if (isUserRow && !userMobos[moboName] && row.socket && row.maker) {
        userMobos[moboName] = {
          socket: row.socket,
          maker: row.maker,
          count: 0,
          signups: 0,
        };
      }

      // Increment total count and signups if it's a user row associated with a known mobo
      if (userMobos[moboName] && isUserRow) {
        userMobos[moboName].count += 1;
        if (isRecentSignup) {
          userMobos[moboName].signups += 1;
        }
      }

      // Prepare Updates data - Check recency of helddate *here*
      if (isRecentHeldDate && row.heldversion) {
        // Initialize updates entry if needed for this model
        if (!modelsSeenForUpdates.has(moboName)) {
          weeklyUpdates[moboName] = {
            helddate: row.helddate, // Store the original string
            heldversion: row.heldversion,
            notified: 0,
          };
          modelsSeenForUpdates.add(moboName);
        }

        // If it's a user row AND the model's helddate is recent, check contact dates
        if (
          isUserRow &&
          weeklyUpdates[moboName] &&
          row.lastcontacted && // Check if dates exist before parsing
          row.givendate &&
          isRecentLastContact &&
          isRecentGivenDate
        ) {
          weeklyUpdates[moboName].notified += 1;
        }
      }
    }

// **Sort userMobos by count in descending order and keep the keys (mobo names)**
const sortedUserMobos = Object.entries(userMobos)
    .sort(([, a], [, b]) => b.count - a.count) // Sort by count in descending order
    .reduce((acc, [key, value]) => {
        acc[key] = value; // Rebuild the object with sorted entries
        return acc;
    }, {});

    // --- Final Response Object ---
    const responseObject = {
      snapshotDate: await today("hyphen"), // Use the (now synchronous) today function with hyphen format
      userMobos: sortedUserMobos,
      weeklyUpdates: weeklyUpdates,
    };

    return responseObject;
  } catch (error) {
    console.error("Error fetching chart data:", error);
    // Attempt to get snapshotDate even on error, with fallback
    let snapshotDateStr = "N/A";
    try {
      snapshotDateStr = await today(); // Assuming today might still be async or want to keep await
    } catch (todayError) {
      console.error(
        "Error calling today() function during error handling:",
        todayError
      );
    }
    return { snapshotDate: snapshotDateStr, userMobos: {}, weeklyUpdates: {} }; // Return default structure
  }
}

//console.log(await getChartData());

export async function today(format = "default") {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  switch (format) {
    case "hyphen":
      return `${year}-${month}-${day}`; // YYYY-MM-DD with leading zeroes
    default:
      return `${year}/${now.getMonth() + 1}/${now.getDate()}`; // YYYY/M/D without leading zeroes
  }
}

export async function formatToYYYYMD(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error("Invalid date input for formatToYYYYMD");
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Parses a date string in YYYY/M/D format (no leading zeros required) into
 * a Date object representing midnight LOCAL time.
 * @param {string} dateString - Date string in YYYY/M/D format
 * @returns {Date|null} A Date object if valid, null otherwise
 */
export function parseYYYYMD(dateString) {
  // Basic check for non-empty string
  if (!dateString) return null;

  // Split into parts
  const parts = dateString.split("/");
  if (parts.length !== 3) return null;

  // Convert parts to numbers
  const year = +parts[0],
    month = +parts[1],
    day = +parts[2]; // Month is 1-based

  // Check if parts are valid numbers and basic month/day range
  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  // Create Date object using local time (note: month is 0-based in JS Date constructor)
  const date = new Date(year, month - 1, day);

  // Check if the date is valid AND didn't wrap around due to invalid day/month.
  // Compares using local time getters implicitly.
  if (
    isNaN(date.getTime()) ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null; // Date wrapped or was invalid
  }

  return date; // Represents midnight local time
}

/**
 * Checks if a date string is in valid YYYY/M/D format and represents a valid date.
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidYYYYMD(dateString) {
  return parseYYYYMD(dateString) !== null;
}

/**
 * Returns a Date object representing the start of the day (midnight LOCAL time)
 * 7 days prior to the current date. Necessary for correct day-level comparisons.
 * @returns {Date} Date object for midnight local time 7 days ago
 */
export function getSevenDaysAgoStartOfDay() {
  const today = new Date(); // Current local date and time
  const sevenDaysAgo = new Date(today); // Copy it

  // Move the date back 7 days
  sevenDaysAgo.setDate(today.getDate() - 7);

  // *** Crucial: Set time to the beginning of the day (local time) ***
  sevenDaysAgo.setHours(0, 0, 0, 0);

  return sevenDaysAgo;
}
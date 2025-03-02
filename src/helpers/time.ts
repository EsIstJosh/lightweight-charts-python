import { Time, isUTCTimestamp, isBusinessDay } from 'lightweight-charts';


/**
 * Convert a numeric or string timestamp to a Unix timestamp in seconds.
 * - If t is a string date (e.g. "2023-08-28"), parse it to seconds.
 * - If t is numeric, check its length/magnitude to decide if it's seconds or milliseconds.
 */
export function convertTime(t: number | string): number {
	let numericTime: number;
  
	if (typeof t === 'string') {
	  // Try to parse as an integer first
	  numericTime = parseInt(t, 10);
  
	  // If parsing fails, parse as a date string
	  if (isNaN(numericTime)) {
		const dateObj = new Date(t);
		return Math.floor(dateObj.getTime() / 1000);
	  }
	} else {
	  // t is already a number
	  numericTime = t;
	}
  
	// Now decide if numericTime is in seconds or milliseconds
	// A typical Unix timestamp in seconds is 10 digits (e.g. 1693185600)
	// In milliseconds, it's 13 digits (e.g. 1693185600000)
	const length = numericTime.toString().length;
  
	// If length >= 13, assume it's milliseconds; convert to seconds
	// If length <= 10, assume it's seconds
	if (length >= 13) {
	  return Math.floor(numericTime / 1000);
	} else {
	  return numericTime; // Already in seconds
	}
  }
  

export function displayTime(time: Time): string {
	if (typeof time == 'string') return time;
	const date = isBusinessDay(time)
		? new Date(time.year, time.month, time.day)
		: new Date(time * 1000);
	return date.toLocaleDateString();
}

export function formattedDateAndTime(timestamp: number | undefined): [string, string] {
	if (!timestamp) return ['', ''];
	const dateObj = new Date(timestamp);

	// Format date string
	const year = dateObj.getFullYear();
	const month = dateObj.toLocaleString('default', { month: 'short' });
	const date = dateObj.getDate().toString().padStart(2, '0');
	const formattedDate = `${date} ${month} ${year}`;

	// Format time string
	const hours = dateObj.getHours().toString().padStart(2, '0');
	const minutes = dateObj.getMinutes().toString().padStart(2, '0');
	const formattedTime = `${hours}:${minutes}`;

	return [formattedDate, formattedTime];
}

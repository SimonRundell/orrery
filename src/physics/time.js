/**
 * Time utilities for the orrery.
 * All calculations use Julian Date (JD) in the UTC/GMT timescale, which is
 * accurate enough for a visual teaching tool (we ignore the ~1 minute
 * difference between UTC and Terrestrial Time used in rigorous ephemerides).
 */

const MS_PER_DAY = 86400000;

/** Julian Date of the J2000.0 epoch (2000-01-01 12:00 UTC). */
export const J2000 = 2451545.0;

/**
 * Convert a JavaScript Date (interpreted as GMT/UTC) to a Julian Date.
 * @param {Date} date - date to convert
 * @returns {number} Julian Date
 */
export function dateToJd(date) {
  return date.getTime() / MS_PER_DAY + 2440587.5;
}

/**
 * Convert a Julian Date back to a JavaScript Date (UTC).
 * @param {number} jd - Julian Date
 * @returns {Date} equivalent UTC date
 */
export function jdToDate(jd) {
  return new Date((jd - 2440587.5) * MS_PER_DAY);
}

/**
 * Number of Julian centuries of 36525 days since J2000.0.
 * @param {number} jd - Julian Date
 * @returns {number} centuries since J2000.0
 */
export function centuriesSinceJ2000(jd) {
  return (jd - J2000) / 36525;
}

/** Format a Date as an ISO-ish "YYYY-MM-DD HH:MM" string in GMT. */
export function formatGmt(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} GMT`
  );
}

/**
 * Parse a `datetime-local` input value ("YYYY-MM-DDTHH:MM") as GMT/UTC,
 * ignoring the browser's local timezone, and return the equivalent
 * Julian Date directly.
 * @param {string} inputValue
 * @returns {number} Julian Date
 */
export function inputValueToJd(inputValue) {
  const [datePart, timePart] = inputValue.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart || '00:00').split(':').map(Number);
  return dateToJd(new Date(Date.UTC(year, month - 1, day, hour, minute)));
}

/** Format a Julian Date as a `datetime-local` input value, in GMT/UTC. */
export function jdToInputValue(jd) {
  const date = jdToDate(jd);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

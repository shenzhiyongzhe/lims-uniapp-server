/**
 * Business calendar in Asia/Shanghai.
 * DB stores due_start_date as UTC midnight for Y-M-D (see loan parseDate).
 *
 * Business day boundary: 06:00 Shanghai time.
 *   - 00:00–05:59 Shanghai → belongs to the PREVIOUS business day
 *   - 06:00–23:59 Shanghai → belongs to the CURRENT calendar day
 */
const SHANGHAI_TZ = 'Asia/Shanghai';

export function getShanghaiYmdParts(ref: Date = new Date()): {
  y: number;
  m: number;
  d: number;
} {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref);
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

/** Returns the hour (0-23) in Shanghai timezone for a given Date. */
function getShanghaiHour(ref: Date): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI_TZ,
    hour: 'numeric',
    hour12: false,
  }).format(ref);
  return Number(hourStr) % 24;
}

export function utcMidnightFromYmd(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Returns the business day (as UTC midnight) that the given time belongs to,
 * using 06:00 Shanghai time as the day boundary.
 *
 * Example:
 *   2026-05-25 05:30 Shanghai → business day = 2026-05-24 (UTC midnight)
 *   2026-05-25 06:00 Shanghai → business day = 2026-05-25 (UTC midnight)
 */
export function getShanghaiBusinessDate(ref: Date = new Date()): Date {
  const { y, m, d } = getShanghaiYmdParts(ref);
  const hour = getShanghaiHour(ref);
  if (hour < 6) {
    // Before 06:00 → belongs to previous business day
    return new Date(Date.UTC(y, m - 1, d - 1));
  }
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Returns the UTC timestamp range [start, end) for a given business day.
 * The business day starts at 06:00 Shanghai = (UTC midnight of that day) - 2h.
 *
 * Example for business day 2026-05-25:
 *   start = 2026-05-24T22:00:00.000Z  (= Shanghai 2026-05-25 06:00)
 *   end   = 2026-05-25T22:00:00.000Z  (= Shanghai 2026-05-26 06:00, exclusive)
 *
 * Use `gte: start, lt: end` when querying timestamp fields like paid_at.
 *
 * @param businessDate - UTC midnight Date representing the business day
 */
export function getBusinessDayTimestampRange(businessDate: Date): {
  start: Date;
  end: Date;
} {
  // Shanghai 06:00 = UTC+8 - 8h + 6h = UTC (day-1) 22:00
  // So business_day UTC_midnight - 2h gives us Shanghai 06:00 of that day
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const start = new Date(businessDate.getTime() - TWO_HOURS_MS);
  const end = new Date(
    businessDate.getTime() + 24 * 60 * 60 * 1000 - TWO_HOURS_MS,
  );
  return { start, end };
}

/**
 * Today and yesterday as UTC midnights matching stored @db.Date fields,
 * with 06:00 Shanghai time as the business day boundary.
 */
export function getShanghaiBusinessTodayAndYesterday(ref: Date = new Date()): {
  today: Date;
  yesterday: Date;
} {
  const today = getShanghaiBusinessDate(ref);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  return { today, yesterday };
}

/** Business calendar in Asia/Shanghai; DB stores due_start_date as UTC midnight for Y-M-D (see loan parseDate). */
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

export function utcMidnightFromYmd(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** Today and yesterday as UTC midnights matching stored @db.Date repayment days. */
export function getShanghaiBusinessTodayAndYesterday(ref: Date = new Date()): {
  today: Date;
  yesterday: Date;
} {
  const { y, m, d } = getShanghaiYmdParts(ref);
  const today = utcMidnightFromYmd(y, m, d);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  return { today, yesterday };
}

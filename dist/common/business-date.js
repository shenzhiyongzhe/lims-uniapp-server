"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShanghaiYmdParts = getShanghaiYmdParts;
exports.utcMidnightFromYmd = utcMidnightFromYmd;
exports.getShanghaiBusinessTodayAndYesterday = getShanghaiBusinessTodayAndYesterday;
const SHANGHAI_TZ = 'Asia/Shanghai';
function getShanghaiYmdParts(ref = new Date()) {
    const ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: SHANGHAI_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(ref);
    const [y, m, d] = ymd.split('-').map(Number);
    return { y, m, d };
}
function utcMidnightFromYmd(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d));
}
function getShanghaiBusinessTodayAndYesterday(ref = new Date()) {
    const { y, m, d } = getShanghaiYmdParts(ref);
    const today = utcMidnightFromYmd(y, m, d);
    const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
    return { today, yesterday };
}
//# sourceMappingURL=business-date.js.map
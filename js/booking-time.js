(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.bookingTimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_START_TIME = "11:00";
  const DEFAULT_END_TIME = "13:00";

  function normalizeQuoteTime(value) {
    const input = String(value || "").trim();
    if (!input) return null;

    const twentyFourHour = input.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (twentyFourHour) {
      return `${String(Number(twentyFourHour[1])).padStart(2, "0")}:${twentyFourHour[2]}`;
    }

    const twelveHour = input.match(/^(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*([ap])\.?m\.?$/i);
    if (!twelveHour) return null;

    let hour = Number(twelveHour[1]);
    const minute = twelveHour[2] || "00";
    const period = twelveHour[3].toLowerCase();

    if (period === "a" && hour === 12) hour = 0;
    if (period === "p" && hour !== 12) hour += 12;

    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  function safeQuoteTimeRange(value) {
    const start = normalizeQuoteTime(value);
    if (!start) {
      return { start: DEFAULT_START_TIME, end: DEFAULT_END_TIME, usedDefault: true };
    }

    const [hour, minute] = start.split(":").map(Number);
    const endMinutes = (hour * 60) + minute + 120;

    if (endMinutes >= 24 * 60) {
      return { start: DEFAULT_START_TIME, end: DEFAULT_END_TIME, usedDefault: true };
    }

    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    return { start, end, usedDefault: false };
  }

  return {
    DEFAULT_START_TIME,
    DEFAULT_END_TIME,
    normalizeQuoteTime,
    safeQuoteTimeRange
  };
});

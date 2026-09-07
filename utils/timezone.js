// utils/timezone.js
//
// ============================================================
// THE BUG THIS FIXES
// ============================================================
//
// `new Date(x).getHours()` returns the hour in the timezone the
// NODE PROCESS itself is running in — not necessarily the timezone
// your business rule ("before 10 AM = on time") was written for.
// Most hosting providers (Render, Railway, most AWS regions, Docker
// containers with no TZ set, etc.) default the process to UTC.
//
// Your attendance display already formats every time with
// `toLocaleTimeString("en-IN", ...)` / `toLocaleDateString("en-IN")`
// — i.e. it's already showing IST to the user. But the on-time/late
// CALCULATION used raw `getHours()`, which reads the server's UTC
// clock. IST is UTC+5:30, so the cutoff hour the code was actually
// checking against was effectively shifted by 5.5 hours from what
// the person sees on screen — someone checking in well after 10 AM
// IST could still be scored "on time", and the reverse.
//
// ============================================================
// THE FIX
// ============================================================
//
// getHourInTimeZone() uses Intl.DateTimeFormat with an EXPLICIT
// timeZone, so the extracted hour is always correct for that zone no
// matter what timezone the server process itself is configured with.
// `hourCycle: "h23"` avoids the well-known ICU quirk where some
// locale/option combinations return "24" instead of "00" for
// midnight when using hour12:false.
// ============================================================

const DEFAULT_TIME_ZONE = "Asia/Kolkata";

function getHourInTimeZone(date, timeZone = DEFAULT_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23", // always "0".."23", never "24" for midnight
  });

  return Number(formatter.format(new Date(date)));
}

// Convenience wrapper for the specific rule used across the app:
// before 10:00 AM IST = on time, 10:00 AM IST or later = late.
function isOnTimeArrival(date, cutoffHour = 10, timeZone = DEFAULT_TIME_ZONE) {
  if (!date) return false;
  return getHourInTimeZone(date, timeZone) < cutoffHour;
}

module.exports = {
  DEFAULT_TIME_ZONE,
  getHourInTimeZone,
  isOnTimeArrival,
};
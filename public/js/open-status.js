// Mirrors src/common/open-status.ts's computeOpenStatus/nowInHebronMinutes
// -- see that file for the tested canonical version and the
// normalize-search-text.ts/menu.js precedent for this duplication.
//
// Deliberately re-queries Asia/Hebron time on every tick, not the
// browser's own local timezone: a diner viewing the menu from outside
// Palestine (a different timezone) must still see the status the
// restaurant itself would recognize, matching what the server rendered
// at page load.
(function () {
  function toMinutes(hhmm) {
    const parts = hhmm.split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function nowInHebronMinutes() {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Hebron',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour').value);
    const minute = Number(parts.find((p) => p.type === 'minute').value);
    return hour * 60 + minute;
  }

  function computeOpenStatus(openTime, closeTime) {
    const open = toMinutes(openTime);
    const close = toMinutes(closeTime);
    const now = nowInHebronMinutes();
    const isOvernight = close <= open;
    const isOpen = isOvernight ? now >= open || now < close : now >= open && now < close;
    return { isOpen: isOpen, nextChangeTime: isOpen ? closeTime : openTime };
  }

  window.computeOpenStatusLive = computeOpenStatus;
})();

const NodeHelper = require("node_helper");
const ical = require("node-ical");

module.exports = NodeHelper.create({
  start() {
    console.log("[MMM-MyGCalendar] Node helper started");
    this.config = null;
    this.updateTimer = null;
    // Last successful fetch per calendar URL: { events, fetchedAt }
    this.cache = {};
  },

  stop() {
    if (this.updateTimer) clearInterval(this.updateTimer);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "GCAL_INIT") {
      this.config = payload;
      this.fetchAll();
      this.scheduleUpdate();
    }
  },

  scheduleUpdate() {
    if (this.updateTimer) clearInterval(this.updateTimer);
    const interval = this.config.updateInterval || 15 * 60 * 1000;
    this.updateTimer = setInterval(() => this.fetchAll(), interval);
  },

  async fetchAll() {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 14);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + Math.max(28, (this.config.weeks || 0) * 7 + 7));

    const failed = [];

    for (const cal of this.config.calendars) {
      try {
        const events = await this.fetchCalendar(cal, windowStart, windowEnd);
        this.cache[cal.url] = { events, fetchedAt: Date.now() };
      } catch (err) {
        failed.push(cal.name || "Calendar");
        console.error(`[MMM-MyGCalendar] Error fetching "${cal.name}":`, err.message);
      }
    }

    // A failed fetch keeps that calendar's last good events, so a network blip
    // or an expired URL never turns into an empty-looking calendar.
    const cached = this.config.calendars.map((cal) => this.cache[cal.url]).filter(Boolean);
    const allEvents = cached.flatMap((c) => c.events);
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    this.sendSocketNotification("GCAL_EVENTS", {
      events: allEvents,
      // Age of the oldest data on screen; null until any calendar has loaded.
      updatedAt: cached.length ? Math.min(...cached.map((c) => c.fetchedAt)) : null,
      failed,
    });
  },

  async fetchCalendar(cal, windowStart, windowEnd) {
    const data = await ical.async.fromURL(cal.url, {});
    const events = [];

    for (const key in data) {
      const item = data[key];
      if (item.type !== "VEVENT") continue;

      if (item.rrule) {
        this.expandRecurring(item, cal, windowStart, windowEnd, events);
      } else {
        const start = this.toDate(item.start);
        const end = item.end ? this.toDate(item.end) : start;

        if (start <= windowEnd && end >= windowStart) {
          events.push(this.buildEvent(item, start, end, cal));
        }
      }
    }

    return events;
  },

  expandRecurring(item, cal, windowStart, windowEnd, events) {
    let occurrences;
    try {
      occurrences = item.rrule.between(windowStart, windowEnd, true);
    } catch (e) {
      return;
    }

    const duration = item.end
      ? this.toDate(item.end) - this.toDate(item.start)
      : 0;

    // rrule repeats DTSTART at a fixed UTC time. For a series in a zone with
    // DST that is an hour off on the other side of a switch: a weekly 18:30
    // CEST series came out at 17:30 after 25.10.2026. Shift every occurrence
    // by the change of the UTC offset between DTSTART and the occurrence, in
    // the series' own time zone. All-day series and UTC series need nothing.
    const dtstart = this.toDate(item.start);
    const tz = item.datetype === "date" ? null : this.zoneOf(item.start);
    const startOffset = tz ? this.utcOffsetMinutes(dtstart, tz) : 0;

    for (const date of occurrences) {
      let occStart = new Date(date);
      if (tz) {
        const shift = startOffset - this.utcOffsetMinutes(occStart, tz);
        if (shift) occStart = new Date(occStart.getTime() + shift * 60 * 1000);
      }
      const dateStr = occStart.toDateString();

      // Skip EXDATE exceptions
      if (item.exdate) {
        const isException = Object.values(item.exdate).some(
          (ex) => new Date(ex).toDateString() === dateStr
        );
        if (isException) continue;
      }

      // A single occurrence moved in Google Calendar (RECURRENCE-ID) carries
      // its own start and end; the rule's time does not apply to it.
      if (item.recurrences) {
        const match = Object.entries(item.recurrences).find(
          ([k]) => new Date(k).toDateString() === dateStr
        );
        if (match) {
          const src = match[1];
          const s = this.toDate(src.start);
          const e = src.end ? this.toDate(src.end) : new Date(s.getTime() + duration);
          if (s <= windowEnd && e >= windowStart) events.push(this.buildEvent(src, s, e, cal));
          continue;
        }
      }

      const occEnd = new Date(occStart.getTime() + duration);
      events.push(this.buildEvent(item, occStart, occEnd, cal));
    }
  },

  // IANA zone of a node-ical start value: its TZID, else the Pi's own zone
  // (floating times). UTC ("Z") values come back as "Etc/UTC" and need no shift.
  zoneOf(start) {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tz = start && start.tz ? String(start.tz) : local;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch (e) {
      return local; // e.g. a Windows zone name Intl does not know
    }
  },

  // UTC offset of `tz` at instant `date`, in minutes (Europe/Berlin: 60 or 120).
  utcOffsetMinutes(date, tz) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date);
    const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
    const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
    return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  },

  buildEvent(item, start, end, cal) {
    const allDay =
      item.datetype === "date" ||
      (item.start && typeof item.start.toISOString !== "function" && item.start.val);

    // node-ical stores COLOR as a plain string or {val, params} object
    let eventColor = item.color || null;
    if (eventColor && typeof eventColor === "object") {
      eventColor = eventColor.val || null;
    }
    if (eventColor) eventColor = String(eventColor).trim();

    if (this.config.debug) {
      const colorKeys = Object.keys(item).filter(k =>
        k.toLowerCase().includes("color") || k.toLowerCase().startsWith("x-")
      );
      if (colorKeys.length) {
        console.log(`[MMM-MyGCalendar] DEBUG "${item.summary}" — color-related keys:`,
          colorKeys.reduce((acc, k) => { acc[k] = item[k]; return acc; }, {})
        );
      } else if (!this._debuggedKeys) {
        this._debuggedKeys = true;
        console.log(`[MMM-MyGCalendar] DEBUG sample event keys for "${item.summary}":`, Object.keys(item));
      }
    }

    // Private calendars never send titles, places or notes to the display.
    const hidden = !!cal.private;

    return {
      id: `${item.uid || item.summary}_${start.getTime()}`,
      title: hidden ? this.config.privateTitle || "Busy" : (item.summary || "Untitled").trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: !!allDay,
      location: hidden ? "" : item.location || "",
      description: hidden || !item.description ? "" : item.description.trim(),
      calendarName: cal.name || "Calendar",
      calendarColor: cal.color || "#4285F4",
      eventColor: eventColor,
    };
  },

  toDate(val) {
    if (val instanceof Date) return val;
    if (val && val.toJSDate) return val.toJSDate();
    return new Date(val);
  },
});

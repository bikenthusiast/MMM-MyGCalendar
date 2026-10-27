# MMM-MyGCalendar

A polished month-view calendar module for [MagicMirror²](https://magicmirror.builders/) that connects directly to Google Calendar via iCal URL.

Displays a rolling 4-week window: **1 past week · current week · 2 future weeks**.

![MMM-MyGCalendar screenshot](screenshot.png)

- Click any **event chip** → full event detail modal
- Click any **date number** → day-view modal listing all events for that day (click any event there for full detail with a ← back button)
- Click the **"+N" badge** (top-right corner of a date square) → same day-view modal
- Every date square reserves a fixed height for `maxEventsPerDay` events, so the calendar's overall height stays predictable regardless of how many events land on a given day
- Multi-day all-day events (e.g. "Vacation", "Conference") render as a single connected bar across the days they cover, as long as those days are in the same calendar row — the bar breaks and restarts at the end of a week

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/johnster000/MMM-MyGCalendar.git
cd MMM-MyGCalendar
npm install
```

---

## Update

```bash
cd ~/MagicMirror/modules/MMM-MyGCalendar
git pull
npm install
```

---

## Getting Your Google Calendar iCal URL

1. Open [Google Calendar](https://calendar.google.com) in a browser.
2. Click the **⋮** next to the calendar name → **Settings and sharing**.
3. Scroll to **"Integrate calendar"**.
4. Copy the **"Secret address in iCal format"**:
   ```
   https://calendar.google.com/calendar/ical/you%40gmail.com/private-XXXXXX/basic.ics
   ```
5. Paste it into the `url` field below.

> **Note:** This URL gives full read access to your private calendar — treat it like a password.

---

## Configuration

```javascript
{
  module: "MMM-MyGCalendar",
  position: "top_bar",
  config: {
    calendars: [
      {
        name: "Personal",
        url: "https://calendar.google.com/calendar/ical/you%40gmail.com/private-HASH/basic.ics",
        color: "#4285F4"
      },
      {
        name: "Work",
        url: "https://calendar.google.com/calendar/ical/work%40example.com/private-HASH/basic.ics",
        color: "#0F9D58"
      }
    ],
    colorRules: [
      { keyword: "standup",        color: "#039BE5" }, // Peacock
      { keyword: "birthday",       color: "#E91E63" }, // Pink
      { keyword: "gym|workout",    color: "#F4511E" }, // Tangerine
      { keyword: "holiday",        color: "#0B8043" }, // Basil
      { keyword: "flight|travel",  color: "#F6BF26" }, // Banana
    ]
  }
},
```

### All Options

| Option               | Default        | Description                                                      |
|----------------------|----------------|------------------------------------------------------------------|
| `calendars`          | `[]`           | Array of calendar sources (see above)                            |
| `calendars[].name`   | `"Calendar"`   | Display name shown in modals                                     |
| `calendars[].url`    | —              | iCal URL from Google Calendar settings                           |
| `calendars[].color`  | `"#4285F4"`    | Fallback hex color used when the event has no individual color   |
| `calendars[].private`| `false`        | Set `true` to replace titles with `privateTitle` and drop locations and notes — see below |
| `updateInterval`     | `900000` (15m) | How often to re-fetch calendar data (ms)                         |
| `weekStartsOnMonday` | `false`        | Set `true` for Mon–Sun week layout                               |
| `backgroundColor`    | `"#ffffff"`    | Background color of the calendar card                            |
| `pastWeekOpacity`    | `0.45`         | Opacity of the past-week row (0 = invisible, 1 = full); in the mirror layout, of the days already over this week |
| `maxEventsPerDay`    | `3`            | Max chips shown per day cell (also sets the fixed slot height of every date square; overflow shown as a clickable "+N" corner badge) |
| `fullWidth`          | `false`        | Set `true` to remove border-radius and shadow for a flush edge-to-edge look |
| `showHeader`         | `true`         | Set `false` to hide the month-range header bar above the calendar grid |
| `colorRules`         | `[]`           | Keyword-based color overrides — see below                        |
| `locale`             | `"en-US"`      | Locale for month names, weekday headers, dates and times (e.g. `"de-DE"` for 24h German format) |
| `showTodayPanel`     | `false`        | Show a daily agenda card for today to the left of the 4-week grid — see below |
| `todayPanelWidth`    | `"300px"`      | Width of the today panel (any CSS length)                        |
| `todayPanelTitle`    | `"Today"`      | Heading of the today panel                                       |
| `todayPanelEmptyText`| `"No events today"` | Text shown when there are no events today                   |
| `allDayText`         | `"All day"`    | Label for all-day events in the today panel and day modal        |
| `layout`             | `"card"`       | `"mirror"` for a smart mirror read from across the room — see below |
| `weeks`              | `3`            | Mirror layout: number of week rows, starting with the current week |
| `todayMaxEvents`     | `4`            | Mirror layout: rows listed below the highlighted meeting before `moreText` |
| `nowText`            | `"Now"`        | Mirror layout: label of the running meeting                      |
| `endsInText`         | `"{time} left"`| Mirror layout: remaining time of the running meeting             |
| `moreText`           | `"+{n} more"`  | Mirror layout: line shown when today has more than `todayMaxEvents` rows |
| `todayDoneText`      | `"No more events today"` | Mirror layout: shown once all of today's meetings are over |
| `staleText`          | `"As of {time}"` | Shown while a calendar fails to load, with the age of the data on screen |
| `privateTitle`       | `"Busy"`       | Title shown for events from calendars with `private: true`       |
| `loadingText`        | `"Loading calendar…"` | Text shown until the first calendar has loaded            |
| `debug`              | `false`        | Log raw event properties to the MagicMirror console (useful for troubleshooting) |

### Mirror layout

`layout: "mirror"` is made for a display behind a two-way mirror, read from 1–2 m without touch or mouse. Everything that would light up the glass is removed: light text on black, no card, no shadows.

- **Today on top.** The running meeting — or, if none, the next one — is shown large with a relative time: "in 40 min." before it starts, "Now · 25 min left" while it runs. Relative times follow `locale` (German: "in 40 Min.", "Jetzt · noch 25 Min." with the texts below) and update on the minute. The rest of today follows as a list, all-day events first and without a time; finished meetings are left out.
- **Grid from this week.** `weeks` rows starting with the current week. Events are colour bars instead of labelled chips; multi-day events stay connected. Days already over are dimmed with `pastWeekOpacity` (`0.55` keeps them at 5.7:1).
- **No interaction.** No click targets, hover effects or modals. `backgroundColor`, `showTodayPanel` and `todayPanelWidth` are ignored.
- Sizes are set for a region about 1300 px wide (a 1440 px portrait panel). Text is 28–52 px; at 1.5 m, 33 px corresponds to the 11 pt minimum on a phone at arm's length.

```javascript
config: {
  layout: "mirror",
  locale: "de-DE",
  weekStartsOnMonday: true,
  showHeader: false,
  weeks: 3,
  pastWeekOpacity: 0.55,
  todayPanelTitle: "Heute",
  todayPanelEmptyText: "Keine Termine heute",
  todayDoneText: "Keine weiteren Termine heute",
  allDayText: "Ganztägig",
  nowText: "Jetzt",
  endsInText: "noch {time}",
  moreText: "+{n} weitere",
  staleText: "Stand {time}",
  privateTitle: "Termin",
  loadingText: "Kalender wird geladen …",
  calendars: [...]
}
```

### Private calendars and failed fetches

A calendar with `private: true` never sends its titles, locations or notes to the display; its events show as `privateTitle` with their time and colour. Useful when visitors can see the screen.

If a calendar can't be fetched, its last good events stay on screen and `staleText` appears with the time of the oldest data shown ("As of 14:05"). Until the first calendar has loaded, the module shows `loadingText` rather than an empty day.

### Today panel

Set `showTodayPanel: true` to add a daily agenda next to the 4-week grid. It lists all of today's events — all-day events first, then timed events in order — with time, title and location, using the same colors as the grid.

- The running meeting is highlighted, finished meetings are dimmed and struck through.
- The panel always matches the height of the grid. If there are more meetings than fit, finished ones are dropped from the top first so the current and upcoming meetings stay visible; anything still left over fades out at the bottom.
- The panel re-renders automatically when a meeting starts or ends (checked once per minute).
- Click an entry to open the event detail modal.

```javascript
config: {
  locale: "de-DE",
  weekStartsOnMonday: true,
  showTodayPanel: true,
  todayPanelWidth: "300px",
  todayPanelTitle: "Heute",
  todayPanelEmptyText: "Keine Termine heute",
  allDayText: "Ganztägig",
  calendars: [...]
}
```

### Per-event colors with `colorRules`

Google Calendar's iCal export does not include individual event colors — those only exist in the Google Calendar API (which requires OAuth). The iCal feed only carries the calendar-level color set in `calendars[].color`.

To color specific events, use `colorRules`. Each rule matches against the event title (case-insensitive) and applies a hex color. Rules are checked in order — the first match wins.

```javascript
config: {
  colorRules: [
    { keyword: "standup",    color: "#039BE5" }, // Peacock blue
    { keyword: "birthday",   color: "#E91E63" }, // Pink
    { keyword: "gym|workout",color: "#F4511E" }, // Tangerine — regex OR
    { keyword: "holiday",    color: "#0B8043" }, // Basil green
    { keyword: "flight|travel", color: "#F6BF26" }, // Banana yellow
  ],
  calendars: [...]
}
```

The `keyword` value is treated as a **case-insensitive regular expression**, so you can use `|` for OR, `^` to match the start, etc.

Color priority order: iCal `COLOR` property (non-Google sources) → `colorRules` match → `calendars[].color` fallback.

### Suggested colors

| Google name  | Hex       |
|--------------|-----------|
| Tomato       | `#D50000` |
| Flamingo     | `#E67C73` |
| Tangerine    | `#F4511E` |
| Banana       | `#F6BF26` |
| Sage         | `#33B679` |
| Basil        | `#0B8043` |
| Peacock      | `#039BE5` |
| Blueberry    | `#3F51B5` |
| Lavender     | `#7986CB` |
| Grape        | `#8E24AA` |
| Graphite     | `#616161` |

### Suggested fallback calendar colors

| Color        | Hex       |
|--------------|-----------|
| Google Blue  | `#4285F4` |
| Google Green | `#0F9D58` |
| Google Red   | `#DB4437` |
| Purple       | `#7986CB` |
| Teal         | `#009688` |
| Pink         | `#E91E63` |
| Amber        | `#F4B400` |

---

## Interactions

The card layout only; the mirror layout has none.

| Tap target          | Result                                              |
|---------------------|-----------------------------------------------------|
| Event chip          | Event detail modal (title, time, location, notes)   |
| Date number         | Day-view modal — all events for that day            |
| "+N" corner badge   | Day-view modal — all events for that day            |
| Event in day modal  | Event detail modal with ← back to day view          |
| Backdrop / Esc      | Close modal                                         |

# Notes App --- Code Review & Implementation Plan

Reviewed files: `app.js`, `index.html`, `sw.js`, `manifest.json`,
`README.md`, `launch.sh`

This document records the analysis completed so far. It is an
implementation checklist: work through the items in order, test each
change, and commit it before moving to the next item.



------------------------------------------------------------------------

## 1. Project overview

The application is a lightweight, browser-based notes app with:

-   Notes (top-level items) and sections inside each note.
-   Completion states for notes and sections.
-   Section collapse/expand controls.
-   Drag-and-drop ordering.
-   Rich text editing (planned: checklists, lists, code blocks, and formatted text).
-   Note tags and tag-based filtering (planned).
-   Pinned and favourite notes (planned).
-   Version history and restore (planned).
-   JSON import/export.
-   Local storage persistence.
-   Split-panel layout with a draggable divider.
-   Light/dark theme.
-   PWA installation and service-worker caching.
-   Mobile navigation support using the History API.

The app is currently implemented mainly in a single `app.js` file, with
HTML and CSS in `index.html`.

### Main data model

The code creates notes in this general shape:

``` js
{
  id: "unique-id",
  title: "Note title",
  sections: [],
  completed: false,
  createdAt: 123456789
}
```

Sections are created in this general shape:

``` js
{
  id: "unique-id",
  title: "Section title",
  content: "",
  collapsed: false,
  completed: false
}
```

A note can also have `completedAt` when it is marked complete.

**Important:** Existing imported data may contain older or incomplete
shapes. Before changing the model, add migration/validation logic rather
than assuming every stored object is perfect.

------------------------------------------------------------------------

## 2. How the application works

### Startup flow

1.  `app.js` reads the `notes` key from `localStorage`.
2.  It looks up the main HTML elements and attaches event handlers.
3.  It applies the saved theme.
4.  It calls `render()` to draw the interface.
5.  The install prompt handler listens for `beforeinstallprompt`.
6.  `index.html` registers the service worker (the registration code is
    in the HTML).

### Main interaction flow

-   Creating a note: construct a note object, add it to `notes`, save,
    and render.
-   Opening a note: set `currentNoteId`, then render the split-panel
    view.
-   Creating a section: add a section to the selected note, save, and
    render.
-   Editing content: update the section's `content` and save it.
-   Completing an item: toggle its `completed` value, save, and render.
-   Import/export: parse or serialize the notes array as JSON.
-   Reordering: drag-and-drop changes array order and then saves.
-   Persistence: `save()` serializes the entire notes array into local
    storage.

------------------------------------------------------------------------

## 3. `app.js` --- function-by-function review

### 3.1 Global state and DOM references

The file starts with:

``` js
let notes = JSON.parse(localStorage.getItem("notes")) || [];
let currentNoteId = null;
```

-   `notes` is the application's in-memory data.
-   `currentNoteId` identifies the note currently open in the detail
    panel.
-   Several DOM elements are cached in variables to avoid repeatedly
    querying the document.

**Issue:** If the stored value is invalid JSON, the initial
`JSON.parse()` throws and can prevent the entire app from starting.

**Implementation:** Wrap storage loading in `try/catch`, validate the
result, and provide a recovery path if the stored data is corrupt.

### 3.2 `moveItem(arr, from, to)`

Moves an item inside an array by removing it from one index and
inserting it at another.

Used by drag-and-drop for notes and sections.

**Things to improve:** - Validate `from` and `to` before mutating the
array. - Avoid calling it with `-1` when an element cannot be found. -
Add tests for moving first-to-last, last-to-first, same-index, and
invalid indices.

### 3.3 `setToggleAllVisibility(visible, disabled = false)`

Looks up the Toggle All button and changes its disabled state and
opacity.

**Bug:** The `visible` parameter is not used. The function never
actually hides or shows the button.

**Fix:**

``` js
function setToggleAllVisibility(visible, disabled = false) {
  const btn = document.getElementById("toggleAll");
  if (!btn) return;

  btn.hidden = !visible;
  btn.disabled = disabled;
  btn.style.opacity = disabled ? "0.4" : "1";
}
```

Test the empty note, one-section note, and multi-section note cases.

### 3.4 `save()`

Serializes all notes and stores them in local storage.

``` js
function save() {
  localStorage.setItem("notes", JSON.stringify(notes));
}
```

**Issues:** - Storage writes are synchronous. - The whole data set is
serialized for every save. - The content editor calls `save()` on every
input event, potentially on every keystroke. - Storage quota errors are
not centrally handled.

**Implementation plan:** 1. Add error handling around storage writes. 2.
Debounce content saves so typing does not write on every keystroke. 3.
Keep immediate saves for important actions such as create, delete,
complete, and import. 4. Consider IndexedDB if notes become large. 5.
Keep a backup/export mechanism.

### 3.5 `uid()`

Creates IDs using the current timestamp plus a random string.

This is convenient for a small offline app. For stronger uniqueness,
consider `crypto.randomUUID()` where supported, with a fallback for
older environments.

### 3.6 `formatDate(ts)`

Formats a timestamp as `DD.MM`.

It currently omits the year. That may be acceptable for compact UI
labels, but dates can become ambiguous across years.

**Improvement:** Decide whether the UI should show the year for older
notes, and handle invalid timestamps safely.

### 3.7 `renderLinks(text = "")`

Converts Markdown-style links and plain URLs into HTML anchor elements.

**High-priority security concern:** The function inserts text into HTML
without first escaping HTML special characters. A note title or imported
value containing HTML can potentially be interpreted as markup.

**Implementation:** - Escape plain text before generating HTML. -
Validate link protocols; allow only `http:` and `https:` unless there is
a deliberate reason to support more. - Do not interpolate untrusted
labels or URLs directly into HTML attributes. - Prefer building anchors
with DOM APIs where practical.

### 3.8 `renderMarkdown(text = "")`

Converts a small subset of Markdown into HTML: - Fenced code blocks. -
Headings. - Bold and italic text. - Markdown links. - Plain URLs. -
Newlines as `<br>`.

**High-priority security concern:** It performs string replacements and
returns HTML without escaping the original text. User content can
therefore become executable or unsafe HTML when assigned to `innerHTML`.

**Implementation order:** 1. Escape raw input first. 2. Apply formatting
only to the escaped text. 3. Safely handle link labels and URLs. 4.
Consider a maintained Markdown parser plus an HTML sanitizer if the
feature set grows. 5. Explicitly decide whether raw HTML in notes is
unsupported; safest default is to disable it.

Do not treat a regular-expression Markdown renderer as a security
boundary.

------------------------------------------------------------------------

## 4. Rendering and UI functions

### 4.1 `render()`

This is the main UI rendering function.

It: - Clears and rebuilds the notes list. - Opens the detail panel if
`currentNoteId` is set. - Updates split-panel classes and widths. -
Updates the detail title. - Calls `renderNoteView()`. - Schedules the
custom scroll-thumb update.

**Things to improve:** - Avoid rebuilding the entire interface for small
changes if performance becomes a problem. - Avoid assigning untrusted
values through `innerHTML`. - Handle the case where `currentNoteId`
points to a note that no longer exists. - Keep rendering separate from
data mutation and persistence.

### 4.2 `renderRoot()`

Renders the list of notes.

It separates active and completed notes, sorts completed notes by
`completedAt`, and renders the completed group after active notes.

Each note card supports: - Opening the note. - Double-click title
editing. - Marking the note complete/incomplete. - Deleting the note
after a confirmation click. - Drag-and-drop ordering.

**Potential ordering bug:** The visible list is built from a derived
array (`active` plus sorted `done`), but drag-and-drop calculates
indices in the original `notes` array. The DOM order and data-array
order can diverge, especially for completed notes. Reordering across the
active/completed boundary may therefore behave unexpectedly.

**Implementation:** Define the intended ordering rules first. Then make
the displayed order and the array mutation use the same ordering model.
Consider preventing drag operations across the active/completed divider
if that is the desired UX.

**Other improvements:** - Replace HTML string insertion for
user-controlled note titles with safe text/DOM rendering. - Ensure
deletion confirmation is accessible and cannot accidentally remain in a
stale state. - Add keyboard-accessible alternatives to drag-and-drop.

### 4.3 `renderNoteView(noteId)`

Finds the selected note, handles the empty-section state, groups active
and completed sections, and calls `renderSection()` for each section.

It updates the Toggle All UI.

**Issues/improvements:** - `updateToggleAllUI()` is called twice in this
function; one call appears redundant. - The visibility helper currently
ignores its `visible` parameter. - The active/completed grouping should
be considered when implementing section drag-and-drop, just as with
notes. - Guard against malformed `note.sections` values.

### 4.4 `renderSection(note, section)`

Builds one section card, including: - Completion checkbox. - Editable
title. - Delete button. - Collapse/expand button. - Editable content. -
Drag-and-drop handlers. - Link tooltip.

**Issues/improvements:** - Section completion currently toggles
`completed` but does not record a `completedAt` timestamp. If completion
dates are useful, add them consistently. - The section title is saved on
each input event. - The content editor saves on every input event. -
Content is rendered with `innerHTML`, making the Markdown escaping issue
especially important. - The code uses
`document.execCommand("insertText", ...)`, which is deprecated. It may
continue to work in browsers, but should be replaced with a more modern
editing approach when practical. - The paste handler parses clipboard
HTML and extracts links. Clipboard HTML must be treated as untrusted
input. - A fetched page title can arrive after the user has edited the
content again. The asynchronous result may then update newer content
unexpectedly. Capture the intended URL and verify the content still
contains the original URL before replacing it. - Dragging uses
mouse-oriented HTML drag-and-drop behavior; test carefully on touch
devices.

### 4.5 Note and section creation handlers

The add-note handler creates a note with an ID, title, empty sections,
completion state, and creation timestamp.

The add-section handler creates a section, inserts it at the beginning
of the selected note, saves, renders, and focuses the new title.

**Improvements:** - Validate titles and data before saving. - Consider a
consistent maximum title length. - Move object creation into small
reusable functions, for example `createNote()` and `createSection()`. -
Test behavior when no note is selected.

### 4.6 Completion and Toggle All

Notes get a `completedAt` timestamp when marked complete. Sections
currently do not.

Toggle All collapses all sections if any section is expanded; otherwise
it expands all sections.

**Implementation:** - Fix button visibility. - Remove duplicate UI
updates. - Decide whether completed sections should be included in
Toggle All (currently they are). - Add tests for zero, one, and multiple
sections.

### 4.7 Import handler

The import handler accepts: - An array of notes. - An object containing
a `notes` array. - A single note-like object containing a `sections`
array.

It then replaces the in-memory notes and saves.

**High-priority reliability issue:** The import checks only broad
container shapes. It does not validate every note and section field
before replacing the current data.

**Safer import flow:** 1. Read and parse the file. 2. Validate the
top-level structure. 3. Validate each note and section. 4. Normalize
missing optional fields and migrate old formats. 5. Show a
summary/confirmation before replacing current data. 6. Back up current
notes before replacement. 7. Save the new data. 8. If saving fails,
preserve or restore the old data. 9. Re-render only after a successful
save.

Never allow malformed imported data to silently destroy a valid existing
notes collection.

### 4.8 Export handler

Exports `{ notes, panelSplit }` as a JSON file.

**Improvements:** - Revoke the generated object URL after the download
has been initiated. - Include a schema/version field in future exports,
for example `version: 1`. - Validate data before export if legacy data
may be malformed. - Test export followed by import to verify round-trip
compatibility.

### 4.9 Link editing: `editLink()`

Opens the link-edit modal, reads the new label and URL, replaces the old
Markdown representation, saves, and re-renders.

**Improvements:** - Validate the URL protocol. - Handle the case where
the old Markdown text no longer exists. - Avoid replacing the wrong
occurrence if the same link appears multiple times. - Keep modal focus
management and keyboard behavior accessible.

### 4.10 Link tooltip: `attachLinkTooltip()`

Shows a hover tooltip with open and edit actions.

**Improvements:** - Hover is not available in the same way on touch
devices; ensure links remain usable without the tooltip. - Check tooltip
positioning near the left, right, and bottom edges of the viewport. -
Ensure keyboard focus can expose the same actions. - Validate URLs
before opening them.

### 4.11 Scroll thumb: `updateScrollThumb()`

Calculates a custom scrollbar thumb position from the list's scroll
dimensions.

The thumb is dragged with `mousedown`, `mousemove`, and `mouseup`.

**Improvements:** - Guard against division by zero when the scroll range
or available thumb track is zero. - Recalculate on resize and content
changes. - Consider native scrolling unless the custom thumb is
essential. - Use Pointer Events (`pointerdown`, `pointermove`,
`pointerup`) for mouse, touch, and pen support.

### 4.12 Panel resizing

The split-panel divider uses mouse events and limits the left panel to
20--80%.

**Improvements:** - Use Pointer Events and pointer capture. - Support
touch. - Handle window resizing. - Persist only valid width values. -
Ensure the divider is keyboard accessible.

### 4.13 Theme and PWA install prompt

The theme is stored in local storage and applied to the body. The
install banner uses `beforeinstallprompt`.

**Improvements:** - Keep theme application in one function so
initialization and toggling do not duplicate logic. - Verify install
prompt behavior across supported browsers; `beforeinstallprompt` is not
universally supported. - Provide a graceful fallback when the event is
unavailable.

------------------------------------------------------------------------

## 5. `index.html` review

The HTML contains the app layout, embedded CSS, modal markup, install
banner, and service-worker registration.

Main UI areas include: - `panelLeft` and `panelRight`. - Notes list and
detail containers. - Resize handle. - Toggle All control. - Help
modal. - Link edit modal. - Link hover tooltip. - Install banner and
update UI.

### Findings and improvements

1.  **CSS is embedded in the HTML.** Move it to a separate `styles.css`
    when the project is ready for cleanup.
2.  **External dependencies:** Bootstrap 5.3.2 and Bootstrap Icons
    1.11.1 are loaded from CDNs. This means the app depends on network
    access for those assets unless they are cached or bundled locally.
3.  **PWA offline behavior:** The service worker's precache list does
    not include the CDN assets or the manifest's icon files. Offline
    appearance may therefore be incomplete.
4.  **Accessibility:** Add meaningful labels to icon-only buttons,
    visible keyboard focus, appropriate dialog semantics, and focus
    handling for modals.
5.  **Mobile viewport:** Check use of `100vh` on mobile browsers;
    dynamic browser chrome can make it inaccurate. Consider modern
    dynamic viewport units with a fallback.
6.  **Metadata:** Review duplicate or conflicting `theme-color`
    declarations and keep the intended theme behavior consistent.
7.  **Separation of concerns:** Keep markup in HTML, styling in CSS, and
    behavior in JavaScript.

------------------------------------------------------------------------

## 6. `sw.js` review

Current service worker:

``` js
const CACHE_PREFIX = "notes-app-";
const CACHE_NAME = `${CACHE_PREFIX}v7`;
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(
      cached => cached || fetch(event.request)
    )
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.action === "skipWaiting") {
    self.skipWaiting();
  }
});
```

### Findings

1.  `skipWaiting()` is called immediately during install, while the app
    also has a message-based skip-waiting mechanism. If the UI is
    intended to ask the user before updating, these behaviors conflict.
2.  Activation deletes every cache whose name differs from this cache.
    On a shared origin, this could delete caches belonging to other
    applications.
3.  The fetch strategy is cache-first, then network. There is no
    explicit offline fallback for uncached requests.
4.  Only the listed local files are precached. CDN assets and manifest
    icons are missing from the list.
5.  Cache versioning is manual through `CACHE_NAME`.

### Recommended implementation

-   Use an app-specific cache prefix, such as `notes-app-`.
-   Delete only old caches belonging to this app.
-   Choose one update policy: immediate activation or user-approved
    activation. Do not mix both accidentally.
-   Precache all essential local assets, including icons and CSS once
    separated.
-   Handle failed network requests gracefully.
-   Test first install, app update, offline launch, and rollback
    behavior.

------------------------------------------------------------------------

## 7. `manifest.json` review

Current manifest:

``` json
{
  "name": "Notes",
  "short_name": "Notes",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {"src":"icon-192.png","sizes":"192x192","type":"image/png"},
    {"src":"icon-512.png","sizes":"512x512","type":"image/png"}
  ]
}
```

### Improvements

-   Verify that `icon-192.png` and `icon-512.png` actually exist at the
    expected paths.
-   Include appropriate maskable icon entries if maskable assets are
    available.
-   Review `start_url` and `scope` for the deployment path.
-   Keep theme/background colors aligned with the app's intended launch
    appearance.
-   Include the manifest and icon assets in the service-worker precache
    if offline installation/launch requires them.

------------------------------------------------------------------------

## 8. `launch.sh` review

Current script:

``` bash
#!/bin/bash
if [ "$1" = "kill" ]; then
    pkill -f "http.server 8080" && echo "Server stopped." || echo "No server running."
    exit 0
fi
cd "$(dirname "$0")"
nohup python3 -m http.server 8080 --bind 0.0.0.0 &>/dev/null &
echo "Server started at http://10.131.38.111:8080 (PID $!)"
```

### Findings and improvements

1.  It binds to `0.0.0.0`, exposing the server on all network
    interfaces. This may be intentional for LAN/mobile testing, but
    should not be the default for a local-only development server.
2.  The printed IP address is hard-coded and may become incorrect when
    the machine or network changes.
3.  `pkill -f "http.server 8080"` may terminate another matching Python
    HTTP server.
4.  The script does not check whether port 8080 is already occupied.
5.  It does not verify that Python is installed or that the server
    started successfully.

### Recommended implementation

-   Default to `127.0.0.1` for local development.
-   Add an explicit LAN mode if access from a phone or another device is
    required.
-   Track the PID in a project-specific file and stop only that process.
-   Check port availability and server startup.
-   Print the actual configured host and port.

------------------------------------------------------------------------

## 9. New feature requirements

These are product features requested in addition to the code-review fixes.
They are not currently confirmed as implemented. Build them after the
safety, data-validation, and ordering foundations are stable.

### 9.1 Tags and tag-based filtering

**Goal:** Assign labels such as `Work`, `Personal`, `Learning`, and
`Projects` to notes, then filter the notes list by one or more tags.

**Suggested data model:**

```js
{
  id: "unique-id",
  title: "Note title",
  tags: ["Work", "Learning"],
  sections: [],
  completed: false,
  createdAt: 123456789
}
```

Implementation notes:
- Store tags on the note, not on individual sections, for the first
  version.
- Normalize tag names (trim whitespace, reject empty names, and avoid
  duplicates case-insensitively). Preserve a friendly display form.
- Allow adding/removing tags from a note and filtering by a selected tag.
- Decide whether multi-tag filtering means **match any** selected tag or
  **match all** selected tags; make the UI behavior explicit. A useful
  initial default is match-any.
- Include an `All notes` option and an obvious way to clear the filter.
- Keep filtering as a view operation: it must not modify or reorder the
  underlying `notes` array.
- Ensure drag-and-drop cannot accidentally change the order of hidden
  notes while a filter is active.
- Include tags in JSON export/import and normalize older notes to
  `tags: []` during migration.

Acceptance checks:
- Add, rename (if supported), and remove tags.
- Assign multiple tags to one note.
- Filter by each example tag and clear the filter.
- Verify notes without tags remain visible under `All notes`.
- Verify filtering does not change persisted manual ordering.

### 9.2 Rich editor

**Goal:** Support checklists, bullet lists, numbered lists, code blocks,
and formatted text in section content.

Implementation notes:
- Decide whether the editor stores Markdown, structured document data,
  or sanitized HTML. Do not mix formats without an explicit schema.
- For this app's current lightweight architecture, Markdown is a
  practical first option: `- [ ]` / `- [x]` for checklists, `-` for
  bullets, `1.` for numbered lists, fenced blocks for code, and standard
  Markdown emphasis/headings.
- Add a compact formatting toolbar with actions for checklist, bullet,
  numbered list, code block, bold, italic, and heading.
- Toolbar actions should preserve the current selection/caret where
  possible and work on touch devices as well as desktop.
- Keep raw HTML disabled by default. Escape user content and sanitize
  rendered output; a rich editor must not reintroduce the XSS risk
  identified in `renderMarkdown()`.
- Define how pasted content is converted. Treat clipboard HTML as
  untrusted and retain only supported formatting.
- Preserve existing plain-text notes and existing Markdown content
  during migration; do not silently rewrite user content.

Acceptance checks:
- Create and edit each supported list/format type.
- Save, refresh, and verify formatting remains intact.
- Export and re-import formatted notes without losing content.
- Test keyboard shortcuts, selection handling, paste, and mobile use.
- Verify script tags and unsafe links render as harmless text or are
  rejected.

### 9.3 Pin and favourite notes

**Goal:** Keep frequently used notes easy to reach without destroying
manual ordering.

**Suggested data model:**

```js
{
  id: "unique-id",
  title: "Note title",
  pinned: false,
  favourite: false,
  sections: []
}
```

Keep `pinned` and `favourite` separate because they serve different
purposes:
- **Pinned:** controls placement. Pinned notes appear above unpinned
  notes, while preserving the existing relative/manual order within
  each group.
- **Favourite:** marks a note as important and supports a favourites
  filter or visual indicator; it should not silently change ordering.

Implementation notes:
- Pin/unpin and favourite/unfavourite should be independent actions.
- Reordering a note within a group should preserve its position relative
  to other notes in that group after save/reload.
- Define how completed notes interact with pinned notes. A sensible
  initial rule is to keep completed notes in the completed group, with
  pin ordering applied only within the active group.
- Ensure tag filters and favourites filters compose predictably.
- Include both fields in import/export; older notes default to `false`.
- Add accessible labels and visible state indicators to the controls.

Acceptance checks:
- Pin multiple notes and verify they appear first in their original
  relative order.
- Unpin a note and verify the remaining manual order is unchanged.
- Favourite/unfavourite without changing order.
- Verify pin/favourite state survives refresh and import/export.
- Test behavior with completed notes and active filters.

### 9.4 Version history and restore

**Goal:** Recover an earlier version of a note after accidental edits.

Implementation notes:
- Define a version as a snapshot of one note, including its title,
  tags, sections, completion state, and other user-editable fields.
- Store a timestamp and note ID with every snapshot. Do not snapshot
  transient UI state such as open panels or hover state.
- Create snapshots at meaningful checkpoints (for example, before a
  substantial edit is committed, or on a debounced interval), not on
  every keystroke. Avoid generating identical consecutive snapshots.
- Provide a version-history view showing timestamp and a preview; allow
  the user to inspect a version before restoring it.
- Restore safely: preserve the current content as a new version before
  applying the selected older snapshot. Ask for confirmation before
  replacing the current note.
- Set a retention policy (for example, a configurable maximum number
  of snapshots per note) so localStorage does not grow without bound.
  Consider IndexedDB if version data becomes large.
- Handle deleted notes and imported notes deliberately. Version history
  should not be silently lost during unrelated imports or migrations.
- Keep snapshots in a separate storage key/store from the live notes so
  they can be managed and pruned independently.

Acceptance checks:
- Edit a note several times and verify distinct snapshots are created.
- Restore an older snapshot and verify all note sections/content return.
- Verify the pre-restore current version remains recoverable.
- Verify identical content does not create duplicate snapshots.
- Test retention limits, storage failures, export/import policy, and
  deleting a note with history.

------------------------------------------------------------------------

## 10. Highest-priority risks

  ----------------------------------------------------------------------------
  Priority                Finding                      Why it matters
  ----------------------- ---------------------------- -----------------------
  Critical                Unescaped user content       Potential HTML/script
                          inserted into `innerHTML`    injection, especially
                          through `renderLinks()` /    with imported or edited
                          `renderMarkdown()` and other content
                          render paths                 

  High                    Import data is not fully     Bad files can corrupt
                          schema-validated             or replace existing
                                                       notes

  High                    Initial localStorage JSON    Corrupt storage can
                          parsing is not protected     prevent app startup

  High                    Drag-and-drop uses           Display order and saved
                          original-array indices while order can disagree
                          rendering a derived order    

  Medium                  `save()` runs on every       Unnecessary synchronous
                          editor input                 storage writes

  Medium                  Service worker immediately   Conflicts with a
                          calls `skipWaiting()`        user-controlled update
                                                       flow

  Medium                  Service worker deletes all   Can affect unrelated
                          other origin caches          apps on the same origin

  Medium                  Mouse-only resize and        Poor touch-device
                          scrollbar interactions       support

  Medium                  Async page-title fetch can   Stale asynchronous
                          update content after later   result can overwrite
                          edits                        newer content

  Low/Medium              `setToggleAllVisibility()`   Toggle All visibility
                          ignores `visible`            behavior is incorrect

  Low                     Duplicate                    Redundant work and
                          `updateToggleAllUI()` call   confusing code
  ----------------------------------------------------------------------------

**Security note:** The HTML injection concern should be addressed before
adding cloud sync or accepting notes from untrusted sources. Imported
JSON and clipboard HTML must be treated as untrusted.

------------------------------------------------------------------------

## 10. Recommended implementation roadmap

Work in small commits. Do not combine all refactors into one giant
change. The functional implementation checklist is consolidated at the end
of this document.


------------------------------------------------------------------------

## 11. Suggested future file structure

Do not restructure the project until the security and correctness fixes
are stable. When ready, a possible structure is:

``` text
notes-app/
├── index.html
├── styles.css
├── manifest.json
├── sw.js
├── app.js
├── js/
│   ├── state.js
│   ├── notes.js
│   ├── sections.js
│   ├── renderer.js
│   ├── editor.js
│   ├── markdown.js
│   ├── links.js
│   ├── dragdrop.js
│   ├── import-export.js
│   ├── theme.js
│   └── storage.js
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── tests/
│   ├── notes.test.js
│   ├── import-export.test.js
│   └── markdown.test.js
├── README.md
└── launch.sh
```

Possible module responsibilities:

-   `state.js`: shared app state and selected note ID.
-   `notes.js`: create, update, complete, delete, and reorder notes.
-   `sections.js`: create, update, complete, collapse, delete, and
    reorder sections.
-   `renderer.js`: build and update UI.
-   `editor.js`: content-editing behavior and paste handling.
-   `markdown.js`: safe Markdown-to-DOM rendering.
-   `links.js`: URL detection, validation, link editing, and tooltip
    behavior.
-   `dragdrop.js`: reorder interactions.
-   `import-export.js`: schema validation, migration, import, and
    export.
-   `theme.js`: theme selection and persistence.
-   `storage.js`: storage adapter, backup, and error handling.

------------------------------------------------------------------------

## 12. Testing guidance

The functional test checklist is consolidated at the end of this document.

------------------------------------------------------------------------

## 13. Recommended first implementation sequence

Start with these three tasks before touching architecture:

1.  **Fix unsafe HTML rendering.** This is the most important security
    issue.
2.  **Harden loading and importing data.** Protect existing notes from
    corrupt storage or invalid imports.
3.  **Fix ordering and Toggle All behavior.** These are user-visible
    correctness bugs.

After each task: - Make one focused change. - Test the relevant
checklist items. - Commit the change with a clear message. - Move to the
next task.

Suggested commit messages:

``` text
fix: safely render user-provided note content
fix: validate and recover stored notes
fix: validate imported notes before replacement
fix: correct note and section drag ordering
fix: correct toggle-all visibility
perf: debounce content persistence
fix: scope service worker cache cleanup
```

------------------------------------------------------------------------

## 14. Scope and limitations of this review

This document captures the code and behavior reviewed so far. It is a
static code review, not a complete browser-based test run or security
audit. Findings marked as potential issues should be verified in the
running app before changing behavior. In particular, test the
drag-and-drop behavior and PWA update flow on the actual deployment
target.

The repository has not been modified as part of preparing this document.

# Notes App – Visual Improvement Plan
## Continuation of the Code Review & Implementation Plan

**Design direction:** Linear-inspired  
**Scope:** Visual polish only. Preserve existing features, workflows, data model, LocalStorage format, and behaviour.

## 1. Design goals

- Give the app a polished developer-productivity look.
- Use a minimal, dark, Linear-inspired visual language.
- Improve hierarchy, spacing, typography, and consistency.
- Preserve the existing split-panel workflow and mobile behaviour.
- Prefer CSS changes; avoid a rewrite or unrelated features.

## 2. Suggested colour palette

| Purpose | Colour |
|---|---|
| Main background | `#17181C` |
| Surface / panel | `#202127` |
| Hover surface | `#282A32` |
| Selected surface | `#292938` |
| Border | `#30323B` |
| Primary text | `#E7E7EB` |
| Secondary text | `#A1A1AA` |
| Muted text | `#71717A` |
| Accent | `#8B7CF6` |

Use colour sparingly: green for completed, red for destructive/critical, amber for high priority, and neutral greys for most controls. Keep the light theme intentionally designed rather than simply inverted.

## 3. Compact sidebar / navigation

- Add a collapse/expand control.
- Expanded: icons and labels. Collapsed: icons only.
- Add tooltips for icon-only controls.
- Use consistent icon sizes and alignment.
- Highlight the active destination with a subtle surface and accent.
- Animate width changes smoothly.
- Preserve the current mobile full-screen navigation behaviour.

**Implementation note:** The current left panel is the notes list, not a separate navigation sidebar. Treat this as a compact-panel enhancement unless a separate navigation area is deliberately designed later. Do not hide existing help, import, export, or theme actions.

**Acceptance checks:** Collapse/expand without losing the selected note; note selection and drag-and-drop still work; tooltips are available; mobile remains usable.

## 4. Clean note list

- Use transparent or near-transparent row backgrounds by default.
- Prefer subtle separators and spacing over heavy cards.
- Keep row height, padding, and alignment consistent.
- Use a subtle hover background.
- Give the selected row a restrained background and thin accent indicator.
- Keep titles prominent; mute counts and dates.
- Reveal secondary actions on hover and keyboard focus.
- Keep actions visible on touch devices.
- Make completed notes quieter without reducing readability.

**Acceptance checks:** Normal, hover, selected, and completed states are distinguishable; long titles do not push actions out of alignment; delete controls work with touch and keyboard; drag-and-drop remains functional.

## 5. Priority indicators

Use small dots rather than large badges:
- Critical: red.
- High: amber.
- Medium: blue or purple.
- Low: muted grey.
- No priority: no dot.

The current note model may not contain priority. If introduced, make it optional and backward-compatible. Do not show decorative dots without meaningful priority data or a way to set it. Provide an accessible label or tooltip. Ensure import/export preserves the field if added.

## 6. Editor canvas

- Centre editor content within the detail panel.
- Use a comfortable maximum width of approximately 800–900px.
- Increase body line-height.
- Improve spacing between sections.
- Establish clearer heading sizes and weights.
- Give code blocks a distinct, low-contrast surface.
- Keep links recognisable without making them overly bright.
- Use the available width on smaller screens.

The current detail panel uses `.panel-content`, `.note`, `.note-title`, and `.note-content`. Scope styles carefully: `.note` is used in both the list and detail view.

**Acceptance checks:** Long notes remain comfortable to read; split-panel width remains usable; mobile content fits; editing, paste, links, and Markdown rendering behave as before.

## 7. Micro-interactions and motion

- Smooth hover and selected-state transitions.
- Subtle note-row selection feedback.
- Smooth section collapse/expand.
- Gentle modal and tooltip appearance.
- Consistent `:focus-visible` styling.
- Preserve existing note enter/exit animations.
- Keep transitions short, generally 120–200ms.
- Respect `prefers-reduced-motion: reduce`.

Do not delay typing or task switching. Drag-and-drop must remain responsive.

## 8. Typography, icons, and controls

Suggested starting point:
- Font: Inter or a system UI font stack.
- Note title: 14–16px, medium weight.
- Editor body: 14–15px with comfortable line-height.
- Secondary metadata: 11–12px.
- Section headings: 15–18px.

Use one consistent icon family (the app currently uses Bootstrap Icons). Align icon-only buttons and keep their hit areas usable. Use neutral styling for ordinary actions and reserve destructive colours for destructive actions. Keep keyboard focus visible. Avoid mixing emoji and unrelated icon styles in primary navigation.

## 9. Scrollbars, borders, and surfaces

- Use thin, low-contrast scrollbars.
- Make scrollbars more visible on hover where practical.
- Use subtle borders to separate panels and sections.
- Avoid excessive shadows and strong outlines.
- Use consistent corner radii.
- Keep the draggable panel divider discoverable but visually quiet.
- Check the custom scroll thumb and native scrollbar together to avoid confusing duplicate affordances.

## 10. Visual implementation checklist

The visual implementation checklist is consolidated at the end of this
document.

## 11. CSS starting point

This is a starting point, not a replacement stylesheet. Add it after existing rules and test each selector against the current DOM.

```css
/* Linear-inspired visual refresh */
:root {
  --bg: #17181c;
  --bg-card: #202127;
  --bg-hover: #282a32;
  --bg-active: #292938;
  --border: #30323b;
  --text: #e7e7eb;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent: #8b7cf6;
}

.panel-header {
  padding: 12px 16px;
  border-color: var(--border);
}

/* Minimal note rows */
#notesListContainer .note {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 9px 10px;
  margin-bottom: 3px;
  transition: background 180ms ease, border-color 180ms ease;
}

#notesListContainer .note:hover {
  background: var(--bg-hover);
}

#notesListContainer .note.note-active {
  background: var(--bg-active) !important;
  border: 1px solid #414052;
  border-left: 2px solid var(--accent);
}

/* Reveal destructive row actions on hover/focus */
#notesListContainer .note .btn-outline-danger {
  opacity: 0;
  transition: opacity 150ms ease;
}

#notesListContainer .note:hover .btn-outline-danger,
#notesListContainer .note:focus-within .btn-outline-danger {
  opacity: 1;
}

/* Keep actions available on touch devices */
@media (hover: none) {
  #notesListContainer .note .btn-outline-danger {
    opacity: 1;
  }
}

/* Centre note sections in the detail panel */
#notesDetailContainer > .note {
  max-width: 850px;
  width: 100%;
  margin: 0 auto 18px;
  padding: 16px 18px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 9px;
}

.note-title {
  font-size: 0.86rem;
  font-weight: 500;
}

.note-content {
  font-size: 0.9rem;
  line-height: 1.75;
  color: var(--text-secondary);
}

#notesDetailContainer .note {
  transition: border-color 200ms ease, background 200ms ease;
}

#notesDetailContainer .note:hover {
  border-color: #41434e;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

## 12. Regression guidance

The visual regression checklist is consolidated at the end of this document.

## 13. Scope and implementation rules

1. Do not rewrite `app.js` for a visual-only change.
2. Prefer CSS overrides before changing HTML or JavaScript.
3. Do not change the LocalStorage schema for visual styling.
4. Do not remove or rename existing IDs/classes used by JavaScript.
5. Do not alter note ordering, selection, editing, or completion behaviour.
6. Make one small change at a time and test before continuing.
7. Keep the existing light theme and mobile experience functional.
8. Do not add unrelated features during this visual-only pass.

**Definition of done:** The app looks more polished and consistent with Linear's visual language, while all existing functionality behaves as before.

------------------------------------------------------------------------

# End-of-document checklists

All actionable checklists are consolidated here. Functional work and
verification come first; visual implementation and regression checks
follow.

## Functional checklists

### Implementation roadmap

#### Phase 1 — Safety and data protection

- [x] 1. Add safe HTML escaping for note titles, section titles, and section content.
- [x] 2. Make Markdown and link rendering safe; validate URL protocols.
- [x] 3. Harden clipboard paste handling.
- [x] 4. Protect initial localStorage parsing with `try/catch`.
- [x] 5. Add a note/section schema validator and normalization function.
- [x] 6. Validate imports before replacing current notes.
- [x] 7. Back up existing notes before a successful import replacement.
- [x] 8. Handle localStorage quota and write failures without losing in-memory data.

#### Phase 2 — Correctness bugs

- [x] 9. Fix `setToggleAllVisibility()` so it actually shows/hides the button.
- [x] 10. Remove the duplicate `updateToggleAllUI()` call.
- [x] 11. Correct note drag-and-drop ordering when active/completed items are grouped.
- [x] 12. Correct section drag-and-drop ordering when active/completed sections are grouped.
- [ ] 13. Decide whether completed sections should have `completedAt`; implement consistently if needed.
- [x] 14. Prevent stale page-title fetches from changing content that the user has edited.
- [x] 15. Add safe handling for missing notes, missing sections, and invalid IDs.

#### Phase 3 — Persistence and performance

- [x] 16. Debounce content saves while typing.
- [x] 17. Keep immediate persistence for create/delete/complete/import operations.
- [ ] 18. Add export schema versioning and import migration.
- [ ] 19. Add export/import round-trip tests.
- [ ] 20. Evaluate IndexedDB for larger note collections.

#### Phase 4 — Interaction and accessibility

- [x] 21. Replace mouse-only resize handling with Pointer Events.
- [x] 22. Replace mouse-only scrollbar dragging with Pointer Events, or use the native scrollbar.
- [x] 23. Add keyboard alternatives for drag-and-drop.
- [x] 24. Add accessible names and focus states to icon-only controls.
- [x] 25. Improve modal focus management and keyboard behavior.
- [x] 26. Test mobile editing, link interactions, and panel layout.

#### Phase 5 — PWA reliability

- [x] 27. Use app-specific cache names and delete only this app's old caches.
- [ ] 28. Decide and implement one service-worker update policy.
- [ ] 29. Precache required local assets and icons.
- [ ] 30. Add an offline fallback for navigation requests if appropriate.
- [ ] 31. Test fresh install, update, offline launch, and cache cleanup.

#### Phase 6 — Maintainability

- [x] 32. Extract CSS from `index.html` into `styles.css`.
- [x] 33. Split `app.js` into smaller modules.
- [ ] 34. Add tests for data operations, import validation, ordering, and rendering helpers.
- [ ] 35. Update the README with setup, architecture, data format, and known limitations.

#### Phase 7 — Requested product features

- [ ] 36. Add note tags (`Work`, `Personal`, `Learning`, `Projects`), tag normalization, multi-tag assignment, and tag filters.
- [ ] 37. Extend the editor with checklists, bullet lists, numbered lists, code blocks, and formatted text while keeping rendering safe.
- [ ] 38. Add independent pin and favourite states; pinned notes go above unpinned notes while preserving manual order within groups.
- [ ] 39. Add per-note version snapshots, history preview, restore, retention limits, and storage-failure handling.
- [ ] 40. Extend import/export migrations and tests for tags, pinning, favourites, rich content, and version-history policy.
- [ ] 41. Remember the currently open note across reloads using browser storage only; do not include this UI state in JSON exports or imports.

### Functional test checklist

#### Data and persistence

- [ ] Create, edit, complete, reopen, and delete a note.
- [ ] Create, edit, collapse, complete, reopen, and delete a section.
- [ ] Refresh the page and verify all changes persist.
- [ ] Test with empty local storage.
- [ ] Test with malformed local storage JSON.
- [ ] Test storage quota/write failure handling.

#### Import/export

- [ ] Export notes and import the same file.
- [ ] Import an empty notes array.
- [ ] Import a valid older-format file.
- [ ] Import malformed JSON.
- [ ] Import structurally invalid notes and sections.
- [ ] Confirm a failed import does not destroy current notes.

#### Security and ordering

- [ ] Add text containing `<script>` and verify it is displayed as text, not executed.
- [ ] Test HTML-like text in note titles, section titles, and section bodies.
- [ ] Test malicious or unsupported URL protocols.
- [ ] Paste clipboard content containing HTML and scripts.
- [ ] Reorder active and completed notes and sections.
- [ ] Try dragging across the active/completed divider.
- [ ] Refresh and verify the order remains correct.

#### New features, PWA, and mobile

- [ ] Test tags, rich editor content, pinning, favourites, and version history when those features are implemented.
- [ ] Install the app and launch it offline.
- [ ] Deploy a new version and test the update flow and app-cache cleanup.
- [ ] Test on a phone: editing, scrolling, resizing, and link actions.

## Visual checklists

### Visual implementation checklist

#### Palette and themes

- [ ] Apply the approved Linear-inspired palette to the dark and light themes.
- [ ] Review contrast and readability in both themes.
- [ ] Keep green, red, amber, and accent colours reserved for their intended semantic states.

#### Typography, spacing, and layout

- [x] Establish a consistent system font stack, typography scale, spacing, borders, and corner radii.
- [ ] Keep the existing split-panel workflow and mobile behaviour unchanged.
- [ ] Keep the existing data model and LocalStorage format unchanged.

#### Notes list

- [ ] Make default note rows transparent or near-transparent with consistent height, padding, and alignment.
- [ ] Add restrained hover and selected states, including a thin accent indicator for the selected note.
- [ ] Keep note titles prominent while muting counts and dates.
- [ ] Reveal secondary row actions on hover and keyboard focus, while keeping them visible on touch devices.
- [ ] Make completed notes quieter without harming readability.
- [ ] Verify long titles keep actions aligned and note drag-and-drop still works.

#### Editor and sections

- [ ] Centre detail content with a responsive maximum width of approximately 800–900px.
- [ ] Improve editor line-height, section spacing, heading hierarchy, and code-block surfaces.
- [ ] Keep links recognisable without making them overly bright.
- [ ] Use the available detail-panel width on smaller screens.
- [ ] Verify editing, paste, links, Markdown rendering, section collapse, and section drag-and-drop are unchanged.

#### Buttons, motion, and surfaces

- [ ] Style ordinary, destructive, and icon-only controls consistently without reducing their usable hit areas.
- [ ] Use a single icon family with aligned icon-only buttons and neutral styling for ordinary actions.
- [x] Add short, subtle transitions and a `prefers-reduced-motion: reduce` fallback.
- [ ] Keep drag-and-drop responsive and preserve current note enter/exit animations.
- [ ] Use thin, low-contrast scrollbars and keep the divider discoverable but visually quiet.

#### Optional features

- [ ] Add a compact/collapsible left-panel presentation without hiding existing actions, if approved.
- [ ] Add priority indicators only after approving an optional, backward-compatible priority field.

### Visual regression checklist

- [ ] Create, rename, select, complete, and delete notes.
- [ ] Create, edit, collapse, complete, reorder, and delete sections.
- [ ] Verify note and section drag-and-drop, split-panel resizing, mobile navigation, and editing.
- [ ] Verify import/export, dark/light themes, tooltips, modals, keyboard focus, and touch access to actions.
- [ ] Confirm normal, hover, selected, completed, focus, and touch states.
- [ ] Confirm no text is clipped at narrow widths or browser zoom.

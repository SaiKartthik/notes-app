# 📝 Notes App

A minimal **note-taking web app with sections**, inspired by Google Keep / Notes, but built from scratch using plain **HTML, JavaScript, and Bootstrap**.

TODO:
- Keyboard shortcuts
- Integrate cloud
- multiple notes
- Migrate storage from localStorage to IndexedDB (remove ~5MB cap)

{v0.8} Supernova
- Empty section content shows "Click to write..." placeholder with min-height
- Link hover tooltip (Open ↗ / Edit ✎) extended to all elements: note titles, section headers, detail panel title, section content
- editLink modal works across all elements via callbacks — edit both display text and URL
- Double-clicking a note title now selects all text for instant replace
- Help button (?) added left of Export — opens a user-friendly guide covering all interactions
- Paste URL auto-fetches page title in background and replaces with [title](url)
- Fix: Clicking inside a card while title is in edit mode no longer reopens the note
- Fix: Rich paste (copied hyperlink) preserves anchor display text as [text](url)
- Fix: Import error messages now distinguish: quota exceeded, invalid JSON, other errors

{v0.7} Nova
- Light / dark theme toggle (☀/🌙) with preference saved to localStorage
- Draggable divider between left and right panels (20%–80% range)
- Panel split position saved to localStorage and included in export JSON
- Markdown hyperlink support: [display text](url) in note content and titles
- Mobile back button now returns to note list instead of closing the tab (History API)
- Completed notes sorted by completion date (most recent first)
- Drag and drop fixed: items can now be dragged to any position freely

{v0.6} New Experience
- Replaced page navigation with animated side-by-side split panel (50/50)
- Clicking a note slides the detail panel in; ✕ closes it back
- New color theme: background #0e0d12, cards #1a1a20, selected/hover #131317
- Mobile: full-screen page slide animation instead of split panel (≤768px)
- Created date (DD.MM) shown in yellow at the end of each note title
- Section count shown in the note title
- Slide-out/slide-in animation when switching between notes
- Export always downloads all notes regardless of which note is open
- Import robustness: error handling, single-note file support, file input reset

{v0.5} New Style
- Auto-detect and render clickable links in all text
- Completed sections sink to bottom with a divider (matching page 1 behaviour)
- Section title character limit increased from 50 to 100
- UI Improvements

{v0.4} PWA 
- PWA Application 
- Fix broken animations

{v0.3} All Good
- Set drag area to title only
- Support for mobile
- Improve animations
- Toggle button to expand and collapse all notes

{v0.2} UI Improvements
- Collapse and expand
- Drag and drop
- Edit title and limited to only one line
- Press enter to go to text section
- Bug fixes

{v0.1} Alpha
- Add sections
- Add full width
- Save to local storage
- Import/export json files

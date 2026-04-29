# 📝 Notes App

A minimal **note-taking web app with sections**, inspired by Google Keep / Notes, but built from scratch using plain **HTML, JavaScript, and Bootstrap**.

TODO:
- Keyboard shortcuts
- Integrate cloud
- multiple notes

{v0.6} Split Panel & Polish
- Replaced page navigation with animated side-by-side split panel (50/50)
- Clicking a note slides the detail panel in; ✕ closes it back
- Replaced Add button with an inline text input — type a title and press Enter to add
- Add Section button moved to right panel header
- New color theme: background #0e0d12, cards #1a1a20, selected/hover #131317
- Decreased card padding and margin for a denser layout
- Title font size matched to content size (0.78rem)
- Right panel heading size reduced
- Delete and action buttons made smaller in both panels
- Mobile: full-screen page slide animation instead of split panel (≤768px)
- Created date (DD.MM) shown in yellow at the end of each note title
- Completion date replaces created date when a note is marked complete
- Section count shown in cyan next to the note title
- Auto-strip trailing newlines from section content on blur

{v0.5} UI & UX Improvements
- Auto-detect and render clickable links in all text (titles, section headers, note content, page 2 page title)
- Section headers in page 2 now have a complete/incomplete toggle (red checkmark)
- Completed sections sink to bottom with a divider (matching page 1 behaviour)
- Thicker separator line (2px) between section header and content in page 2
- Increased font size across landing page and page 2 section titles (0.95rem)
- Section title character limit increased from 50 to 100
- Single-click delay tuned to 250ms
- Removed red status dot from landing page note cards
- Checkmark colour changed from green to red (#e53935)
- Reduced card padding and overall margins for a denser layout

{v0.4} PWA 
- PWA Application 
- Fix broken animations

{v0.3} Support for mobile
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

{v0.1}
- Add sections
- Add full width
- Save to local storage
- Import/export json files

import { MAX_PASTE_LENGTH, getImportData, isValidId, moveItem, uid } from "./js/data.js";
import { normalizeHttpUrl, renderLinks, renderMarkdown } from "./js/formatting.js";
import {
  isQuotaError,
  loadNotes,
  loadStoredString,
  persistNotes,
  persistStoredString,
  removeStoredValue,
  replaceNotesFromImport
} from "./js/storage.js";

const CONTENT_SAVE_DELAY_MS = 500;
const CURRENT_NOTE_STORAGE_KEY = "notes-current-note-id";

let storageErrorShown = false;
let contentSaveTimer = null;
let notes = loadNotes();
let currentNoteId = loadCurrentNoteId();
let noteSearchQuery = "";

let container;
const listContainer   = document.getElementById("notesListContainer");
const detailContainer = document.getElementById("notesDetailContainer");
const panelLeft       = document.getElementById("panelLeft");
const panelRight      = document.getElementById("panelRight");
const resizeHandle    = document.getElementById("resizeHandle");
const scrollThumb     = document.getElementById("scrollThumb");
const toggleAllIcon   = document.getElementById("toggleAllIcon");
const toggleAllText   = document.getElementById("toggleAllText");

function findNoteById(id) {
  if (!isValidId(id)) return null;
  const note = notes.find((candidate) => candidate?.id === id);
  return note && Array.isArray(note.sections) ? note : null;
}

function loadCurrentNoteId() {
  const savedId = loadStoredString(CURRENT_NOTE_STORAGE_KEY);
  if (savedId && findNoteById(savedId)) return savedId;
  if (savedId) removeStoredValue(CURRENT_NOTE_STORAGE_KEY);
  return null;
}

function setCurrentNoteId(noteId) {
  currentNoteId = noteId;
  if (noteId === null) {
    removeStoredValue(CURRENT_NOTE_STORAGE_KEY);
  } else {
    persistStoredString(CURRENT_NOTE_STORAGE_KEY, noteId);
  }
}

function announce(message) {
  document.getElementById("announcements").textContent = message;
}

function focusByDataAttribute(selector, attribute, value) {
  requestAnimationFrame(() => {
    const element = Array.from(document.querySelectorAll(selector))
      .find((candidate) => candidate.dataset[attribute] === value);
    element?.focus();
  });
}

function moveNoteWithKeyboard(note, direction) {
  if (!note || note.completed) {
    announce("Completed notes are sorted automatically and cannot be reordered.");
    return;
  }
  const group = notes.filter((candidate) => candidate.completed === note.completed);
  const groupIndex = group.indexOf(note);
  const target = group[groupIndex + direction];
  if (!target) {
    announce(`Note is already at the ${direction < 0 ? "top" : "bottom"} of its group.`);
    return;
  }
  moveItem(notes, notes.indexOf(note), notes.indexOf(target));
  save();
  render();
  focusByDataAttribute("#notesListContainer .note[data-id]", "id", note.id);
  announce(`Moved note ${direction < 0 ? "up" : "down"}.`);
}

function moveSectionWithKeyboard(note, section, direction) {
  if (!note || !Array.isArray(note.sections) || !section || !isValidId(section.id)) return;
  const group = note.sections.filter((candidate) => candidate.completed === section.completed);
  const groupIndex = group.indexOf(section);
  const target = group[groupIndex + direction];
  if (!target) {
    announce(`Section is already at the ${direction < 0 ? "top" : "bottom"} of its group.`);
    return;
  }
  moveItem(note.sections, note.sections.indexOf(section), note.sections.indexOf(target));
  save();
  render();
  focusByDataAttribute(".section-drag-handle", "sectionId", section.id);
  announce(`Moved section ${direction < 0 ? "up" : "down"}.`);
}

function setToggleAllVisibility(visible, disabled = false) {
  const btn = document.getElementById("toggleAll");
  if (!btn) return;
  btn.hidden = !visible;
  btn.disabled = !visible || disabled;
  btn.style.opacity = btn.disabled ? "0.4" : "1";
}

function reportStorageError(error) {
  console.error("Unable to save notes:", error);
  if (storageErrorShown) return;
  storageErrorShown = true;
  const reason = isQuotaError(error)
    ? "Browser storage is full."
    : "Browser storage is unavailable.";
  alert(`${reason} Your changes are still visible, but they will not persist until storage is available.`);
}

function reportImportStorageError(error) {
  console.error("Unable to import notes:", error);
  const reason = isQuotaError(error)
    ? "Browser storage is full."
    : "Browser storage is unavailable.";
  alert(`Import failed: ${reason} Your current notes were not replaced.`);
}

function save() {
  const saved = persistNotes(notes, { onError: reportStorageError });
  if (saved) storageErrorShown = false;
  return saved;
}

function scheduleContentSave() {
  if (contentSaveTimer !== null) clearTimeout(contentSaveTimer);
  contentSaveTimer = setTimeout(() => {
    contentSaveTimer = null;
    save();
  }, CONTENT_SAVE_DELAY_MS);
}

function flushContentSave() {
  if (contentSaveTimer === null) return;
  clearTimeout(contentSaveTimer);
  contentSaveTimer = null;
  save();
}

window.addEventListener("pagehide", flushContentSave);

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}


/* ---------------- RENDER ---------------- */

function render() {
  const currentNote = findNoteById(currentNoteId);
  if (currentNoteId !== null && !currentNote) {
    setCurrentNoteId(null);
  }

  container = listContainer;
  container.innerHTML = "";
  renderRoot();

  if (currentNoteId !== null) {
    if (!history.state?.noteOpen) {
      history.pushState({ noteOpen: true }, "");
    }
    container = detailContainer;
    container.innerHTML = "";
    detailContainer.classList.add("note-enter");
    setTimeout(() => detailContainer.classList.remove("note-enter"), 180);
    document.getElementById("detailTitle").innerHTML = renderLinks(
      currentNote.title
    );
    renderNoteView(currentNoteId);
    panelLeft.classList.add("split");
    panelRight.classList.add("open");
    resizeHandle.classList.add("active");
    const savedSplit = parseFloat(localStorage.getItem("panelSplit"));
    if (!isNaN(savedSplit)) {
      setPanelSplit(savedSplit);
    }
  } else {
    panelLeft.classList.remove("split");
    panelRight.classList.remove("open");
    resizeHandle.classList.remove("active");
    panelLeft.style.width = "";
    panelRight.style.width = "";
    detailContainer.innerHTML = "";
    document.getElementById("detailTitle").innerHTML = "";
  }
  requestAnimationFrame(updateScrollThumb);
}

/* -------- ROOT VIEW (FOLDERS) -------- */

function renderRoot() {
  const query = noteSearchQuery.trim().toLocaleLowerCase();
  const visibleNotes = query
    ? notes.filter((note) => {
      const sections = Array.isArray(note.sections) ? note.sections : [];
      const text = [note.title, ...sections.flatMap((section) => [section?.title, section?.content])]
        .filter((value) => typeof value === "string")
        .join(" ")
        .toLocaleLowerCase();
      return text.includes(query);
    })
    : notes;

  if (visibleNotes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-center mt-5";
    empty.style.color = "#aaa";
    empty.innerHTML = `
      <div style="font-size:1.2rem">${query ? "🔎 No matching notes" : "📂 No notes yet"}</div>
      <div class="small mt-1">${query ? "Try a different search term" : "Click + to create your first note"}</div>
    `;
    container.appendChild(empty);
    setToggleAllVisibility(false);
    return;
  }

  container.innerHTML = "";

  const active = visibleNotes.filter(n => !n.completed);
  const done = visibleNotes.filter(n => n.completed)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const ordered = [...active, ...done];
  let dividerAdded = false;

  ordered.forEach(note => {
    if (!dividerAdded && note.completed && active.length > 0) {
      const divider = document.createElement("div");
      divider.className = "completed-divider";
      divider.innerText = "Completed";
      container.appendChild(divider);
      dividerAdded = true;
    }

    const card = document.createElement("section");
    card.className = "note d-flex justify-content-between align-items-center gap-2";
    if (note.completed) card.classList.add("note-completed");
    card.style.cursor = "pointer";
    card.draggable = !note.completed && !query;
    card.tabIndex = 0;
    card.setAttribute("aria-label", `${note.title}. Press Enter to open. Press Alt and Up or Down Arrow to reorder.`);
    card.setAttribute("aria-keyshortcuts", "Enter Alt+ArrowUp Alt+ArrowDown");
    card.dataset.id = note.id;
    if (note.id === currentNoteId) card.classList.add("note-active");

    let singleClickTimer = null;

    card.onclick = () => {
      if (title.contentEditable === "true") return;
      if (singleClickTimer !== null) return;
      singleClickTimer = setTimeout(() => {
        singleClickTimer = null;
        if (currentNoteId !== null && currentNoteId !== note.id) {
          detailContainer.classList.remove("note-enter");
          detailContainer.classList.add("note-exit");
          setTimeout(() => {
            detailContainer.classList.remove("note-exit");
            setCurrentNoteId(note.id);
            render();
          }, 180);
        } else {
          setCurrentNoteId(note.id);
          render();
        }
      }, 250);
    };

    card.addEventListener("keydown", (e) => {
      if (e.target !== card) return;
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        if (query) {
          announce("Clear the search before reordering notes.");
          return;
        }
        moveNoteWithKeyboard(note, e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        card.click();
      }
    });

    card.addEventListener("dragstart", () => {
      card.classList.add("opacity-50");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("opacity-50");
      save();
      render();
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".opacity-50");
      if (!dragging || dragging === card) return;
      const draggedNote = findNoteById(dragging.dataset.id);
      if (!draggedNote || draggedNote.completed || note.completed) return;
      const from = notes.indexOf(draggedNote);
      const to = notes.indexOf(note);
      if (!moveItem(notes, from, to)) return;
      card.parentNode.insertBefore(dragging, from < to ? card.nextSibling : card);
    });

    // Checkbox
    const checkBtn = document.createElement("button");
    checkBtn.className = "check-btn flex-shrink-0" + (note.completed ? " checked" : "");
    checkBtn.title = note.completed ? "Mark incomplete" : "Mark complete";
    checkBtn.setAttribute("aria-label", note.completed ? "Mark note incomplete" : "Mark note complete");
    checkBtn.innerHTML = note.completed
      ? `<i class="bi bi-check-circle-fill"></i>`
      : `<i class="bi bi-circle"></i>`;

    checkBtn.onclick = (e) => {
      e.stopPropagation();
      note.completed = !note.completed;
      note.completedAt = note.completed ? Date.now() : null;
      save();
      render();
    };


    // Folder title
    const title = document.createElement("div");
    title.className = "note-title flex-grow-1";
    title.innerHTML = renderLinks(note.title);
    title.style.cursor = "default";

    title.ondblclick = (e) => {
      e.stopPropagation();
      clearTimeout(singleClickTimer);
      singleClickTimer = null;
      title.innerText = note.title;
      title.contentEditable = true;
      title.style.cursor = "text";
      title.focus();
      const range = document.createRange();
      range.selectNodeContents(title);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };

    let originalTitle = note.title;

    title.onfocus = () => {
      originalTitle = title.innerText;
    };

    title.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        title.blur();
      }
      if (e.key === "Escape") {
        title.innerText = originalTitle;
        title.blur();
      }
    };

    title.onblur = () => {
      title.contentEditable = false;
      const newTitle = title.innerText.trim();
      if (newTitle === "") {
        title.innerHTML = renderLinks(originalTitle);
        return;
      }
      note.title = newTitle;
      save();
      title.innerHTML = renderLinks(note.title);
    };

    attachLinkTooltip(title, (oldText, href) => {
      editLink(oldText, href,
        () => note.title,
        (v) => { note.title = v; },
        () => { title.innerHTML = renderLinks(note.title); }
      );
    });

    // Right-side actions
    const right = document.createElement("div");
    right.className = "d-flex align-items-center gap-2 flex-shrink-0";

    const count = document.createElement("span");
    count.className = "note-count small";
    count.innerText = `${note.sections.length}`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-outline-danger btn-sm icon-btn";
    deleteBtn.title = "Delete note";
    deleteBtn.setAttribute("aria-label", "Delete note");
    deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (deleteBtn.dataset.confirm === "true") {
        notes = notes.filter(n => n.id !== note.id);
        save();
        render();
        return;
      }
      deleteBtn.dataset.confirm = "true";
      deleteBtn.innerHTML = `<i class="bi bi-check"></i>`;
      deleteBtn.classList.remove("btn-outline-danger");
      deleteBtn.classList.add("btn-danger");
      setTimeout(() => {
        deleteBtn.dataset.confirm = "false";
        deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;
        deleteBtn.classList.remove("btn-danger");
        deleteBtn.classList.add("btn-outline-danger");
      }, 2000);
    };

    const dateLabel = document.createElement("span");
    dateLabel.className = "note-date";
    dateLabel.innerText = note.completed
      ? formatDate(note.completedAt)
      : formatDate(note.createdAt);

    right.append(dateLabel, count, deleteBtn);
    card.append(checkBtn, title, right);
    container.appendChild(card);
  });

  setToggleAllVisibility(false);
}


/* -------- NOTE VIEW (SECTIONS) -------- */

function renderNoteView(noteId) {
  const note = findNoteById(noteId);
  if (!note) return;

  if (note.sections.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-center mt-5";
    empty.style.color = "#aaa";
    empty.innerHTML = `
      <div style="font-size:1.2rem">📄 No sections yet</div>
      <div class="small mt-1">Click + to add your first section</div>
    `;
    container.appendChild(empty);
    setToggleAllVisibility(true, true);
    return;
  }

  const activeSections = note.sections.filter(s => !s.completed);
  const doneSections = note.sections.filter(s => s.completed);
  const orderedSections = [...activeSections, ...doneSections];
  let sectionDividerAdded = false;

  orderedSections.forEach(section => {
    if (!sectionDividerAdded && section.completed && activeSections.length > 0) {
      const divider = document.createElement("div");
      divider.className = "completed-divider";
      divider.innerText = "Completed";
      container.appendChild(divider);
      sectionDividerAdded = true;
    }
    renderSection(note, section);
  });

  const sectionCount = note.sections.length;

  setToggleAllVisibility(true, sectionCount <= 1);
  updateToggleAllUI(sectionCount > 0 && note.sections.every(s => s.collapsed));

}

/* -------- SECTION -------- */

function renderSection(note, section) {
  if (!note || !Array.isArray(note.sections) || !section || !isValidId(section.id)) return;
  const sec = document.createElement("section");
sec.className = "note";
sec.dataset.sectionId = section.id;

  sec.dataset.id = section.id;

  const header = document.createElement("div");
  header.className = "section-drag-handle d-flex justify-content-between align-items-center";
  header.draggable = true;
  header.tabIndex = 0;
  header.dataset.sectionId = section.id;
  header.setAttribute("aria-label", `${section.title || "Untitled Section"}. Press Alt and Up or Down Arrow to reorder.`);
  header.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
  header.style.cursor = "grab";
  header.addEventListener("dragstart", () => {
    sec.classList.add("opacity-50");
  });
  
  header.addEventListener("dragend", () => {
    sec.classList.remove("opacity-50");
    save();
    render();
  });

  header.addEventListener("keydown", (e) => {
    if (e.target !== header || !e.altKey) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      moveSectionWithKeyboard(note, section, e.key === "ArrowUp" ? -1 : 1);
    }
  });

sec.addEventListener("dragover", (e) => {
  e.preventDefault();
  const dragging = document.querySelector(".opacity-50");
  if (!dragging || dragging === sec) return;
  const draggedSection = note.sections.find((candidate) => candidate?.id === dragging.dataset.id);
  if (!draggedSection || draggedSection.completed !== section.completed) return;
  const from = note.sections.indexOf(draggedSection);
  const to = note.sections.indexOf(section);
  if (!moveItem(note.sections, from, to)) return;
  sec.parentNode.insertBefore(dragging, from < to ? sec.nextSibling : sec);
});

  if (section.completed) sec.classList.add("note-completed");

  const sectionCheckBtn = document.createElement("button");
  sectionCheckBtn.className = "check-btn flex-shrink-0" + (section.completed ? " checked" : "");
  sectionCheckBtn.title = section.completed ? "Mark incomplete" : "Mark complete";
  sectionCheckBtn.setAttribute("aria-label", section.completed ? "Mark section incomplete" : "Mark section complete");
  sectionCheckBtn.innerHTML = section.completed
    ? `<i class="bi bi-check-circle-fill"></i>`
    : `<i class="bi bi-circle"></i>`;

  sectionCheckBtn.onclick = (e) => {
    e.stopPropagation();
    section.completed = !section.completed;
    save();
    render();
  };

  const title = document.createElement("div");
title.className = "note-title";
title.contentEditable = false;
title.innerHTML = renderLinks(section.title || "Untitled Section");
title.style.cursor = "default";

title.ondblclick = (e) => {
  e.stopPropagation();
  title.innerText = section.title || "Untitled Section";
  title.contentEditable = true;
  title.style.cursor = "text";
  title.focus();
  const range = document.createRange();
  range.selectNodeContents(title);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
};

// Enforce single line + max 50 chars
title.oninput = () => {
  let text = title.innerText.replace(/\n/g, ""); // remove newlines

  if (text.length > 100) {
    text = text.slice(0, 100);
  }

  // Avoid cursor jump if no change
  if (title.innerText !== text) {
    title.innerText = text;

    // place caret at end
    const range = document.createRange();
    range.selectNodeContents(title);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  section.title = text;
  save();
};

// Prevent Enter from creating new line
title.onkeydown = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    title.blur();

    // Move focus to content editor
    requestAnimationFrame(() => {
      content.focus();
    });
  }
  if (e.key === "Escape") {
    title.blur();
  }
};

title.onblur = () => {
  title.contentEditable = false;
  title.style.cursor = "default";
  title.innerHTML = renderLinks(section.title || "Untitled Section");
};

attachLinkTooltip(title, (oldText, href) => {
  editLink(oldText, href,
    () => section.title || "",
    (v) => { section.title = v; },
    () => { title.innerHTML = renderLinks(section.title || "Untitled Section"); }
  );
});


  const actions = document.createElement("div");
  actions.className = "note-actions";

  const deleteBtn = document.createElement("button");
deleteBtn.className = "btn btn-outline-danger btn-sm icon-btn";
deleteBtn.title = "Delete section";
deleteBtn.setAttribute("aria-label", "Delete section");
deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;

deleteBtn.onclick = () => {
  if (deleteBtn.dataset.confirm === "true") {
    note.sections = note.sections.filter(s => s.id !== section.id);
    save();
    render();
    return;
  }

  deleteBtn.dataset.confirm = "true";
  deleteBtn.innerHTML = `<i class="bi bi-check"></i>`;
  deleteBtn.classList.remove("btn-outline-danger");
  deleteBtn.classList.add("btn-danger");

  setTimeout(() => {
    deleteBtn.dataset.confirm = "false";
    deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;
    deleteBtn.classList.remove("btn-danger");
    deleteBtn.classList.add("btn-outline-danger");
  }, 2000);
};

actions.appendChild(deleteBtn);


  const collapseBtn = document.createElement("button");
  collapseBtn.className = "btn btn-outline-light btn-sm icon-btn";
  collapseBtn.title = section.collapsed ? "Expand" : "Collapse";
  collapseBtn.setAttribute("aria-label", section.collapsed ? "Expand section" : "Collapse section");

  const icon = document.createElement("i");
  icon.className = section.collapsed ? "bi bi-chevron-down" : "bi bi-chevron-up";
  collapseBtn.appendChild(icon);

  collapseBtn.onclick = () => {
    section.collapsed = !section.collapsed;
    content.style.display = section.collapsed ? "none" : "block";
    icon.className = section.collapsed ? "bi bi-chevron-down" : "bi bi-chevron-up";
    collapseBtn.title = section.collapsed ? "Expand" : "Collapse";
    collapseBtn.setAttribute("aria-label", section.collapsed ? "Expand section" : "Collapse section");
    save();
  };

  actions.appendChild(collapseBtn);
  const headerLeft = document.createElement("div");
  headerLeft.className = "d-flex align-items-center gap-2";
  header.style.borderBottom = "2px solid #3a3a3a";
  header.style.paddingBottom = "10px";
  header.style.marginBottom = "2px";
  headerLeft.append(sectionCheckBtn, title);
  header.append(headerLeft, actions);

  const content = document.createElement("div");
  content.className = "note-content";
  content.contentEditable = false;
  content.style.display = section.collapsed ? "none" : "block";
  content.style.cursor = "text";
  content.innerHTML = renderMarkdown(section.content);

  const enterEditMode = (e) => {
    if (content.contentEditable === "true") return;
    if (e && e.target.closest("a[href]")) return;
    const scrollTop = detailContainer.scrollTop;
    content.innerText = section.content;
    content.contentEditable = true;
    content.focus({ preventScroll: true });
    const range = document.caretRangeFromPoint?.(e?.clientX, e?.clientY);
    if (range) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
    detailContainer.scrollTop = scrollTop;
    requestAnimationFrame(() => { detailContainer.scrollTop = scrollTop; });
  };

  content.addEventListener("click", enterEditMode);

  content.oninput = () => {
    section.content = content.innerText;
    scheduleContentSave();
  };

  content.addEventListener("paste", (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");

    if (plain.length > MAX_PASTE_LENGTH || html.length > MAX_PASTE_LENGTH) {
      alert(`Paste is limited to ${MAX_PASTE_LENGTH.toLocaleString()} characters.`);
      return;
    }

    if (html) {
      const tmp = new DOMParser().parseFromString(html, "text/html");
      const anchors = tmp.querySelectorAll("a[href]");
      if (anchors.length > 0) {
        const text = Array.from(anchors).map(a => {
          const href = normalizeHttpUrl(a.getAttribute("href"));
          const label = a.textContent.trim() || href;
          if (!href) return label;
          return label === href ? href : `[${label}](${href})`;
        }).join(" ");
        document.execCommand("insertText", false, text);
        section.content = content.innerText;
        save();
        return;
      }
    }

    const pastedText = plain.trim();
    const pastedUrl = /^https?:\/\/\S+$/.test(pastedText) ? normalizeHttpUrl(pastedText) : null;
    if (pastedUrl) {
      document.execCommand("insertText", false, pastedUrl);
      section.content = content.innerText;
      save();

      fetch(pastedUrl, { credentials: "omit", referrerPolicy: "no-referrer" })
        .then(r => r.text())
        .then(pageHtml => {
          const title = new DOMParser().parseFromString(pageHtml, "text/html").title.trim().replace(/\s+/g, " ");
          if (title && title !== pastedUrl) {
            section.content = section.content.replace(pastedUrl, `[${title}](${pastedUrl})`);
            save();
          }
        })
        .catch(() => {});
      return;
    }

    document.execCommand("insertText", false, plain);
    section.content = content.innerText;
    save();
  });

  attachLinkTooltip(content, (oldText, href) => {
    editLink(oldText, href,
      () => section.content,
      (v) => { section.content = v; },
      () => { content.innerHTML = renderMarkdown(section.content); }
    );
  });

  content.onblur = () => {
    content.contentEditable = false;
    section.content = content.innerText.replace(/[\n\r]+$/, "");
    flushContentSave();
    content.innerHTML = renderMarkdown(section.content);
  };

  sec.append(header, content);
  container.appendChild(sec);
}

/* -------- BUTTONS -------- */
const searchBtn = document.getElementById("searchBtn");
const searchBar = document.getElementById("searchBar");
const searchNotes = document.getElementById("searchNotes");

function setSearchOpen(open) {
  searchBar.hidden = !open;
  searchBtn.setAttribute("aria-expanded", String(open));
  if (open) {
    requestAnimationFrame(() => searchNotes.focus());
  } else {
    noteSearchQuery = "";
    searchNotes.value = "";
    render();
  }
}

searchBtn.onclick = () => setSearchOpen(searchBar.hidden);

searchNotes.addEventListener("input", () => {
  noteSearchQuery = searchNotes.value;
  render();
});

searchNotes.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  e.preventDefault();
  setSearchOpen(false);
  searchBtn.focus();
});

const addNoteInput = document.getElementById("addNoteInput");

function createNoteFromInput() {
  const title = addNoteInput.value.trim();
  if (!title) {
    addNoteInput.focus();
    return;
  }

  const newNote = {
    id: uid(),
    title,
    sections: [],
    completed: false,
    createdAt: Date.now()
  };

  notes.unshift(newNote);
  save();
  addNoteInput.value = "";
  render();
  addNoteInput.focus();
}

addNoteInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  createNoteFromInput();
});

document.getElementById("addNoteBtn").onclick = createNoteFromInput;

document.getElementById("closeDetail").onclick = () => {
  if (history.state?.noteOpen) {
    history.back();
  } else {
    setCurrentNoteId(null);
    render();
  }
};

window.addEventListener("popstate", () => {
  if (currentNoteId !== null) {
    setCurrentNoteId(null);
    render();
  }
});

document.getElementById("addSectionBtn").onclick = () => {
  const note = findNoteById(currentNoteId);
  if (!note) return;

  const newSection = {
    id: uid(),
    title: "New Section",
    content: "",
    collapsed: false,
    completed: false
  };

  note.sections.unshift(newSection);
  save();
  render();

  requestAnimationFrame(() => {
    const sectionEl = document.querySelector(
      `.note[data-section-id="${newSection.id}"]`
    );
    if (!sectionEl) return;
    const titleEl = sectionEl.querySelector(".note-title");
    if (!titleEl) return;
    titleEl.contentEditable = true;
    titleEl.focus();
    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
};

document.getElementById("importBtn").onclick = () => {
  document.getElementById("importNotes").click();
};

document.getElementById("importNotes").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const { notes: importedNotes, panelSplit } = getImportData(JSON.parse(reader.result));
      if (!replaceNotesFromImport(notes, importedNotes, { onError: reportImportStorageError })) return;
      notes = importedNotes;
      storageErrorShown = false;
      if (panelSplit !== null) {
        try {
          localStorage.setItem("panelSplit", panelSplit);
        } catch (error) {
          reportStorageError(error);
        }
      }
      render();
    } catch (err) {
      if (err instanceof SyntaxError) {
        alert("Import failed: invalid JSON file.");
      } else {
        alert("Import failed: " + err.message);
      }
    } finally {
      e.target.value = "";
    }
  };

  reader.readAsText(file);
};

document.getElementById("exportNotes").onclick = () => {
  const panelSplit = parseFloat(localStorage.getItem("panelSplit")) || 50;
  const exportData = { notes, panelSplit };

  const blob = new Blob(
    [JSON.stringify(exportData, null, 2)],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "all-notes.json";
  a.click();
};

document.getElementById("toggleAll").onclick = () => {
  const note = findNoteById(currentNoteId);
  if (!note || note.sections.length <= 1) return;

  const shouldCollapse = note.sections.some(s => !s.collapsed);

  note.sections.forEach(s => (s.collapsed = shouldCollapse));
  save();
  render();
};

function updateToggleAllUI(collapsed) {
  toggleAllIcon.className = collapsed
    ? "bi bi-arrows-expand"
    : "bi bi-arrows-collapse";

  toggleAllText.innerText = collapsed ? "Expand" : "Collapse";
  toggleAllIcon.style.transform = collapsed ? "rotate(180deg)" : "rotate(0deg)";
  document.getElementById("toggleAll").setAttribute(
    "aria-label", collapsed ? "Expand all sections" : "Collapse all sections"
  );
}

/* -------- SCROLL THUMB -------- */
const scrollTrack = document.getElementById("scrollTrack");

function updateScrollThumb() {
  const el = listContainer;
  if (!el || el.scrollHeight <= el.clientHeight) {
    scrollThumb.classList.remove("visible");
    scrollTrack.classList.remove("visible");
    return;
  }
  const thumbSize = 75;
  const trackTop = el.offsetTop;
  const trackHeight = el.clientHeight;

  if (trackHeight <= thumbSize) {
    scrollThumb.classList.remove("visible");
    scrollTrack.classList.remove("visible");
    return;
  }

  scrollTrack.classList.add("visible");
  scrollTrack.style.top = trackTop + "px";
  scrollTrack.style.height = trackHeight + "px";

  scrollThumb.classList.add("visible");
  const ratio = el.scrollTop / (el.scrollHeight - el.clientHeight);
  scrollThumb.style.top = (trackTop + ratio * (trackHeight - thumbSize)) + "px";
}

listContainer.addEventListener("scroll", updateScrollThumb);
window.addEventListener("resize", updateScrollThumb);

let isScrollDragging = false;
let scrollPointerId = null;
let scrollDragStartY = 0;
let scrollDragStartTop = 0;

scrollThumb.addEventListener("pointerdown", (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  isScrollDragging = true;
  scrollPointerId = e.pointerId;
  scrollDragStartY = e.clientY;
  scrollDragStartTop = listContainer.scrollTop;
  scrollThumb.setPointerCapture(e.pointerId);
  document.body.style.cursor = "grabbing";
  document.body.style.userSelect = "none";
  e.preventDefault();
});

scrollThumb.addEventListener("pointermove", (e) => {
  if (!isScrollDragging || e.pointerId !== scrollPointerId) return;
  const el = listContainer;
  const thumbSize = 75;
  const dy = e.clientY - scrollDragStartY;
  const scrollRange = el.scrollHeight - el.clientHeight;
  const thumbRange = el.clientHeight - thumbSize;
  if (scrollRange <= 0 || thumbRange <= 0) return;
  el.scrollTop = scrollDragStartTop + dy * scrollRange / thumbRange;
});

function endScrollDrag(e) {
  if (!isScrollDragging || (e && e.pointerId !== scrollPointerId)) return;
  isScrollDragging = false;
  scrollPointerId = null;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
}

scrollThumb.addEventListener("pointerup", endScrollDrag);
scrollThumb.addEventListener("pointercancel", endScrollDrag);
scrollThumb.addEventListener("lostpointercapture", endScrollDrag);

/* -------- PANEL RESIZE -------- */
let isDragging = false;
let resizePointerId = null;

function setPanelSplit(leftPct, persist = false) {
  const split = Math.min(Math.max(leftPct, 20), 80);
  panelLeft.style.width = `${split}%`;
  panelRight.style.width = `${100 - split}%`;
  if (persist) {
    try {
      localStorage.setItem("panelSplit", split);
    } catch (error) {
      reportStorageError(error);
    }
  }
}

resizeHandle.addEventListener("pointerdown", (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  isDragging = true;
  resizePointerId = e.pointerId;
  resizeHandle.setPointerCapture(e.pointerId);
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  e.preventDefault();
});

resizeHandle.addEventListener("pointermove", (e) => {
  if (!isDragging || e.pointerId !== resizePointerId) return;
  const wrapper = document.querySelector(".app-wrapper");
  const rect = wrapper.getBoundingClientRect();
  const leftPct = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 20), 80);
  panelLeft.style.transition = "none";
  panelRight.style.transition = "none";
  setPanelSplit(leftPct);
});

function endPanelResize(e) {
  if (!isDragging || (e && e.pointerId !== resizePointerId)) return;
  isDragging = false;
  resizePointerId = null;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  panelLeft.style.transition = "";
  panelRight.style.transition = "";
  const leftPct = parseFloat(panelLeft.style.width);
  if (!isNaN(leftPct)) setPanelSplit(leftPct, true);
}

resizeHandle.addEventListener("pointerup", endPanelResize);
resizeHandle.addEventListener("pointercancel", endPanelResize);
resizeHandle.addEventListener("lostpointercapture", endPanelResize);

/* -------- LINK EDIT MODAL -------- */
const linkModal        = document.getElementById("linkModal");
const linkDisplayInput = document.getElementById("linkDisplayInput");
const linkUrlInput     = document.getElementById("linkUrlInput");
const linkModalTitle   = document.getElementById("linkModalTitle");

function editLink(oldText, oldUrl, getContent, setContent, rerender) {
  linkModalTitle.textContent = "Edit link";
  document.getElementById("linkOk").textContent = "Update";
  linkDisplayInput.value = oldText;
  linkUrlInput.value = oldUrl;
  showModal(linkModal, linkDisplayInput);

  const finish = (confirmed) => {
    if (!confirmed) {
      hideModal(linkModal);
      document.removeEventListener("keydown", onKey);
      return;
    }

    const newText = linkDisplayInput.value.trim() || oldUrl;
    const newUrl = normalizeHttpUrl(linkUrlInput.value.trim() || oldUrl);
    if (!newUrl) {
      alert("Links must use an http:// or https:// URL.");
      return;
    }
    hideModal(linkModal);
    document.removeEventListener("keydown", onKey);
    const oldMd   = oldText === oldUrl ? oldUrl : `[${oldText}](${oldUrl})`;
    const newMd   = newText === newUrl ? newUrl : `[${newText}](${newUrl})`;
    setContent(getContent().replace(oldMd, newMd));
    save();
    rerender();
  };

  const onKey = (e) => {
    if (e.key === "Enter")  { e.preventDefault(); finish(true); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  };

  document.addEventListener("keydown", onKey);
  document.getElementById("linkOk").onclick     = () => finish(true);
  document.getElementById("linkCancel").onclick = () => finish(false);
  linkModal.onclick = (e) => { if (e.target === linkModal) finish(false); };
}

/* -------- LINK HOVER TOOLTIP -------- */
const linkHoverTooltip = document.getElementById("linkHoverTooltip");
let hideTooltipTimer;

linkHoverTooltip.addEventListener("mouseenter", () => clearTimeout(hideTooltipTimer));
linkHoverTooltip.addEventListener("mouseleave", () => {
  hideTooltipTimer = setTimeout(() => { linkHoverTooltip.style.display = "none"; }, 200);
});

function showLinkTooltip(element, target, editCb) {
  if (element.contentEditable === "true") return;
  const a = target.closest("a[href]");
  const href = a && normalizeHttpUrl(a.getAttribute("href"));
  if (!a || !href) return;
  clearTimeout(hideTooltipTimer);

  document.getElementById("linkHoverUrl").textContent = href;
  linkHoverTooltip.style.display = "flex";

  const rect = a.getBoundingClientRect();
  linkHoverTooltip.style.left = `${rect.left}px`;
  linkHoverTooltip.style.top  = `${rect.bottom + 4}px`;

  requestAnimationFrame(() => {
    const tr = linkHoverTooltip.getBoundingClientRect();
    if (tr.right > window.innerWidth)
      linkHoverTooltip.style.left = `${window.innerWidth - tr.width - 8}px`;
  });

  document.getElementById("linkHoverOpen").onclick = (ev) => {
    ev.stopPropagation();
    window.open(href, "_blank", "noopener noreferrer");
    linkHoverTooltip.style.display = "none";
  };

  document.getElementById("linkHoverEdit").onclick = (ev) => {
    ev.stopPropagation();
    linkHoverTooltip.style.display = "none";
    editCb(a.innerText.trim(), href);
  };
}

function attachLinkTooltip(element, editCb) {
  element.addEventListener("mouseover", (e) => showLinkTooltip(element, e.target, editCb));
  element.addEventListener("focusin", (e) => showLinkTooltip(element, e.target, editCb));

  element.addEventListener("mouseleave", () => {
    hideTooltipTimer = setTimeout(() => { linkHoverTooltip.style.display = "none"; }, 200);
  });
}

/* -------- HELP -------- */
const helpModal = document.getElementById("helpModal");
let activeModal = null;
let modalReturnFocus = null;

function getModalFocusables(modal) {
  return Array.from(modal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => element.getClientRects().length > 0);
}

function showModal(modal, initialFocus) {
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModal = modal;
  modal.style.display = "flex";
  requestAnimationFrame(() => (initialFocus || getModalFocusables(modal)[0])?.focus());
}

function hideModal(modal) {
  if (activeModal === modal) activeModal = null;
  modal.style.display = "none";
  const returnFocus = modalReturnFocus;
  modalReturnFocus = null;
  returnFocus?.focus();
}

document.addEventListener("keydown", (e) => {
  if (!activeModal || e.key !== "Tab") return;
  const focusables = getModalFocusables(activeModal);
  if (focusables.length === 0) {
    e.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

const helpClose = document.getElementById("helpClose");
const closeHelp = () => hideModal(helpModal);
document.getElementById("helpBtn").onclick = () => showModal(helpModal, helpClose);
helpClose.onclick = closeHelp;
helpModal.addEventListener("click", (e) => { if (e.target === helpModal) closeHelp(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activeModal === helpModal) closeHelp();
});

/* -------- DETAIL TITLE LINK TOOLTIP -------- */
const detailTitleEl = document.getElementById("detailTitle");
attachLinkTooltip(detailTitleEl, (oldText, href) => {
  const note = findNoteById(currentNoteId);
  if (!note) return;
  editLink(oldText, href,
    () => note.title,
    (v) => { note.title = v; },
    () => { detailTitleEl.innerHTML = renderLinks(note.title); }
  );
});

const themeToggle = document.getElementById("themeToggle");

function applyTheme(light) {
  document.body.classList.toggle("light-theme", light);
  themeToggle.innerHTML = light
    ? `<i class="bi bi-moon"></i>`
    : `<i class="bi bi-sun"></i>`;
  themeToggle.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
}

applyTheme(localStorage.getItem("theme") === "light");

themeToggle.onclick = () => {
  const isLight = document.body.classList.toggle("light-theme");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  applyTheme(isLight);
};

/* -------- INIT -------- */
render();

let deferredPrompt = null;
const installBanner = document.getElementById("installBanner");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner?.classList.remove("d-none");
});

document.getElementById("installBtn")?.addEventListener("click", async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;

  deferredPrompt = null;
  installBanner.classList.add("d-none");
});

document.getElementById("dismissInstall")?.addEventListener("click", () => {
  installBanner.classList.add("d-none");
  deferredPrompt = null;
});

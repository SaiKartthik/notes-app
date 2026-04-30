let notes = JSON.parse(localStorage.getItem("notes")) || [];
let currentNoteId = null;

let container;
const listContainer   = document.getElementById("notesListContainer");
const detailContainer = document.getElementById("notesDetailContainer");
const panelLeft       = document.getElementById("panelLeft");
const panelRight      = document.getElementById("panelRight");
const toggleAllIcon   = document.getElementById("toggleAllIcon");
const toggleAllText   = document.getElementById("toggleAllText");

function moveItem(arr, from, to) {
  if (from === to) return;
  const item = arr.splice(from, 1)[0];
  arr.splice(to, 0, item);
}

function setToggleAllVisibility(visible, disabled = false) {
  const btn = document.getElementById("toggleAll");

  if (!visible) {
    btn.classList.add("d-none");
    return;
  }

  btn.classList.remove("d-none");
  btn.disabled = disabled;
  btn.style.opacity = disabled ? "0.5" : "1";
}

function save() {
  localStorage.setItem("notes", JSON.stringify(notes));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderLinks(text = "") {
  return text.replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function renderMarkdown(text = "") {
  return text
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, "<br>");
}

/* ---------------- RENDER ---------------- */

function render() {
  container = listContainer;
  container.innerHTML = "";
  renderRoot();

  if (currentNoteId !== null) {
    container = detailContainer;
    container.innerHTML = "";
    detailContainer.classList.add("note-enter");
    setTimeout(() => detailContainer.classList.remove("note-enter"), 180);
    document.getElementById("detailTitle").innerHTML = renderLinks(
      notes.find(n => n.id === currentNoteId)?.title || ""
    );
    renderNoteView(currentNoteId);
    panelLeft.classList.add("split");
    panelRight.classList.add("open");
  } else {
    panelLeft.classList.remove("split");
    panelRight.classList.remove("open");
    detailContainer.innerHTML = "";
    document.getElementById("detailTitle").innerHTML = "";
  }
}

/* -------- ROOT VIEW (FOLDERS) -------- */

function renderRoot() {
  if (notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-center mt-5";
    empty.style.color = "#aaa";
    empty.innerHTML = `
      <div style="font-size:1.2rem">📂 No notes yet</div>
      <div class="small mt-1">Click + to create your first note</div>
    `;
    container.appendChild(empty);
    setToggleAllVisibility(false);
    return;
  }

  container.innerHTML = "";

  const active = notes.filter(n => !n.completed);
  const done = notes.filter(n => n.completed);
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
    card.draggable = true;
    card.dataset.id = note.id;
    if (note.id === currentNoteId) card.classList.add("note-active");

    let singleClickTimer = null;

    card.onclick = () => {
      if (singleClickTimer !== null) return;
      singleClickTimer = setTimeout(() => {
        singleClickTimer = null;
        if (currentNoteId !== null && currentNoteId !== note.id) {
          detailContainer.classList.remove("note-enter");
          detailContainer.classList.add("note-exit");
          setTimeout(() => {
            detailContainer.classList.remove("note-exit");
            currentNoteId = note.id;
            render();
          }, 180);
        } else {
          currentNoteId = note.id;
          render();
        }
      }, 250);
    };

    card.addEventListener("dragstart", () => {
      card.classList.add("opacity-50");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("opacity-50");
      save();
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".opacity-50");
      if (!dragging || dragging === card) return;
      const from = notes.findIndex(n => n.id === dragging.dataset.id);
      const to = notes.findIndex(n => n.id === card.dataset.id);
      moveItem(notes, from, to);
      render();
    });

    // Checkbox
    const checkBtn = document.createElement("button");
    checkBtn.className = "check-btn flex-shrink-0" + (note.completed ? " checked" : "");
    checkBtn.title = note.completed ? "Mark incomplete" : "Mark complete";
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
      range.collapse(false);
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

    // Right-side actions
    const right = document.createElement("div");
    right.className = "d-flex align-items-center gap-2 flex-shrink-0";

    const count = document.createElement("span");
    count.className = "note-count small";
    count.innerText = `${note.sections.length}`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-outline-danger btn-sm icon-btn";
    deleteBtn.title = "Delete note";
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
  const note = notes.find(n => n.id === noteId);
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

  updateToggleAllUI(note.sections.every(s => s.collapsed));
  const sectionCount = note.sections.length;

setToggleAllVisibility(true, sectionCount <= 1);

// Update icon state correctly
updateToggleAllUI(
  sectionCount > 0 && note.sections.every(s => s.collapsed)
);

}

/* -------- SECTION -------- */

function renderSection(note, section) {
  const sec = document.createElement("section");
sec.className = "note";
sec.dataset.sectionId = section.id;

  sec.draggable = true;
  sec.dataset.id = section.id;

  const header = document.createElement("div");
  header.className = "d-flex justify-content-between align-items-center";
  sec.addEventListener("dragstart", () => {
  sec.classList.add("opacity-50");
});
  
sec.addEventListener("dragend", () => {
  sec.classList.remove("opacity-50");
  save();
});

sec.addEventListener("dragover", (e) => {
  e.preventDefault();

  const dragging = document.querySelector(".opacity-50");
  if (!dragging || dragging === sec) return;

  const from = note.sections.findIndex(s => s.id === dragging.dataset.id);
  const to = note.sections.findIndex(s => s.id === section.id);

  moveItem(note.sections, from, to);
  render();
});

  if (section.completed) sec.classList.add("note-completed");

  const sectionCheckBtn = document.createElement("button");
  sectionCheckBtn.className = "check-btn flex-shrink-0" + (section.completed ? " checked" : "");
  sectionCheckBtn.title = section.completed ? "Mark incomplete" : "Mark complete";
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


  const actions = document.createElement("div");
  actions.className = "note-actions";

  const deleteBtn = document.createElement("button");
deleteBtn.className = "btn btn-outline-danger btn-sm icon-btn";
deleteBtn.title = "Delete section";
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

  const icon = document.createElement("i");
  icon.className = section.collapsed ? "bi bi-chevron-down" : "bi bi-chevron-up";
  collapseBtn.appendChild(icon);

  collapseBtn.onclick = () => {
    section.collapsed = !section.collapsed;
    content.style.display = section.collapsed ? "none" : "block";
    icon.className = section.collapsed ? "bi bi-chevron-down" : "bi bi-chevron-up";
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
  content.contentEditable = true;
  content.style.display = section.collapsed ? "none" : "block";
  content.innerHTML = renderMarkdown(section.content);

  content.oninput = () => {
    section.content = content.innerText;
    save();
  };

  content.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      e.preventDefault();
      window.open(e.target.href, "_blank", "noopener noreferrer");
    }
  });

  content.onblur = () => {
    section.content = section.content.replace(/[\n\r]+$/, "");
    save();
    content.innerHTML = renderMarkdown(section.content);
  };

  sec.append(header, content);
  container.appendChild(sec);
}

/* -------- BUTTONS -------- */
document.getElementById("addNoteInput").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const title = e.target.value.trim();
  if (!title) return;

  const newNote = {
    id: uid(),
    title,
    sections: [],
    completed: false,
    createdAt: Date.now()
  };

  notes.unshift(newNote);
  save();
  e.target.value = "";
  render();
});

document.getElementById("closeDetail").onclick = () => {
  currentNoteId = null;
  render();
};

document.getElementById("addSectionBtn").onclick = () => {
  if (currentNoteId === null) return;
  const note = notes.find(n => n.id === currentNoteId);

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
      const data = JSON.parse(reader.result);

      if (currentNoteId === null) {
        if (Array.isArray(data)) {
          notes = data;
        } else if (data && typeof data === "object" && Array.isArray(data.sections)) {
          notes = [data];
        } else {
          alert("Import failed: expected an array of notes.");
          return;
        }
      } else {
        const note = notes.find(n => n.id === currentNoteId);
        if (!note) return;
        if (Array.isArray(data.sections)) {
          note.sections = data.sections;
        } else if (Array.isArray(data)) {
          note.sections = data;
        }
      }

      save();
      render();
    } catch {
      alert("Import failed: invalid JSON file.");
    } finally {
      e.target.value = "";
    }
  };

  reader.readAsText(file);
};

document.getElementById("exportNotes").onclick = () => {
  const blob = new Blob(
    [JSON.stringify(notes, null, 2)],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "all-notes.json";
  a.click();
};

document.getElementById("toggleAll").onclick = () => {
  if (currentNoteId === null) return;

const note = notes.find(n => n.id === currentNoteId);
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
}

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

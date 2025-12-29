let notes = JSON.parse(localStorage.getItem("notes")) || [];
let currentNoteId = null;

const container = document.getElementById("notesContainer");
const toggleAllIcon = document.getElementById("toggleAllIcon");
const toggleAllText = document.getElementById("toggleAllText");

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

function renderMarkdown(text = "") {
  return text
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/\n/g, "<br>");
}

/* ---------------- RENDER ---------------- */

function render() {
  container.innerHTML = "";
  if (currentNoteId === null) {
    renderRoot();
  } else {
    renderNoteView(currentNoteId);
  }
}

/* -------- ROOT VIEW (FOLDERS) -------- */

function renderRoot() {
  if (notes.length === 0) {
  const empty = document.createElement("div");
  empty.className = "text-muted text-center mt-5";
  empty.innerHTML = `
    <div style="font-size:1.2rem">📂 No notes yet</div>
    <div class="small mt-1">Click + to create your first note</div>
  `;
  container.appendChild(empty);
  setToggleAllVisibility(false);
  return;
}

  container.innerHTML = "";

  notes.forEach(note => {
    
    const card = document.createElement("section");
    card.className = "note d-flex justify-content-between align-items-center";
    card.style.cursor = "pointer";
    card.draggable = true;
    card.dataset.id = note.id;

    // Open folder on card click
    card.onclick = () => {
      currentNoteId = note.id;
      render();
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

    // Folder title
    const title = document.createElement("div");
title.className = "note-title";
title.innerText = note.title;
title.style.cursor = "text";

// Prevent card click while editing
title.onclick = (e) => {
  e.stopPropagation();
  title.contentEditable = true;
  title.focus();

  // place caret at end
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
    title.innerText = originalTitle;
    return;
  }

  note.title = newTitle;
  save();
};


    // Right-side actions
    const right = document.createElement("div");
    right.className = "d-flex align-items-center gap-2";

    // Section count
    const count = document.createElement("span");
    count.className = "text-muted small";
    count.innerText = `${note.sections.length}`;

    // Delete button (2-step confirm)
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-outline-danger btn-sm icon-btn";
    deleteBtn.title = "Delete note";
    deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;

    deleteBtn.onclick = (e) => {
      e.stopPropagation(); // prevent opening folder

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

    right.append(count, deleteBtn);
    card.append(title, right);
    container.appendChild(card);
  });

  // Toggle-all does nothing in root view
  setToggleAllVisibility(false);
}


/* -------- NOTE VIEW (SECTIONS) -------- */

function renderNoteView(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  const header = document.createElement("div");
  header.className = "mb-3 d-flex align-items-center gap-2";

  const backBtn = document.createElement("button");
  backBtn.className = "btn btn-outline-light btn-sm";
  backBtn.innerText = "⬅ Back";
  backBtn.onclick = () => {
    currentNoteId = null;
    render();
  };

  const title = document.createElement("h6");
  title.className = "m-0";
  title.innerText = note.title;

  header.append(backBtn, title);
  container.appendChild(header);
  if (note.sections.length === 0) {
  const empty = document.createElement("div");
  empty.className = "text-muted text-center mt-4";
  empty.innerHTML = `
    <div style="font-size:1.1rem">📄 No sections</div>
    <div class="small mt-1">Click + to add a section</div>
  `;
  container.appendChild(empty);
  setToggleAllVisibility(true, true);
  return;
}

  note.sections.forEach(section => renderSection(note, section));

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

  const title = document.createElement("div");
  title.className = "note-title";
  title.contentEditable = true;
  title.innerText = section.title || "Untitled Section";

  title.oninput = () => {
    section.title = title.innerText;
    save();
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
  header.append(title, actions);

  const content = document.createElement("div");
  content.className = "note-content";
  content.contentEditable = true;
  content.style.display = section.collapsed ? "none" : "block";
  content.innerHTML = renderMarkdown(section.content);

  content.oninput = () => {
    section.content = content.innerText;
    save();
  };

  content.onblur = () => {
    content.innerHTML = renderMarkdown(section.content);
  };

  sec.append(header, content);
  container.appendChild(sec);
}

/* -------- BUTTONS -------- */
document.getElementById("addBtn").onclick = () => {
  if (currentNoteId === null) {
    const newNote = {
      id: uid(),
      title: "New Note",
      sections: []
    };

    notes.unshift(newNote);
    save();
    render();

    // 👇 Focus & select the new note title
    requestAnimationFrame(() => {
      const titles = document.querySelectorAll(".note-title");
      const titleEl = titles[0]; // first note (unshifted)

      if (!titleEl) return;

      titleEl.contentEditable = true;
      titleEl.focus();

      const range = document.createRange();
      range.selectNodeContents(titleEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

  } else {
    // existing section-add logic stays unchanged
    const note = notes.find(n => n.id === currentNoteId);
    note.sections.unshift({
      id: uid(),
      title: "New Section",
      content: "",
      collapsed: false
    });
    save();
    render();
  }
};

document.getElementById("importBtn").onclick = () => {
  document.getElementById("importNotes").click();
};

document.getElementById("importNotes").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(reader.result);

    if (currentNoteId === null) {
      // Root view → import ALL notes
      notes = data;
    } else {
      // Note view → import sections into THIS note
      const note = notes.find(n => n.id === currentNoteId);
      if (!note) return;

      // Expecting either full note or sections array
      if (Array.isArray(data.sections)) {
        note.sections = data.sections;
      } else if (Array.isArray(data)) {
        note.sections = data;
      }
    }

    save();
    render();
  };

  reader.readAsText(file);
};

document.getElementById("exportNotes").onclick = () => {
  const data =
    currentNoteId === null
      ? notes
      : notes.find(n => n.id === currentNoteId);

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentNoteId ? "note.json" : "all-notes.json";
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

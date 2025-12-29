let notes = JSON.parse(localStorage.getItem("notes")) || [];
const container = document.getElementById("notesContainer");

function save() {
  localStorage.setItem("notes", JSON.stringify(notes));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function renderMarkdown(text) {
  return text
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/^- (.*$)/gim, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>")
    .replace(/\n/g, "<br>");
}

function render() {
  container.innerHTML = "";

  notes.forEach((note, index) => {
    const section = document.createElement("section");
    section.className = "note";
    section.dataset.id = note.id;

    section.addEventListener("dragstart", () =>
      section.classList.add("dragging")
    );
    section.addEventListener("dragend", () => {
      section.classList.remove("dragging");
      save();
    });

    section.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (!dragging || dragging === section) return;

      const from = notes.findIndex((n) => n.id === dragging.dataset.id);
      const to = index;
      notes.splice(to, 0, notes.splice(from, 1)[0]);
      render();
    });

    // HEADER
    const header = document.createElement("div");
    header.className = "note-header";

    const title = document.createElement("div");
    title.className = "note-title";
    title.contentEditable = true;
    title.innerText = note.title || "Untitled Note";

    // ✅ Make ONLY the title draggable
    title.draggable = true;

    title.addEventListener("dragstart", () => {
      section.classList.add("dragging");
    });

    title.addEventListener("dragend", () => {
      section.classList.remove("dragging");
      save();
    });

    // DO NOT modify innerText during typing
    title.oninput = () => {
      note.title = title.innerText;
      save();
    };

    title.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();

        const cleanTitle = title.innerText.replace(/\n/g, "").trim();
        title.innerText = cleanTitle || "Untitled Note";
        note.title = title.innerText;
        save();

        // Move focus to content
        content.focus();
      }
    };

    title.onblur = () => {
      const cleanTitle = title.innerText.replace(/\n/g, "").trim();
      title.innerText = cleanTitle || "Untitled Note";
      note.title = title.innerText;
      save();
    };

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const collapseBtn = document.createElement("button");
    collapseBtn.className = "btn btn-outline-light btn-sm";
    collapseBtn.innerText = note.collapsed ? "Expand" : "Collapse";
    collapseBtn.onclick = () => {
  note.collapsed = !note.collapsed;

  content.classList.toggle("collapsed", note.collapsed);
  content.classList.toggle("expanded", !note.collapsed);

  collapseBtn.innerText = note.collapsed ? "Expand" : "Collapse";
  save();
};

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-outline-danger btn-sm";
    deleteBtn.innerText = "Delete";
    deleteBtn.onclick = () => {
      notes = notes.filter((n) => n.id !== note.id);
      save();
      render();
    };

    actions.append(collapseBtn, deleteBtn);
    header.append(title, actions);

    // CONTENT
    const content = document.createElement("div");
    content.className = "note-content";
    content.contentEditable = true;
    content.classList.add(note.collapsed ? "collapsed" : "expanded");
    content.innerHTML = renderMarkdown(note.content);

    content.oninput = () => {
      note.content = content.innerText;
      content.oninput = () => {
        note.content = content.innerText;
        save();
      };

      content.onblur = () => {
        // Render markdown ONLY when user leaves the editor
        content.innerHTML = renderMarkdown(note.content);
        save();
      };

      save();
    };

    section.append(header, content);
    container.appendChild(section);
  });
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Buttons
document.getElementById("addNote").onclick = () => {
  const newNote = {
    id: uid(),
    title: "New Note",
    content: "",
    collapsed: false,
  };

  notes.unshift(newNote);
  save();
  render();

  // Auto-focus & select title text
  const firstTitle = container.querySelector(".note-title");
  if (firstTitle) {
    firstTitle.focus();

    // Mobile-safe text selection
    const range = document.createRange();
    range.selectNodeContents(firstTitle);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  
};

document.getElementById("exportNotes").onclick = () => {
  const blob = new Blob([JSON.stringify(notes, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "notes.json";
  a.click();
};

document.getElementById("importBtn").onclick = () => {
  document.getElementById("importNotes").click();
};

document.getElementById("importNotes").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    notes = JSON.parse(reader.result);
    save();
    render();
  };
  reader.readAsText(file);
};

const toggleAllBtn = document.getElementById("toggleAll");
const toggleAllIcon = document.getElementById("toggleAllIcon");
const toggleAllText = document.getElementById("toggleAllText");

toggleAllBtn.onclick = () => {
  const shouldCollapse = notes.some(note => !note.collapsed);

  notes.forEach(note => {
    note.collapsed = shouldCollapse;

    const section = document.querySelector(
      `.note[data-id="${note.id}"]`
    );
    if (!section) return;

    const content = section.querySelector(".note-content");
    const btn = section.querySelector(".note-actions button");

    content.classList.toggle("collapsed", shouldCollapse);
    content.classList.toggle("expanded", !shouldCollapse);

    btn.innerText = shouldCollapse ? "Expand" : "Collapse";
  });

  // 🔄 Update toggle-all icon + text
  if (shouldCollapse) {
    toggleAllIcon.className = "bi bi-arrows-expand";
    toggleAllText.innerText = "Expand";
    toggleAllBtn.title = "Expand all";
  } else {
    toggleAllIcon.className = "bi bi-arrows-collapse";
    toggleAllText.innerText = "Collapse";
    toggleAllBtn.title = "Collapse all";
  }
toggleAllIcon.style.transform = shouldCollapse
  ? "rotate(180deg)"
  : "rotate(0deg)";

  save();
};

let deferredPrompt = null;
const installBanner = document.getElementById("installBanner");

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent browser mini-infobar
  e.preventDefault();
  deferredPrompt = e;

  // Show custom install banner
  installBanner.classList.remove("d-none");
});

document.getElementById("installBtn").onclick = async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  deferredPrompt = null;
  installBanner.classList.add("d-none");
};

document.getElementById("dismissInstall").onclick = () => {
  installBanner.classList.add("d-none");
  deferredPrompt = null;
};

window.addEventListener("appinstalled", () => {
  installBanner.classList.add("d-none");
  deferredPrompt = null;
});

render();

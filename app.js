const notesContainer = document.getElementById("notesContainer");
const addSectionBtn = document.getElementById("addSectionBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const fileInput = document.getElementById("fileInput");

let notes = JSON.parse(localStorage.getItem("notes")) || [];

function saveNotes() {
    localStorage.setItem("notes", JSON.stringify(notes));
}

function autoGrow(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
}

function createNote(note, index) {
    const card = document.createElement("div");
    card.className = "card note-card w-100";

    card.innerHTML = `
        <div class="card-body">
            <div 
                class="note-title mb-2" 
                contenteditable="true"
            >${note.title}</div>

            <textarea class="form-control mb-3"
                ${note.collapsed ? "style='display:none'" : ""}>${note.content}</textarea>

            <div class="d-flex justify-content-between">
                <button class="btn btn-sm btn-outline-secondary collapse-btn">
                    ${note.collapsed ? "Expand" : "Collapse"}
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn">
                    Delete
                </button>
            </div>
        </div>
    `;

    const titleEl = card.querySelector(".note-title");
    const textarea = card.querySelector("textarea");
    const collapseBtn = card.querySelector(".collapse-btn");
    const deleteBtn = card.querySelector(".delete-btn");

    // Inline rename
    titleEl.oninput = () => {
        note.title = titleEl.textContent.trim() || "Untitled";
        saveNotes();
    };

    // Auto-grow + auto-save
    autoGrow(textarea);
    textarea.oninput = () => {
        note.content = textarea.value;
        autoGrow(textarea);
        saveNotes();
    };

    // Collapse / Expand
    collapseBtn.onclick = () => {
        note.collapsed = !note.collapsed;
        textarea.style.display = note.collapsed ? "none" : "block";
        collapseBtn.textContent = note.collapsed ? "Expand" : "Collapse";
        saveNotes();
    };

    // Delete
    deleteBtn.onclick = () => {
        notes.splice(index, 1);
        saveNotes();
        renderNotes();
    };

    return card;
}

function renderNotes() {
    notesContainer.innerHTML = "";
    notes.forEach((note, index) => {
        notesContainer.appendChild(createNote(note, index));
    });
}

addSectionBtn.onclick = () => {
    notes.unshift({
        title: "New Section",
        content: "",
        collapsed: false
    });
    saveNotes();
    renderNotes();
};

// Export JSON
exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], {
        type: "application/json"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "notes.json";
    a.click();
};

// Import JSON
importBtn.onclick = () => fileInput.click();

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            notes = JSON.parse(reader.result);
            saveNotes();
            renderNotes();
        } catch {
            alert("Invalid JSON file");
        }
    };
    reader.readAsText(file);
};

// Initial render
renderNotes();

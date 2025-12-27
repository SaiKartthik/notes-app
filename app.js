const notesContainer = document.getElementById("notesContainer");
const addNoteBtn = document.getElementById("addNoteBtn");

let notes = JSON.parse(localStorage.getItem("notes")) || [];

// Save to localStorage
function saveNotes() {
    localStorage.setItem("notes", JSON.stringify(notes));
}

// Create a note card
function createNote(note, index) {
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";

    col.innerHTML = `
        <div class="card note-card h-100">
            <div class="card-body d-flex flex-column">
                <input
                    class="note-title mb-2"
                    value="${note.title}"
                    placeholder="Section Title"
                />

                <textarea
                    class="note-text flex-grow-1 mb-2"
                    rows="6"
                >${note.content}</textarea>

                <div class="d-flex justify-content-between">
                    <button class="btn btn-sm btn-outline-secondary toggle-btn">
                        ${note.collapsed ? "Expand" : "Collapse"}
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-btn">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `;

    const titleInput = col.querySelector(".note-title");
    const textArea = col.querySelector(".note-text");
    const toggleBtn = col.querySelector(".toggle-btn");
    const deleteBtn = col.querySelector(".delete-btn");

    // Rename section
    titleInput.addEventListener("input", () => {
        notes[index].title = titleInput.value;
        saveNotes();
    });

    // Auto-save content
    textArea.addEventListener("input", () => {
        notes[index].content = textArea.value;
        saveNotes();
    });

    // Collapse / Expand
    if (note.collapsed) {
        textArea.style.display = "none";
    }

    toggleBtn.addEventListener("click", () => {
        notes[index].collapsed = !notes[index].collapsed;
        saveNotes();
        renderNotes();
    });

    // Delete
    deleteBtn.addEventListener("click", () => {
        notes.splice(index, 1);
        saveNotes();
        renderNotes();
    });

    return col;
}

// Render all notes
function renderNotes() {
    notesContainer.innerHTML = "";
    notes.forEach((note, index) => {
        notesContainer.appendChild(createNote(note, index));
    });
}

// Add new section
addNoteBtn.addEventListener("click", () => {
    notes.push({
        title: "New Section",
        content: "",
        collapsed: false
    });
    saveNotes();
    renderNotes();
});

// Initial render
renderNotes();

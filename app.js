const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const notesContainer = document.getElementById("notesContainer");
const addSectionBtn = document.getElementById("addSectionBtn");

let notes = JSON.parse(localStorage.getItem("notes")) || [];

function saveNotes() {
    localStorage.setItem("notes", JSON.stringify(notes));
}

function createNote(note, index) {
    const card = document.createElement("div");
    card.className = "card note-card w-100";

    card.innerHTML = `
        <div class="card-body">
           <input 
                class="note-title form-control bg-transparent text-white border-0 mb-2"
                value="${note.title}"
            />
            <textarea class="form-control mb-3" rows="5"
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

    // Rename section
    titleEl.setAttribute("contenteditable", "true");
    titleEl.style.color = "#fff";

    titleEl.onblur = () => {
        const newTitle = titleEl.textContent.trim();
        if (newTitle === "") {
            titleEl.textContent = note.title; // revert if empty
            return;
        }
        note.title = newTitle;
        saveNotes();
    };

    titleEl.onkeydown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            titleEl.blur(); // save on Enter
        }
    };

    // Auto-save text
    textarea.oninput = () => {
            note.content = textarea.value;
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

    exportBtn.onclick = () => {
        const blob = new Blob([JSON.stringify(notes, null, 2)], {
            type: "application/json"
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "notes.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    importBtn.onclick = () => {
        importFile.click();
    };

    importFile.onchange = () => {
        const file = importFile.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedNotes = JSON.parse(e.target.result);
                if (!Array.isArray(importedNotes)) throw "Invalid file";
                notes = importedNotes;
                saveNotes();
                renderNotes();
            } catch {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
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

// Initial render
renderNotes();
export const MAX_NOTES = 1000;
export const MAX_SECTIONS_PER_NOTE = 5000;
export const MAX_PASTE_LENGTH = 100000;

export function moveItem(arr, from, to) {
  if (!Array.isArray(arr) || !Number.isInteger(from) || !Number.isInteger(to) ||
      from < 0 || to < 0 || from >= arr.length || to >= arr.length || from === to) {
    return false;
  }
  const item = arr.splice(from, 1)[0];
  arr.splice(to, 0, item);
  return true;
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isValidId(value) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 128;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function normalizeId(value) {
  return isValidId(value) ? value.trim() : uid();
}

function normalizeTimestamp(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeSection(value) {
  if (!isPlainObject(value)) throw new Error("Each section must be an object.");
  if (value.title !== undefined && typeof value.title !== "string") throw new Error("Section titles must be text.");
  if (value.content !== undefined && typeof value.content !== "string") throw new Error("Section content must be text.");

  return {
    id: normalizeId(value.id),
    title: value.title || "Untitled Section",
    content: value.content || "",
    collapsed: value.collapsed === true,
    completed: value.completed === true
  };
}

export function normalizeNote(value) {
  if (!isPlainObject(value)) throw new Error("Each note must be an object.");
  if (value.title !== undefined && typeof value.title !== "string") throw new Error("Note titles must be text.");
  if (value.sections !== undefined && !Array.isArray(value.sections)) throw new Error("Note sections must be an array.");

  const sections = value.sections || [];
  if (sections.length > MAX_SECTIONS_PER_NOTE) {
    throw new Error(`A note cannot contain more than ${MAX_SECTIONS_PER_NOTE} sections.`);
  }

  return {
    id: normalizeId(value.id),
    title: value.title || "Untitled Note",
    sections: sections.map(normalizeSection),
    completed: value.completed === true,
    createdAt: normalizeTimestamp(value.createdAt) || Date.now(),
    completedAt: value.completed === true ? normalizeTimestamp(value.completedAt) : null
  };
}

export function normalizeNotes(value) {
  if (!Array.isArray(value)) throw new Error("Notes must be an array.");
  if (value.length > MAX_NOTES) throw new Error(`Cannot import more than ${MAX_NOTES} notes.`);
  const noteIds = new Set();
  return value.map((rawNote) => {
    const note = normalizeNote(rawNote);
    while (noteIds.has(note.id)) note.id = uid();
    noteIds.add(note.id);

    const sectionIds = new Set();
    note.sections.forEach((section) => {
      while (sectionIds.has(section.id)) section.id = uid();
      sectionIds.add(section.id);
    });
    return note;
  });
}

export function getImportData(data) {
  let rawNotes;
  let panelSplit = null;

  if (Array.isArray(data)) {
    rawNotes = data;
  } else if (isPlainObject(data) && Array.isArray(data.notes)) {
    rawNotes = data.notes;
    if (data.panelSplit !== undefined) {
      if (!Number.isFinite(data.panelSplit) || data.panelSplit < 20 || data.panelSplit > 80) {
        throw new Error("Panel split must be a number between 20 and 80.");
      }
      panelSplit = data.panelSplit;
    }
  } else if (isPlainObject(data) && Array.isArray(data.sections)) {
    rawNotes = [data];
  } else {
    throw new Error("Expected an array of notes or an exported notes file.");
  }

  return { notes: normalizeNotes(rawNotes), panelSplit };
}

import { normalizeNotes } from "./data.js";

export const NOTES_STORAGE_KEY = "notes";

export function loadStoredString(key, storage = localStorage) {
  try {
    const value = storage.getItem(key);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export function persistStoredString(key, value, storage = localStorage) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStoredValue(key, storage = localStorage) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function isQuotaError(error) {
  return error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

export function loadNotes(storage = localStorage) {
  try {
    const raw = storage.getItem(NOTES_STORAGE_KEY);
    return raw ? normalizeNotes(JSON.parse(raw)) : [];
  } catch (error) {
    console.warn("Ignoring invalid saved notes:", error);
    return [];
  }
}

export function persistNotes(notes, { storage = localStorage, onError } = {}) {
  try {
    storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch (error) {
    onError?.(error);
    return false;
  }
}

export function replaceNotesFromImport(currentNotes, nextNotes, { storage = localStorage, onError } = {}) {
  const backupKey = `notes-backup-${Date.now()}`;
  try {
    storage.setItem(backupKey, JSON.stringify(currentNotes));
    storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(nextNotes));
    return true;
  } catch (error) {
    onError?.(error);
    return false;
  }
}

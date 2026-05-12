const urlParams = new URLSearchParams(window.location.search);
const isWidgetMode = urlParams.get("widget") === "true";

if (isWidgetMode) {
  document.body.classList.add("widget-mode");
}
function resizeWidgetMode() {
  if (!document.body.classList.contains("widget-mode")) return;

  const app = document.querySelector(".app");
  if (!app) return;

  const designWidth = 1250;
  const designHeight = 900;

  const scaleX = window.innerWidth / designWidth;
  const scaleY = window.innerHeight / designHeight;
  const scale = Math.min(scaleX, scaleY);

  app.style.width = `${designWidth}px`;
  app.style.height = `${designHeight}px`;
  app.style.transform = `scale(${scale})`;
  app.style.transformOrigin = "top left";
}

window.addEventListener("load", resizeWidgetMode);
window.addEventListener("resize", resizeWidgetMode);

const STORAGE_KEY = "researchWhiteboardData";

const defaultData = {
  notes: [],
  generalNotes: ""
};

let boardData = loadBoardData();
let draggedNoteId = null;
let activeNoteId = null;
let savedSelection = null;

const newNoteButton = document.getElementById("new-note-button");
const cancelNoteButton = document.getElementById("cancel-note-button");
const noteForm = document.getElementById("note-form");
const noteTextInput = document.getElementById("note-text");
const noteColorInput = document.getElementById("note-color");
const noteFontInput = document.getElementById("note-font");
const noteSizeInput = document.getElementById("note-size");
const noteBoldInput = document.getElementById("note-bold");
const noteItalicInput = document.getElementById("note-italic");
const generalNotesInput = document.getElementById("general-notes");
const noteLists = document.querySelectorAll(".note-list");
const formatToolbar = document.getElementById("format-toolbar");
const editFontInput = document.getElementById("edit-font");
const editSizeInput = document.getElementById("edit-size");
const attachLinkButton = document.getElementById("attach-link-button");
const closeFormatToolbarButton = document.getElementById("close-format-toolbar");

newNoteButton.addEventListener("click", () => {
  noteForm.classList.remove("hidden");
  noteTextInput.focus();
});

cancelNoteButton.addEventListener("click", () => {
  noteForm.reset();
  noteForm.classList.add("hidden");
});

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = noteTextInput.value.trim();
  const color = noteColorInput.value;

  if (!text) return;

  const newNote = {
    id: crypto.randomUUID(),
    html: formatInitialText(text),
    color,
    column: "study-design",
    order: getNextOrder("study-design"),
    fontFamily: noteFontInput.value,
    fontSize: noteSizeInput.value
  };

  boardData.notes.push(newNote);
  saveBoardData();
  renderBoard();

  noteForm.reset();
  noteForm.classList.add("hidden");
});

generalNotesInput.addEventListener("input", () => {
  boardData.generalNotes = generalNotesInput.value;
  saveBoardData();
});

noteLists.forEach((list) => {
  list.addEventListener("dragover", handleDragOver);
  list.addEventListener("drop", handleDrop);
});

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const noteContent = getClosestNoteContent(selection.anchorNode);
  if (!noteContent) return;

  savedSelection = selection.getRangeAt(0).cloneRange();
  activeNoteId = noteContent.closest(".sticky-note")?.dataset.id || null;
});

formatToolbar.querySelectorAll("button").forEach((button) => {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
});

formatToolbar.querySelectorAll("button[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    applyCommand(button.dataset.command);
  });
});

editFontInput.addEventListener("change", () => {
  if (!editFontInput.value) return;
  applyInlineStyle("fontFamily", editFontInput.value);
  editFontInput.value = "";
});

editSizeInput.addEventListener("change", () => {
  if (!editSizeInput.value) return;
  applyInlineStyle("fontSize", editSizeInput.value);
  editSizeInput.value = "";
});

closeFormatToolbarButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  formatToolbar.classList.add("hidden");
  formatToolbar.style.display = "none";

  activeNoteId = null;
  savedSelection = null;
});

attachLinkButton.addEventListener("click", () => {
  restoreSelection();

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    alert("Highlight the word or phrase you want to link first, then click Attach link.");
    return;
  }

  const url = prompt("Paste the link you want to attach:");
  if (!url) return;

  const safeUrl = normalizeUrl(url);
  document.execCommand("createLink", false, safeUrl);

  const activeContent = getActiveNoteContent();
  if (activeContent) {
    activeContent.querySelectorAll("a").forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
    saveActiveNoteContent();
    activeContent.focus();
  }
});

function loadBoardData() {
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    return structuredClone(defaultData);
  }

  try {
    const parsedData = JSON.parse(savedData);
    parsedData.notes = (parsedData.notes || []).map((note) => ({
      ...note,
      html: note.html || escapeHtml(note.text || ""),
      color: note.color || "yellow",
      fontFamily: note.fontFamily || "Arial, Helvetica, sans-serif",
      fontSize: note.fontSize || "16px"
    }));
    return { ...defaultData, ...parsedData };
  } catch (error) {
    console.error("Could not load saved whiteboard data:", error);
    return structuredClone(defaultData);
  }
}

function saveBoardData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boardData));
}

function renderBoard() {
  noteLists.forEach((list) => {
    list.innerHTML = "";
  });

  const sortedNotes = [...boardData.notes].sort((a, b) => a.order - b.order);

  sortedNotes.forEach((note) => {
    const noteElement = createNoteElement(note);
    const list = document.querySelector(`.note-list[data-column="${note.column}"]`);

    if (list) {
      list.appendChild(noteElement);
    }
  });

  generalNotesInput.value = boardData.generalNotes || "";
}

function createNoteElement(note) {
  const noteElement = document.createElement("article");
  noteElement.className = `sticky-note ${note.color}`;
  noteElement.dataset.id = note.id;

  const dragHandle = document.createElement("span");
  dragHandle.className = "drag-handle";
  dragHandle.textContent = "drag";
  dragHandle.draggable = true;
  dragHandle.setAttribute("aria-label", "Drag sticky note");

  const noteContent = document.createElement("div");
  noteContent.className = "note-content";
  noteContent.contentEditable = "true";
  noteContent.innerHTML = note.html || "";
  noteContent.style.fontFamily = note.fontFamily || "Arial, Helvetica, sans-serif";
  noteContent.style.fontSize = note.fontSize || "16px";
  noteContent.setAttribute("aria-label", "Sticky note text");

  noteContent.addEventListener("focus", () => {
    activeNoteId = note.id;
    formatToolbar.style.display = "";
formatToolbar.classList.remove("hidden");
  });

  noteContent.addEventListener("input", () => {
    updateNote(note.id, { html: noteContent.innerHTML });
  });

  noteContent.addEventListener("mouseup", saveCurrentSelection);
  noteContent.addEventListener("keyup", saveCurrentSelection);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-note";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", "Delete sticky note");
  deleteButton.addEventListener("click", () => {
    deleteNote(note.id);
  });

  dragHandle.addEventListener("dragstart", () => {
    draggedNoteId = note.id;
    noteElement.classList.add("dragging");
  });

  dragHandle.addEventListener("dragend", () => {
    draggedNoteId = null;
    noteElement.classList.remove("dragging");
  });

  noteElement.appendChild(dragHandle);
  noteElement.appendChild(noteContent);
  noteElement.appendChild(deleteButton);

  return noteElement;
}

function handleDragOver(event) {
  event.preventDefault();

  const list = event.currentTarget;
  const draggingElement = document.querySelector(".sticky-note.dragging");

  if (!draggingElement) return;

  const afterElement = getDragAfterElement(list, event.clientY);

  if (afterElement == null) {
    list.appendChild(draggingElement);
  } else {
    list.insertBefore(draggingElement, afterElement);
  }
}

function handleDrop(event) {
  event.preventDefault();

  if (!draggedNoteId) return;

  const targetList = event.currentTarget;
  const targetColumn = targetList.dataset.column;
  const orderedIds = [...targetList.querySelectorAll(".sticky-note")].map((note) => note.dataset.id);

  boardData.notes = boardData.notes.map((note) => {
    if (note.id === draggedNoteId) {
      return { ...note, column: targetColumn };
    }

    return note;
  });

  updateColumnOrder(targetColumn, orderedIds);
  saveBoardData();
  renderBoard();
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".sticky-note:not(.dragging)")];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }

      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

function updateColumnOrder(column, orderedIds) {
  orderedIds.forEach((id, index) => {
    updateNote(id, { column, order: index });
  });

  normalizeAllColumnOrders();
}

function normalizeAllColumnOrders() {
  const columns = ["study-design", "data-collection", "analysis", "writing", "done"];

  columns.forEach((column) => {
    boardData.notes
      .filter((note) => note.column === column)
      .sort((a, b) => a.order - b.order)
      .forEach((note, index) => {
        note.order = index;
      });
  });
}

function updateNote(id, updates) {
  boardData.notes = boardData.notes.map((note) => {
    if (note.id === id) {
      return { ...note, ...updates };
    }

    return note;
  });

  saveBoardData();
}

function deleteNote(id) {
  const confirmed = window.confirm("Delete this sticky note?");

  if (!confirmed) return;

  boardData.notes = boardData.notes.filter((note) => note.id !== id);
  normalizeAllColumnOrders();
  saveBoardData();
  renderBoard();
}

function getNextOrder(column) {
  const notesInColumn = boardData.notes.filter((note) => note.column === column);
  return notesInColumn.length;
}

function formatInitialText(text) {
  let formattedText = escapeHtml(text);

  if (noteBoldInput.checked) {
    formattedText = `<strong>${formattedText}</strong>`;
  }

  if (noteItalicInput.checked) {
    formattedText = `<em>${formattedText}</em>`;
  }

  return formattedText;
}

function applyCommand(command) {
  restoreSelection();
  document.execCommand(command, false, null);
  saveActiveNoteContent();
  const activeContent = getActiveNoteContent();
  if (activeContent) activeContent.focus();
}

function applyInlineStyle(styleName, styleValue) {
  restoreSelection();

  const selection = window.getSelection();
  const activeContent = getActiveNoteContent();

  if (!selection || selection.rangeCount === 0 || !activeContent) return;

  if (selection.isCollapsed) {
    activeContent.style[styleName] = styleValue;
    updateNote(activeNoteId, { [styleName]: styleValue });
  } else {
    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.style[styleName] = styleValue;

    try {
      range.surroundContents(span);
    } catch (error) {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }

    selection.removeAllRanges();
    selection.addRange(range);
  }

  saveActiveNoteContent();
  activeContent.focus();
}

function saveCurrentSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  savedSelection = selection.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  const activeContent = getActiveNoteContent();
  if (!activeContent) return;

  activeContent.focus();

  if (!savedSelection) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedSelection);
}

function saveActiveNoteContent() {
  const activeContent = getActiveNoteContent();
  if (!activeContent || !activeNoteId) return;

  updateNote(activeNoteId, {
    html: activeContent.innerHTML,
    fontFamily: activeContent.style.fontFamily,
    fontSize: activeContent.style.fontSize
  });
}

function getActiveNoteContent() {
  if (!activeNoteId) return null;
  return document.querySelector(`.sticky-note[data-id="${activeNoteId}"] .note-content`);
}

function getClosestNoteContent(node) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    return node.parentElement?.closest(".note-content") || null;
  }
  return node.closest?.(".note-content") || null;
}

function normalizeUrl(url) {
  const trimmedUrl = url.trim();
  if (/^https?:\/\//i.test(trimmedUrl) || /^mailto:/i.test(trimmedUrl)) {
    return trimmedUrl;
  }
  return `https://${trimmedUrl}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

renderBoard();

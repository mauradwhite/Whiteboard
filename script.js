const STORAGE_KEY = "researchWhiteboardData";

const defaultData = {
  notes: [],
  generalNotes: ""
};

let boardData = loadBoardData();
let draggedNoteId = null;

const newNoteButton = document.getElementById("new-note-button");
const cancelNoteButton = document.getElementById("cancel-note-button");
const noteForm = document.getElementById("note-form");
const noteTextInput = document.getElementById("note-text");
const noteColorInput = document.getElementById("note-color");
const generalNotesInput = document.getElementById("general-notes");
const noteLists = document.querySelectorAll(".note-list");

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
    text,
    color,
    column: "study-design",
    order: getNextOrder("study-design")
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

function loadBoardData() {
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    return structuredClone(defaultData);
  }

  try {
    return JSON.parse(savedData);
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
  noteElement.draggable = true;
  noteElement.dataset.id = note.id;

  const noteTextarea = document.createElement("textarea");
  noteTextarea.value = note.text;
  noteTextarea.setAttribute("aria-label", "Sticky note text");
  noteTextarea.addEventListener("input", () => {
    updateNote(note.id, { text: noteTextarea.value });
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-note";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.setAttribute("aria-label", "Delete sticky note");
  deleteButton.addEventListener("click", () => {
    deleteNote(note.id);
  });

  noteElement.addEventListener("dragstart", () => {
    draggedNoteId = note.id;
    noteElement.classList.add("dragging");
  });

  noteElement.addEventListener("dragend", () => {
    draggedNoteId = null;
    noteElement.classList.remove("dragging");
  });

  noteElement.appendChild(noteTextarea);
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

renderBoard();

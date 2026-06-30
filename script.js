const STORAGE_KEY = "simple-note-app-notes";

const notesList = document.getElementById("notes-list");
const newNoteButton = document.getElementById("new-note-btn");
const deleteNoteButton = document.getElementById("delete-note-btn");
const searchInput = document.getElementById("search-input");
const currentNoteLabel = document.getElementById("current-note-label");
const noteTitleInput = document.getElementById("note-title");
const noteContentInput = document.getElementById("note-content");

let notes = loadNotes();
let activeNoteId = notes[0]?.id || null;

if (notes.length === 0) {
	notes = [createNote()];
	activeNoteId = notes[0].id;
	saveNotes();
}

render();

newNoteButton.addEventListener("click", () => {
	const note = createNote();
	notes.unshift(note);
	activeNoteId = note.id;
	saveNotes();
	render();
});

deleteNoteButton.addEventListener("click", () => {
	if (!activeNoteId) {
		return;
	}

	notes = notes.filter((note) => note.id !== activeNoteId);

	if (notes.length === 0) {
		const note = createNote();
		notes = [note];
		activeNoteId = note.id;
	} else {
		activeNoteId = notes[0].id;
	}

	saveNotes();
	render();
});

searchInput.addEventListener("input", render);

noteTitleInput.addEventListener("input", updateActiveNote);
noteContentInput.addEventListener("input", updateActiveNote);

function loadNotes() {
	const savedNotes = localStorage.getItem(STORAGE_KEY);
	if (!savedNotes) {
		return [];
	}

	try {
		const parsedNotes = JSON.parse(savedNotes);
		return Array.isArray(parsedNotes) ? parsedNotes : [];
	} catch {
		return [];
	}
}

function saveNotes() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function createNote() {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		title: "Untitled note",
		content: "",
		updatedAt: now.toISOString(),
	};
}

function getActiveNote() {
	return notes.find((note) => note.id === activeNoteId) || null;
}

function updateActiveNote() {
	const note = getActiveNote();
	if (!note) {
		return;
	}

	note.title = noteTitleInput.value.trim() || "Untitled note";
	note.content = noteContentInput.value;
	note.updatedAt = new Date().toISOString();

	notes = [note, ...notes.filter((item) => item.id !== note.id)];
	saveNotes();
	currentNoteLabel.textContent = note.title;
	renderNotes();
}

function render() {
	const note = getActiveNote();
	const searchTerm = searchInput.value.trim().toLowerCase();

	if (note) {
		currentNoteLabel.textContent = note.title;
		noteTitleInput.value = note.title;
		noteContentInput.value = note.content;
		noteTitleInput.disabled = false;
		noteContentInput.disabled = false;
		deleteNoteButton.disabled = false;
	} else {
		currentNoteLabel.textContent = "Select a note";
		noteTitleInput.value = "";
		noteContentInput.value = "";
		noteTitleInput.disabled = true;
		noteContentInput.disabled = true;
		deleteNoteButton.disabled = true;
	}

	renderNotes(searchTerm);
}

function renderNotes(searchTerm = "") {
	const filteredNotes = notes.filter((note) => {
		if (!searchTerm) {
			return true;
		}

		return (
			note.title.toLowerCase().includes(searchTerm) ||
			note.content.toLowerCase().includes(searchTerm)
		);
	});

	notesList.innerHTML = "";

	if (filteredNotes.length === 0) {
		const emptyState = document.createElement("p");
		emptyState.textContent = "No notes found.";
		notesList.appendChild(emptyState);
		return;
	}

	for (const note of filteredNotes) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `note-item${note.id === activeNoteId ? " is-active" : ""}`;
		button.addEventListener("click", () => {
			activeNoteId = note.id;
			render();
		});

		const title = document.createElement("strong");
		title.textContent = note.title;

		const preview = document.createElement("p");
		preview.textContent = note.content.slice(0, 80) || "No content yet.";

		button.append(title, preview);
		notesList.appendChild(button);
	}
}
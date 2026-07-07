const STORAGE_KEY = "simple-note-app-notes";

const notesList = document.getElementById("notes-list");
const newNoteButton = document.getElementById("new-note-btn");
const deleteNoteButton = document.getElementById("delete-note-btn");
const searchInput = document.getElementById("search-input");
const currentNoteLabel = document.getElementById("current-note-label");
const noteTitleInput = document.getElementById("note-title");
const noteContentInput = document.getElementById("note-content");
const noteWeatherTag = document.getElementById("note-weather-tag");
const noteColorInput = document.getElementById("note-color-input");
const noteColorLabel = document.getElementById("note-color-label");
const editorSection = document.querySelector(".editor");

let notes = loadNotes();
let activeNoteId = notes[0]?.id || null;

if (notes.length === 0) {
	const note = createNote();
	notes = [note];
	activeNoteId = note.id;
	saveNotes();
	attachWeatherToNote(note.id); // fetch weather in the background for the first note
	attachColorToNote(note.id); // fetch color identity in the background
}

render();

newNoteButton.addEventListener("click", () => {
	const note = createNote();
	notes.unshift(note);
	activeNoteId = note.id;
	saveNotes();
	render();
	attachWeatherToNote(note.id); // fetch weather in the background, don't block UI
	attachColorToNote(note.id); // fetch color identity in the background
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
		attachWeatherToNote(note.id);
		attachColorToNote(note.id);
	} else {
		activeNoteId = notes[0].id;
	}

	saveNotes();
	render();
});

searchInput.addEventListener("input", render);

noteTitleInput.addEventListener("input", updateActiveNote);
noteContentInput.addEventListener("input", updateActiveNote);
noteColorInput.addEventListener("change", handleColorPick);

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
		weather: null, // filled in asynchronously by attachWeatherToNote()
		color: null, // filled in asynchronously by attachColorToNote()
	};
}

// Fetches weather (via weather.js) for a note and saves it once it resolves.
// Runs in the background so note creation never waits on a network call.
async function attachWeatherToNote(noteId) {
	if (typeof getWeatherForNote !== "function") return; // weather.js not loaded

	const weather = await getWeatherForNote();
	const note = notes.find((n) => n.id === noteId);
	if (!note) return; // note may have been deleted before the fetch resolved

	note.weather = weather;
	saveNotes();

	if (noteId === activeNoteId) {
		renderWeatherForActiveNote();
	}
}

async function attachColorToNote(noteId) {
	if (typeof getColorForNote !== "function") return; // color.js not loaded

	const color = await getColorForNote(noteId); // hex is deterministic from noteId
	const note = notes.find((n) => n.id === noteId);
	if (!note) return; // note may have been deleted before the fetch resolved

	note.color = color;
	saveNotes();

	if (noteId === activeNoteId) {
		renderColorPickerForActiveNote();
	}
	renderNotes(searchInput.value.trim().toLowerCase()); // refresh card accent color
}

// Fills the picker + label with the active note's color.
// Falls back to a neutral gray if the note has no color yet
// (e.g. the background fetch hasn't resolved).
function renderColorPickerForActiveNote() {
	const note = getActiveNote();
	if (!note) return;
	noteColorInput.value = note.color?.hex || "#8a8f9c";
	noteColorLabel.textContent = note.color?.name || (note.color ? note.color.hex : "");
}

// Runs when the user picks a color manually. Overwrites whatever
// color the note had (including the auto-assigned default) and
// looks up its name via the Color API, same as the initial assignment.
async function handleColorPick() {
	const note = getActiveNote();
	if (!note) return;

	const hex = noteColorInput.value; // e.g. "#3fae7c"
	let name = null;
	if (typeof getColorName === "function") {
		name = await getColorName(hex);
	}

	note.color = { hex, name };
	saveNotes();
	noteColorLabel.textContent = name || hex;
	renderNotes(searchInput.value.trim().toLowerCase()); // refresh card swatch
}

function renderWeatherForActiveNote() {
	if (typeof renderWeatherTag !== "function") return; // weather.js not loaded
	const note = getActiveNote();
	noteWeatherTag.innerHTML = note ? renderWeatherTag(note) : "";

	if (note?.weather?.category) {
		editorSection.setAttribute("data-condition", note.weather.category);
	} else {
		editorSection.removeAttribute("data-condition");
	}
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

	renderWeatherForActiveNote();
	renderColorPickerForActiveNote();
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

		if (note.weather) {
			const badge = document.createElement("span");
			badge.className = "note-card-weather";
			badge.setAttribute("data-condition", note.weather.category);
			badge.innerHTML = `${note.weather.icon} ${Math.round(note.weather.tempC)}&deg;C`;
			button.appendChild(badge);
		}

		if (note.color) {
			// Set as a CSS variable + class, rendered via ::before in CSS.
			// A pseudo-element is its own paint layer, so it can't be
			// silently overridden by whatever border/box-shadow the
			// .is-active class applies for the selection highlight.
			button.classList.add("has-color");
			button.style.setProperty("--note-color", note.color.hex);
		}

		notesList.appendChild(button);
	}
}
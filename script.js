const db = new PouchDB("note-app");

let notes = [];
let activeId = null;


const $ = (id) => document.getElementById(id);
const el = {
  list:    $("notes-list"),
  newBtn:  $("new-note-btn"),
  delBtn:  $("delete-note-btn"),
  saveBtn: $("save-note-btn"),
  search:  $("search-input"),
  label:   $("current-note-label"),
  title:   $("note-title"),
  content: $("note-content"),
};


const makeNote = () => ({
  _id:       crypto.randomUUID(),
  title:     "Untitled note",
  content:   "",
  updatedAt: new Date().toISOString(),
});

const getActive = () => notes.find((n) => n._id === activeId) ?? null;


async function loadNotes() {
  const res = await db.allDocs({ include_docs: true, descending: true });
  notes = res.rows.map((r) => r.doc);
}

async function putNote(note) {
  const res = await db.put(note);
  note._rev = res.rev; 
}

async function removeNote(note) {
  await db.remove(note);
}


function renderEditor() {
  const note = getActive();
  const has = note !== null;

  el.label.textContent = has ? note.title : "Select a note";
  el.title.value       = has ? note.title : "";
  el.content.value     = has ? note.content : "";
  el.title.disabled    = !has;
  el.content.disabled  = !has;
  el.delBtn.disabled   = !has;
  el.saveBtn.disabled  = !has;
}

function renderList() {
  const term = el.search.value.trim().toLowerCase();
  const list = term
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(term) ||
        n.content.toLowerCase().includes(term))
    : notes;

  el.list.innerHTML = "";

  if (list.length === 0) {
    el.list.innerHTML = "<p>No notes found.</p>";
    return;
  }

  for (const note of list) {
    const btn = document.createElement("button");
    btn.className = `note-item${note._id === activeId ? " is-active" : ""}`;
    btn.onclick = () => { activeId = note._id; renderEditor(); renderList(); };
    btn.innerHTML = `
      <strong>${note.title}</strong>
      <p>${note.content.slice(0, 80) || "No content yet."}</p>
    `;
    el.list.appendChild(btn);
  }
}


el.newBtn.onclick = async () => {
  const note = makeNote();
  await putNote(note);
  notes.unshift(note);
  activeId = note._id;
  renderEditor();
  renderList();
};

el.delBtn.onclick = async () => {
  const note = getActive();
  if (!note) return;

  await removeNote(note);
  notes = notes.filter((n) => n._id !== note._id);

  if (notes.length === 0) {
    const fresh = makeNote();
    await putNote(fresh);
    notes = [fresh];
  }

  activeId = notes[0]._id;
  renderEditor();
  renderList();
};

el.saveBtn.onclick = async () => {
  const note = getActive();
  if (!note) return;

  note.title     = el.title.value.trim() || "Untitled note";
  note.content   = el.content.value;
  note.updatedAt = new Date().toISOString();

  await putNote(note);

  
  notes = [note, ...notes.filter((n) => n._id !== note._id)];

  el.label.textContent  = note.title;
  el.saveBtn.textContent = "Saved ✓";
  setTimeout(() => { el.saveBtn.textContent = "Save"; }, 1500);

  renderList();
};

el.search.oninput = renderList;


async function init() {
  await loadNotes();

  if (notes.length === 0) {
    const note = makeNote();
    await putNote(note);
    notes = [note];
  }

  activeId = notes[0]._id;
  renderEditor();
  renderList();
}

init();

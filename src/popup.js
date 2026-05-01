const clipCount = document.getElementById("clip-count");
const clipList = document.getElementById("clip-list");
const emptyState = document.getElementById("empty-state");
const exportButton = document.getElementById("export-json");
const importButton = document.getElementById("import-json");
const importFile = document.getElementById("import-file");
const clearButton = document.getElementById("clear-clips");
const searchInput = document.getElementById("search-clips");
const dateSort = document.getElementById("date-sort");
const metricSort = document.getElementById("metric-sort");
const prevPageButton = document.getElementById("prev-page");
const nextPageButton = document.getElementById("next-page");
const pageStatus = document.getElementById("page-status");

const PAGE_SIZE = 10;
let currentClips = [];
let currentPage = 1;

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value || "";
  }
}

function createClipItem(clip) {
  const item = document.createElement("li");
  item.className = "clip";
  item.dataset.clipId = clip.id;

  const meta = document.createElement("div");
  meta.className = "clip-meta";

  const author = document.createElement("span");
  author.textContent = clip.author?.username || "Unknown author";

  const typeBadge = createClipTypeBadge(clip.thread);
  const text = document.createElement("p");
  text.className = "clip-text";
  text.textContent = clip.text || "No text captured.";

  const metrics = createMetrics(clip);
  const thread = createThreadInfo(clip.thread);

  meta.append(author, typeBadge);
  item.append(meta);

  if (thread) {
    item.appendChild(thread);
  }

  item.appendChild(text);

  if (metrics) {
    item.appendChild(metrics);
  }

  if (clip.url) {
    const link = document.createElement("a");
    link.className = "clip-link";
    link.href = clip.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open post";
    item.appendChild(link);
  }

  item.appendChild(createClipFooter(clip));

  return item;
}

function createClipFooter(clip) {
  const footer = document.createElement("div");
  footer.className = "clip-footer";
  footer.append(createClipActions(clip), createPostInfo(clip));
  return footer;
}

function createClipActions(clip) {
  const actions = document.createElement("div");
  actions.className = "clip-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "small-button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () => showEditForm(clip.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "small-button danger";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteClip(clip.id));

  actions.append(editButton, deleteButton);
  return actions;
}

function createPostInfo(clip) {
  const info = document.createElement("div");
  info.className = "clip-post-info";

  const views = formatMetricValue(clip.metrics?.views);
  const postedAt = clip.postedAt ? formatDate(clip.postedAt) : null;
  const parts = [];

  if (views) {
    parts.push(`${views} views`);
  }

  if (postedAt) {
    parts.push(postedAt);
  }

  info.textContent = parts.join(" | ");
  return info;
}

function valueOrEmpty(value) {
  return value === null || value === undefined ? "" : String(value);
}

function numberOrNull(value) {
  if (value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createField(labelText, input) {
  const label = document.createElement("label");
  label.className = "edit-field";

  const labelSpan = document.createElement("span");
  labelSpan.textContent = labelText;

  label.append(labelSpan, input);
  return label;
}

function createTextInput(name, value, type = "text") {
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.value = valueOrEmpty(value);
  return input;
}

function showEditForm(id) {
  const clip = currentClips.find((item) => item.id === id);
  const item = clipList.querySelector(`[data-clip-id="${CSS.escape(id)}"]`);

  if (!clip || !item || item.querySelector(".edit-form")) {
    return;
  }

  const form = document.createElement("form");
  form.className = "edit-form";

  const textArea = document.createElement("textarea");
  textArea.name = "text";
  textArea.rows = 5;
  textArea.value = valueOrEmpty(clip.text);

  const isThread = Boolean(clip.thread?.position && clip.thread?.total);
  const threadToggle = document.createElement("input");
  threadToggle.name = "isThread";
  threadToggle.type = "checkbox";
  threadToggle.checked = isThread;

  const fields = [
    createField("Text", textArea),
    createField("Username", createTextInput("username", clip.author?.username)),
    createField("Posted at", createTextInput("postedAt", clip.postedAt)),
    createField("URL", createTextInput("url", clip.url, "url")),
    createField("Likes", createTextInput("likes", clip.metrics?.likes, "number")),
    createField("Replies", createTextInput("replies", clip.metrics?.replies, "number")),
    createField("Reposts", createTextInput("reposts", clip.metrics?.reposts, "number")),
    createField("Shares", createTextInput("shares", clip.metrics?.shares, "number")),
    createField("Views", createTextInput("views", clip.metrics?.views, "number")),
    createField("Utas", threadToggle),
    createField("Position", createTextInput("threadPosition", clip.thread?.position, "number")),
    createField("Total", createTextInput("threadTotal", clip.thread?.total, "number"))
  ];

  const controls = document.createElement("div");
  controls.className = "edit-controls";

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "Save changes";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => form.remove());

  controls.append(saveButton, cancelButton);
  form.append(...fields, controls);
  form.addEventListener("submit", (event) => saveEditedClip(event, clip));
  item.appendChild(form);
}

async function saveEditedClip(event, originalClip) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const isThread = data.get("isThread") === "on";
  const threadPosition = numberOrNull(data.get("threadPosition"));
  const threadTotal = numberOrNull(data.get("threadTotal"));
  const thread = isThread && threadPosition && threadTotal
    ? { position: threadPosition, total: threadTotal }
    : null;

  const updatedClip = {
    ...originalClip,
    url: data.get("url") || null,
    author: {
      username: data.get("username") || null
    },
    text: data.get("text") || null,
    metrics: {
      likes: numberOrNull(data.get("likes")),
      replies: numberOrNull(data.get("replies")),
      reposts: numberOrNull(data.get("reposts")),
      shares: numberOrNull(data.get("shares")),
      views: numberOrNull(data.get("views"))
    },
    thread,
    postedAt: data.get("postedAt") || null,
    editedAt: new Date().toISOString()
  };

  const clips = await ThreadsClipStorage.saveClip(updatedClip);
  renderClips(clips);
}

async function deleteClip(id) {
  const confirmed = window.confirm("Delete this saved clip?");

  if (!confirmed) {
    return;
  }

  const clips = await ThreadsClipStorage.deleteClip(id);
  renderClips(clips);
}

function createThreadInfo(thread) {
  if (!thread?.position || !thread?.total) {
    return null;
  }

  const element = document.createElement("div");
  element.className = "clip-thread";
  element.textContent = `Thread ${thread.position}/${thread.total}`;
  return element;
}

function formatMetricValue(value) {
  if (typeof value !== "number") {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function createClipTypeBadge(thread) {
  const badge = document.createElement("span");
  const isThread = Boolean(thread?.position && thread?.total);

  badge.className = `clip-type ${isThread ? "is-thread" : "is-single"}`;
  badge.textContent = isThread ? "Long" : "Short";
  return badge;
}

function createMetrics(clip) {
  const metrics = clip.metrics;

  if (!metrics) {
    const row = document.createElement("div");
    row.className = "clip-metrics-row";
    return row;
  }

  const entries = [
    ["Likes", metrics.likes],
    ["Replies", metrics.replies],
    ["Reposts", metrics.reposts],
    ["Shares", metrics.shares]
  ]
    .map(([label, value]) => [label, formatMetricValue(value)])
    .filter(([, value]) => value !== null);

  const row = document.createElement("div");
  row.className = "clip-metrics-row";
  const list = document.createElement("dl");
  list.className = "clip-metrics";

  entries.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;

    const detail = document.createElement("dd");
    detail.textContent = value;

    list.append(term, detail);
  });

  row.appendChild(list);
  return row;
}

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getUsernameSearchValues(username) {
  const normalized = normalizeSearchValue(username);

  if (!normalized) {
    return [];
  }

  const withoutAt = normalized.replace(/^@/, "");
  return [...new Set([normalized, withoutAt, `@${withoutAt}`])];
}

function getSearchText(clip) {
  return [
    ...getUsernameSearchValues(clip.author?.username),
    ...getUsernameSearchValues(clip.author?.displayName),
    clip.author?.username,
    clip.author?.displayName,
    clip.text,
    clip.url,
    clip.postedAt,
    clip.thread ? `long thread ${clip.thread.position}/${clip.thread.total}` : "short"
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getDateValue(clip, key) {
  const timestamp = Date.parse(clip[key] || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getMetricValue(clip, key) {
  const value = clip.metrics?.[key];
  return typeof value === "number" ? value : -1;
}

function compareClips(a, b) {
  if (dateSort.value) {
    const dateDifference = getDateValue(b, dateSort.value) - getDateValue(a, dateSort.value);

    if (dateDifference !== 0) {
      return dateDifference;
    }
  }

  if (metricSort.value) {
    const metricDifference = getMetricValue(b, metricSort.value) - getMetricValue(a, metricSort.value);

    if (metricDifference !== 0) {
      return metricDifference;
    }
  }

  return getDateValue(b, "savedAt") - getDateValue(a, "savedAt");
}

function getVisibleClips() {
  const keyword = normalizeSearchValue(searchInput.value);
  const usernameKeyword = keyword.replace(/^@/, "");
  const keywords = [...new Set([keyword, usernameKeyword].filter(Boolean))];
  const filtered = keyword
    ? currentClips.filter((clip) => {
        const searchText = getSearchText(clip);
        return keywords.some((item) => searchText.includes(item));
      })
    : [...currentClips];

  return filtered.sort(compareClips);
}

function renderVisibleClips() {
  const visibleClips = getVisibleClips();
  const pageCount = Math.max(1, Math.ceil(visibleClips.length / PAGE_SIZE));

  if (currentPage > pageCount) {
    currentPage = pageCount;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageClips = visibleClips.slice(start, start + PAGE_SIZE);

  clipCount.textContent = `${visibleClips.length}/${currentClips.length}`;
  emptyState.hidden = currentClips.length > 0 && visibleClips.length > 0;
  emptyState.textContent = currentClips.length === 0 ? "No saved clips yet." : "No clips match your search.";
  exportButton.disabled = currentClips.length === 0;
  clearButton.disabled = currentClips.length === 0;
  prevPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= pageCount;
  pageStatus.textContent = `Page ${currentPage} / ${pageCount}`;

  clipList.replaceChildren(...pageClips.map(createClipItem));
}

function renderClips(clips) {
  currentClips = clips;
  renderVisibleClips();
}

async function loadClips() {
  const clips = await ThreadsClipStorage.getClips();
  renderClips(clips);
}

function exportJson() {
  const json = JSON.stringify(currentClips, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `threads-clips-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  URL.revokeObjectURL(url);
}

function normalizeImportedClip(clip) {
  if (!clip || typeof clip !== "object") {
    return null;
  }

  const id = typeof clip.id === "string" && clip.id ? clip.id : null;

  if (!id) {
    return null;
  }

  return {
    id,
    url: typeof clip.url === "string" ? clip.url : null,
    author: {
      username: typeof clip.author?.username === "string" ? clip.author.username : null
    },
    text: typeof clip.text === "string" ? clip.text : null,
    metrics: {
      likes: typeof clip.metrics?.likes === "number" ? clip.metrics.likes : null,
      replies: typeof clip.metrics?.replies === "number" ? clip.metrics.replies : null,
      reposts: typeof clip.metrics?.reposts === "number" ? clip.metrics.reposts : null,
      shares: typeof clip.metrics?.shares === "number" ? clip.metrics.shares : null,
      views: typeof clip.metrics?.views === "number" ? clip.metrics.views : null
    },
    thread: clip.thread?.position && clip.thread?.total
      ? {
          position: Number(clip.thread.position),
          total: Number(clip.thread.total)
        }
      : null,
    type: "single",
    postedAt: typeof clip.postedAt === "string" ? clip.postedAt : null,
    savedAt: typeof clip.savedAt === "string" ? clip.savedAt : new Date().toISOString(),
    source: "threads",
    schemaVersion: 1
  };
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (error) {
        reject(error);
      }
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

async function importJsonFile(file) {
  if (!file) {
    return;
  }

  try {
    const parsed = await readJsonFile(file);
    const rawClips = Array.isArray(parsed) ? parsed : parsed?.clips;
    const clips = Array.isArray(rawClips)
      ? rawClips.map(normalizeImportedClip).filter(Boolean)
      : [];

    if (clips.length === 0) {
      window.alert("No valid clips found in this JSON file.");
      return;
    }

    const nextClips = await ThreadsClipStorage.importClips(clips);
    currentPage = 1;
    renderClips(nextClips);
    window.alert(`Imported ${clips.length} clip(s).`);
  } catch (error) {
    console.error("Threads Personal Clipper:", error);
    window.alert("Unable to import this JSON file.");
  } finally {
    importFile.value = "";
  }
}

async function clearClips() {
  const confirmed = window.confirm("Clear all saved Threads clips from this browser?");

  if (!confirmed) {
    return;
  }

  await ThreadsClipStorage.clearClips();
  renderClips([]);
}

exportButton.addEventListener("click", exportJson);
importButton.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => importJsonFile(importFile.files[0]));
clearButton.addEventListener("click", clearClips);
searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderVisibleClips();
});
dateSort.addEventListener("change", () => {
  currentPage = 1;
  renderVisibleClips();
});
metricSort.addEventListener("change", () => {
  currentPage = 1;
  renderVisibleClips();
});
prevPageButton.addEventListener("click", () => {
  currentPage -= 1;
  renderVisibleClips();
});
nextPageButton.addEventListener("click", () => {
  currentPage += 1;
  renderVisibleClips();
});

loadClips().catch((error) => {
  console.error("Threads Personal Clipper:", error);
});

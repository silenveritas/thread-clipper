const clipList = document.getElementById("clip-list");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search-clips");
const dateSort = document.getElementById("date-sort");
const metricSort = document.getElementById("metric-sort");
const prevPageButton = document.getElementById("prev-page");
const nextPageButton = document.getElementById("next-page");
const pageStatus = document.getElementById("page-status");
const totalCount = document.getElementById("total-count");
const visibleCount = document.getElementById("visible-count");
const longCount = document.getElementById("long-count");
const shortCount = document.getElementById("short-count");
const detailContent = document.getElementById("detail-content");
const refreshButton = document.getElementById("refresh-clips");
const exportButton = document.getElementById("export-json");

const PAGE_SIZE = 20;
let currentClips = [];
let selectedClipId = null;
let currentPage = 1;

function formatDate(value) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
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

function isLongClip(clip) {
  return Boolean(clip.thread?.position && clip.thread?.total);
}

function createTypeBadge(clip) {
  const badge = document.createElement("span");
  const isLong = isLongClip(clip);
  badge.className = `clip-type ${isLong ? "is-thread" : "is-single"}`;
  badge.textContent = isLong ? "Long" : "Short";
  return badge;
}

function createMetrics(clip) {
  const entries = [
    ["Likes", clip.metrics?.likes],
    ["Replies", clip.metrics?.replies],
    ["Reposts", clip.metrics?.reposts],
    ["Shares", clip.metrics?.shares],
    ["Views", clip.metrics?.views]
  ]
    .map(([label, value]) => [label, formatMetricValue(value)])
    .filter(([, value]) => value !== null);

  const list = document.createElement("dl");
  list.className = "clip-metrics";

  entries.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;

    const detail = document.createElement("dd");
    detail.textContent = value;

    list.append(term, detail);
  });

  return list;
}

function createClipFooter(clip) {
  const footer = document.createElement("div");
  footer.className = "clip-footer";

  const actions = document.createElement("div");
  actions.className = "clip-actions";

  if (clip.url) {
    const openLink = document.createElement("a");
    openLink.className = "button-link";
    openLink.href = clip.url;
    openLink.target = "_blank";
    openLink.rel = "noreferrer";
    openLink.textContent = "Open post";
    actions.appendChild(openLink);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteClip(clip.id);
  });
  actions.appendChild(deleteButton);

  const postInfo = document.createElement("div");
  postInfo.className = "clip-post-info";
  postInfo.textContent = [
    formatMetricValue(clip.metrics?.views) ? `${formatMetricValue(clip.metrics?.views)} views` : null,
    formatDate(clip.postedAt)
  ].filter(Boolean).join(" | ");

  footer.append(actions, postInfo);
  return footer;
}

function createClipItem(clip) {
  const item = document.createElement("li");
  item.className = `clip ${clip.id === selectedClipId ? "is-selected" : ""}`;
  item.dataset.clipId = clip.id;
  item.tabIndex = 0;

  const meta = document.createElement("div");
  meta.className = "clip-meta";

  const username = document.createElement("span");
  username.className = "username";
  username.textContent = clip.author?.username || "Unknown author";

  meta.append(username, createTypeBadge(clip));
  item.appendChild(meta);

  if (isLongClip(clip)) {
    const thread = document.createElement("div");
    thread.className = "clip-thread";
    thread.textContent = `Thread ${clip.thread.position}/${clip.thread.total}`;
    item.appendChild(thread);
  }

  const text = document.createElement("p");
  text.className = "clip-text";
  text.textContent = clip.text || "No text captured.";
  item.appendChild(text);

  item.appendChild(createMetrics(clip));
  item.appendChild(createClipFooter(clip));

  item.addEventListener("click", () => selectClip(clip.id));
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectClip(clip.id);
    }
  });

  return item;
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
    clip.text,
    clip.url,
    clip.postedAt,
    isLongClip(clip) ? `long thread ${clip.thread.position}/${clip.thread.total}` : "short"
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

function updateSummary(visibleClips) {
  totalCount.textContent = String(currentClips.length);
  visibleCount.textContent = String(visibleClips.length);
  longCount.textContent = String(currentClips.filter(isLongClip).length);
  shortCount.textContent = String(currentClips.filter((clip) => !isLongClip(clip)).length);
}

function renderClips() {
  const visibleClips = getVisibleClips();
  const pageCount = Math.max(1, Math.ceil(visibleClips.length / PAGE_SIZE));

  if (currentPage > pageCount) {
    currentPage = pageCount;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageClips = visibleClips.slice(start, start + PAGE_SIZE);

  updateSummary(visibleClips);
  emptyState.hidden = currentClips.length > 0 && visibleClips.length > 0;
  emptyState.textContent = currentClips.length === 0 ? "No saved clips yet." : "No clips match your search.";
  prevPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= pageCount;
  exportButton.disabled = currentClips.length === 0;
  pageStatus.textContent = `Page ${currentPage} / ${pageCount}`;
  clipList.replaceChildren(...pageClips.map(createClipItem));

  if (selectedClipId && !currentClips.some((clip) => clip.id === selectedClipId)) {
    selectedClipId = null;
    renderDetail(null);
  }
}

function createDetailField(label, value) {
  const wrapper = document.createElement("div");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  labelElement.textContent = label;
  valueElement.textContent = value || "-";
  wrapper.append(labelElement, valueElement);
  return wrapper;
}

function renderDetail(clip) {
  if (!clip) {
    detailContent.replaceChildren(Object.assign(document.createElement("p"), {
      className: "empty",
      textContent: "Select a clip to inspect the full saved data."
    }));
    return;
  }

  const title = document.createElement("div");
  title.className = "detail-title";

  const heading = document.createElement("h2");
  heading.textContent = clip.author?.username || "Unknown author";
  title.append(heading, createTypeBadge(clip));

  const text = document.createElement("p");
  text.className = "detail-text";
  text.textContent = clip.text || "No text captured.";

  const metadataSection = document.createElement("section");
  metadataSection.className = "detail-section";
  const metadataHeading = document.createElement("h3");
  metadataHeading.textContent = "Metadata";
  const metadataGrid = document.createElement("div");
  metadataGrid.className = "detail-grid";
  metadataGrid.append(
    createDetailField("Posted at", formatDate(clip.postedAt) || clip.postedAt),
    createDetailField("Saved at", formatDate(clip.savedAt) || clip.savedAt),
    createDetailField("Thread", isLongClip(clip) ? `${clip.thread.position}/${clip.thread.total}` : "Short"),
    createDetailField("URL", clip.url)
  );
  metadataSection.append(metadataHeading, metadataGrid);

  const metricsSection = document.createElement("section");
  metricsSection.className = "detail-section";
  const metricsHeading = document.createElement("h3");
  metricsHeading.textContent = "Metrics";
  const metricsGrid = document.createElement("div");
  metricsGrid.className = "detail-grid";
  metricsGrid.append(
    createDetailField("Likes", formatMetricValue(clip.metrics?.likes)),
    createDetailField("Replies", formatMetricValue(clip.metrics?.replies)),
    createDetailField("Reposts", formatMetricValue(clip.metrics?.reposts)),
    createDetailField("Shares", formatMetricValue(clip.metrics?.shares)),
    createDetailField("Views", formatMetricValue(clip.metrics?.views)),
    createDetailField("Schema", clip.schemaVersion)
  );
  metricsSection.append(metricsHeading, metricsGrid);

  const rawSection = document.createElement("section");
  rawSection.className = "detail-section";
  const rawHeading = document.createElement("h3");
  rawHeading.textContent = "Raw JSON";
  const raw = document.createElement("pre");
  raw.className = "raw-json";
  raw.textContent = JSON.stringify(clip, null, 2);
  rawSection.append(rawHeading, raw);

  detailContent.replaceChildren(title, text, metadataSection, metricsSection, rawSection);
}

function selectClip(id) {
  selectedClipId = id;
  renderDetail(currentClips.find((clip) => clip.id === id) || null);
  [...clipList.children].forEach((item) => {
    item.classList.toggle("is-selected", item.dataset.clipId === id);
  });
}

async function deleteClip(id) {
  const confirmed = window.confirm("Delete this saved clip?");

  if (!confirmed) {
    return;
  }

  currentClips = await ThreadsClipStorage.deleteClip(id);

  if (selectedClipId === id) {
    selectedClipId = null;
    renderDetail(null);
  }

  renderClips();
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

async function loadClips() {
  currentClips = await ThreadsClipStorage.getClips();

  if (!selectedClipId && currentClips.length > 0) {
    selectedClipId = currentClips[0].id;
    renderDetail(currentClips[0]);
  }

  renderClips();
}

searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderClips();
});
dateSort.addEventListener("change", () => {
  currentPage = 1;
  renderClips();
});
metricSort.addEventListener("change", () => {
  currentPage = 1;
  renderClips();
});
prevPageButton.addEventListener("click", () => {
  currentPage -= 1;
  renderClips();
});
nextPageButton.addEventListener("click", () => {
  currentPage += 1;
  renderClips();
});
refreshButton.addEventListener("click", () => {
  loadClips().catch((error) => console.error("Threads Personal Clipper:", error));
});
exportButton.addEventListener("click", exportJson);

loadClips().catch((error) => {
  console.error("Threads Personal Clipper:", error);
});

const ThreadsClipStorage = (() => {
  const STORAGE_KEY = "threadsPersonalClips";

  function getLocal(keys) {
    return chrome.storage.local.get(keys);
  }

  function setLocal(values) {
    return chrome.storage.local.set(values);
  }

  async function getClips() {
    const result = await getLocal({ [STORAGE_KEY]: [] });
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  }

  async function saveClip(clip) {
    const clips = await getClips();
    const existingIndex = clips.findIndex((item) => item.id === clip.id);

    if (existingIndex >= 0) {
      clips[existingIndex] = clip;
    } else {
      clips.unshift(clip);
    }

    await setLocal({ [STORAGE_KEY]: clips });
    return clips;
  }

  async function deleteClip(id) {
    const clips = await getClips();
    const nextClips = clips.filter((clip) => clip.id !== id);
    await setLocal({ [STORAGE_KEY]: nextClips });
    return nextClips;
  }

  async function importClips(importedClips) {
    const clips = await getClips();
    const byId = new Map(clips.map((clip) => [clip.id, clip]));

    for (const clip of importedClips) {
      byId.set(clip.id, {
        ...byId.get(clip.id),
        ...clip
      });
    }

    const nextClips = [...byId.values()]
      .sort((a, b) => Date.parse(b.savedAt || "") - Date.parse(a.savedAt || ""));

    await setLocal({ [STORAGE_KEY]: nextClips });
    return nextClips;
  }

  async function clearClips() {
    await setLocal({ [STORAGE_KEY]: [] });
  }

  return {
    getClips,
    saveClip,
    deleteClip,
    importClips,
    clearClips
  };
})();

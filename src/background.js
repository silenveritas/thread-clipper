importScripts("storage.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SAVE_CLIP") {
    return false;
  }

  ThreadsClipStorage.saveClip(message.clip)
    .then((clips) => {
      sendResponse({ ok: true, count: clips.length });
    })
    .catch((error) => {
      console.error("Threads Personal Clipper:", error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

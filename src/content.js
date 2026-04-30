const SAVE_BUTTON_CLASS = "threads-personal-clipper-save";
const SAVE_BUTTON_WRAP_CLASS = "threads-personal-clipper-wrap";
const INJECTED_ATTR = "data-threads-personal-clipper";
const SCAN_DEBOUNCE_MS = 250;
const PERIODIC_SCAN_MS = 1500;

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
}

function setSaveControlState(control, text, disabled) {
  control.dataset.label = text;
  control.setAttribute("aria-disabled", String(disabled));
}

function createSaveButton(container) {
  const control = document.createElement("div");
  control.className = SAVE_BUTTON_CLASS;
  control.setAttribute("role", "button");
  control.setAttribute("tabindex", "0");
  control.setAttribute("aria-label", "Save this Threads post locally");
  setSaveControlState(control, "Save", false);

  const saveClip = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (control.getAttribute("aria-disabled") === "true") {
      return;
    }

    setSaveControlState(control, "Saving", true);

    try {
      const clip = await ThreadsParser.parsePost(container);
      const serializableClip = JSON.parse(JSON.stringify(clip));
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_CLIP",
        clip: serializableClip
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Unable to save clip.");
      }

      setSaveControlState(control, "Saved", true);
      window.setTimeout(() => {
        setSaveControlState(control, "Save", false);
      }, 1400);
    } catch (error) {
      console.error("Threads Personal Clipper:", error);
      setSaveControlState(control, "Error", true);
      window.setTimeout(() => {
        setSaveControlState(control, "Save", false);
      }, 1800);
    }
  };

  control.addEventListener("click", saveClip);
  control.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      saveClip(event);
    }
  });

  return control;
}

function injectButton(container) {
  if (!container || container.hasAttribute(INJECTED_ATTR) || !isVisible(container)) {
    return;
  }

  const shareControl = ThreadsParser.findShareControl(container);
  if (!shareControl) {
    return;
  }

  container.setAttribute(INJECTED_ATTR, "true");

  const wrapper = document.createElement("div");
  wrapper.className = shareControl.className || SAVE_BUTTON_WRAP_CLASS;
  wrapper.classList.add(SAVE_BUTTON_WRAP_CLASS);
  wrapper.appendChild(createSaveButton(container));
  shareControl.insertAdjacentElement("afterend", wrapper);
}

function scanForPosts(root = document) {
  ThreadsParser.findPostContainers(root).forEach(injectButton);
}

function debounce(callback, delay) {
  let timeoutId = null;

  return () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(callback, delay);
  };
}

function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .${SAVE_BUTTON_CLASS} {
      align-items: center;
      border-radius: 999px;
      color: currentColor;
      cursor: pointer;
      display: flex;
      font: 600 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      justify-content: center;
      min-height: 26px;
      min-width: 38px;
      padding: 0 4px;
      white-space: nowrap;
    }

    .${SAVE_BUTTON_CLASS}::before {
      content: attr(data-label);
    }

    .${SAVE_BUTTON_WRAP_CLASS} {
      align-items: center;
      display: flex;
      pointer-events: none;
    }

    .${SAVE_BUTTON_WRAP_CLASS} .${SAVE_BUTTON_CLASS} {
      pointer-events: auto;
    }

    .${SAVE_BUTTON_CLASS}:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .${SAVE_BUTTON_CLASS}[aria-disabled="true"] {
      cursor: default;
      opacity: 0.72;
    }
  `;
  document.documentElement.appendChild(style);
}

function observePosts() {
  const debouncedScan = debounce(() => scanForPosts(), SCAN_DEBOUNCE_MS);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          scanForPosts(node);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("scroll", debouncedScan, { passive: true });
  window.setInterval(() => scanForPosts(), PERIODIC_SCAN_MS);
}

addStyles();
scanForPosts();
observePosts();

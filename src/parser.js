const ThreadsParser = (() => {
  const POST_PATH_PATTERN = /\/@[^/]+\/post\/[^/?#]+/;
  const THREADS_ACTION_ROW_CLASS = "x78zum5";
  const THREADS_USERNAME_AND_VIEW_CLASSES = [
    "x1lliihq",
    "x193iq5w",
    "x6ikm8r",
    "x10wlt62",
    "xlyipyv",
    "xuxw1ft"
  ];
  const THREADS_TIME_CLASSES = [
    "x1rg5ohu",
    "xnei2rj",
    "x2b8uid",
    "xuxw1ft"
  ];
  const THREADS_CHAIN_INDICATOR_CLASSES = [
    "x6s0dn4",
    "xcw5jcc",
    "x6nl9eh",
    "x1a5l9x9",
    "x7vuprf",
    "x1mg3h75",
    "x78zum5",
    "xl56j7k",
    "xg8j3zb",
    "x25sj25",
    "x1icxu4v",
    "xyqdw3p"
  ];
  const THREADS_POST_CLASS_SIGNATURE = [
    "x1n2onr6",
    "x1ypdohk",
    "x1f9n5g",
    "x17dsfyh",
    "xzzag5r",
    "x1losyl9",
    "xz9dl7a"
  ];
  const UI_TEXT = new Set([
    "Save",
    "Saved",
    "Saving",
    "Error",
    "Like",
    "Reply",
    "Repost",
    "Share",
    "Translate",
    "View activity"
  ]);

  function safeText(node) {
    if (!node) {
      return null;
    }

    const text = node.textContent?.replace(/\s+/g, " ").trim();
    return text || null;
  }

  function cleanPostText(text) {
    if (!text) {
      return null;
    }

    const cleaned = text
      .replace(/\bTranslate(?:\s+\d+\/\d+)?\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned || null;
  }

  function hasAllClasses(element, classNames) {
    return classNames.every((className) => element.classList?.contains(className));
  }

  function uniqueElements(elements) {
    return [...new Set(elements.filter(Boolean))];
  }

  function visibleTextLength(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().length;
  }

  function elementArea(element) {
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
  }

  function hasMetricText(element) {
    return looksLikeMetric((element.textContent || "").trim());
  }

  function hasThreadsPostClassSignature(element) {
    return hasAllClasses(element, THREADS_POST_CLASS_SIGNATURE);
  }

  function looksLikePostContainer(element) {
    if (!element || !isElementVisible(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const hasAuthorLink = Boolean(element.querySelector("a[href*='/@']"));
    const hasActionControl = Boolean(element.querySelector("button, [role='button']"));
    const textLength = visibleTextLength(element);

    return hasAuthorLink && hasActionControl && rect.width >= 280 && rect.height >= 70 && textLength >= 20;
  }

  function keepSmallestPostContainers(candidates) {
    const sorted = uniqueElements(candidates)
      .filter(looksLikePostContainer)
      .sort((a, b) => elementArea(a) - elementArea(b));

    const selected = [];

    for (const candidate of sorted) {
      const alreadyCovered = selected.some((post) => candidate.contains(post));

      if (!alreadyCovered) {
        selected.push(candidate);
      }
    }

    return selected;
  }

  function closestPostContainerFromLink(link) {
    let current = link;

    for (let depth = 0; current && current !== document.body && depth < 12; depth += 1) {
      current = current.parentElement;

      if (looksLikePostContainer(current)) {
        return current;
      }
    }

    return null;
  }

  function findPostContainers(root = document) {
    const candidates = [];
    const divs = [
      ...(root.matches?.("div") ? [root] : []),
      ...root.querySelectorAll("div")
    ];
    candidates.push(...divs.filter(hasThreadsPostClassSignature));

    const semanticSelectors = "article, [role='article']";
    candidates.push(...[
      ...(root.matches?.(semanticSelectors) ? [root] : []),
      ...root.querySelectorAll(semanticSelectors)
    ]);

    const postLinkSelector = "a[href*='/post/']";
    const postLinks = [
      ...(root.matches?.(postLinkSelector) ? [root] : []),
      ...root.querySelectorAll(postLinkSelector)
    ];
    candidates.push(...postLinks.map(closestPostContainerFromLink).filter(Boolean));

    return keepSmallestPostContainers(candidates);
  }

  function parseThreadPosition(text) {
    const match = text?.match(/\b(\d+)\/(\d+)\b/);

    if (!match) {
      return null;
    }

    const position = Number(match[1]);
    const total = Number(match[2]);

    if (!Number.isInteger(position) || !Number.isInteger(total) || position < 1 || total < position) {
      return null;
    }

    return {
      position,
      total
    };
  }

  function findThreadInfo(container) {
    const chainIndicator = [...container.querySelectorAll("div")]
      .find((element) => hasAllClasses(element, THREADS_CHAIN_INDICATOR_CLASSES));
    const indicatorInfo = parseThreadPosition(safeText(chainIndicator));

    if (indicatorInfo) {
      return indicatorInfo;
    }

    const text = safeText(container) || "";
    return parseThreadPosition(text.match(/\bTranslate\s+\d+\/\d+\b/i)?.[0] || text);
  }

  function absoluteUrl(href) {
    if (!href) {
      return null;
    }

    try {
      return new URL(href, window.location.origin).toString();
    } catch {
      return null;
    }
  }

  function findPostUrl(container) {
    const anchors = [...container.querySelectorAll("a[href]")];
    const postLink = anchors.find((anchor) => POST_PATH_PATTERN.test(anchor.getAttribute("href") || ""));
    return absoluteUrl(postLink?.getAttribute("href")) || absoluteUrl(window.location.href);
  }

  function findUsername(container, url) {
    const username = [...container.querySelectorAll("span")]
      .filter((element) => hasAllClasses(element, THREADS_USERNAME_AND_VIEW_CLASSES))
      .map((node) => safeText(node))
      .find((text) => {
        if (!text || text.includes("views") || looksLikeTimestamp(text) || looksLikeMetric(text)) {
          return false;
        }

        return /^[a-z0-9._]+$/i.test(text);
      });

    if (username) {
      return username.startsWith("@") ? username : `@${username}`;
    }

    const urlMatch = url?.match(/\/@([^/]+)/);
    return urlMatch?.[1] ? `@${urlMatch[1]}` : null;
  }

  function looksLikeTimestamp(text) {
    return /^(\d+\s*[smhdw]|now)$/i.test(text);
  }

  function findPostedAt(container) {
    const time = [...container.querySelectorAll("time")]
      .find((element) => hasAllClasses(element, THREADS_TIME_CLASSES)) || container.querySelector("time");

    return time?.getAttribute("datetime") || safeText(time);
  }

  function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isInsideIgnoredElement(element) {
    return Boolean(element.closest(
      ".threads-personal-clipper-wrap, button, [role='button'], svg, a[href*='/post/']"
    ));
  }

  function looksLikeMetric(text) {
    return /^\d+(?:[.,]\d+)?\s*[KMB]?$/i.test(text);
  }

  function getTextBlocks(container) {
    return [...container.querySelectorAll("span, div, [data-lexical-text='true']")]
      .filter((node) => isElementVisible(node) && !isInsideIgnoredElement(node))
      .filter((node) => node.children.length === 0 || node.matches("[data-lexical-text='true']"))
      .map((node) => safeText(node))
      .map(cleanPostText)
      .filter(Boolean);
  }

  function findPostText(container, username) {
    const ignoredTexts = new Set([
      username
    ].filter(Boolean));

    const candidates = getTextBlocks(container)
      .filter((text) => text && !ignoredTexts.has(text))
      .filter((text) => !UI_TEXT.has(text))
      .filter((text) => !/^Translate(?:\s+\d+\/\d+)?$/i.test(text))
      .filter((text) => !looksLikeTimestamp(text))
      .filter((text) => !looksLikeMetric(text))
      .filter((text) => !text.startsWith("@"));

    if (candidates.length === 0) {
      return null;
    }

    // Threads often stores each paragraph as its own visible block.
    const paragraphLike = candidates.filter((text) => text.length > 12);
    const uniqueParagraphs = [...new Set(paragraphLike)];

    if (uniqueParagraphs.length > 1) {
      return uniqueParagraphs.join("\n");
    }

    return uniqueParagraphs[0] || candidates.sort((a, b) => b.length - a.length)[0] || null;
  }

  function parseCompactNumber(value) {
    if (!value) {
      return null;
    }

    const normalized = value.replace(/,/g, "").trim();
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);

    if (!match) {
      return null;
    }

    const amount = Number(match[1]);
    const suffix = match[2]?.toUpperCase();
    const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;

    return Number.isFinite(amount) ? Math.round(amount * multiplier) : null;
  }

  function findMetric(container, names) {
    const labelPattern = new RegExp(`(\\d+(?:[\\.,]\\d+)?\\s*[KMB]?)\\s+(${names.join("|")})`, "i");
    const reversePattern = new RegExp(`(${names.join("|")})\\s+(\\d+(?:[\\.,]\\d+)?\\s*[KMB]?)`, "i");
    const text = safeText(container) || "";
    const labelMatch = text.match(labelPattern);
    const reverseMatch = text.match(reversePattern);

    return parseCompactNumber(labelMatch?.[1] || reverseMatch?.[2] || null);
  }

  function getActionControls(container) {
    return [...container.querySelectorAll("button, [role='button']")]
      .filter((control) => isElementVisible(control))
      .filter((control) => !control.closest(".threads-personal-clipper-wrap"));
  }

  function findThreadsActionRow(container) {
    const rows = [...container.querySelectorAll(`div.${THREADS_ACTION_ROW_CLASS}`)]
      .filter((row) => isElementVisible(row))
      .filter((row) => !row.closest(".threads-personal-clipper-wrap"))
      .filter((row) => {
        const hasShareIcon = Boolean(row.querySelector("svg[aria-label='Share']"));
        if (!hasShareIcon) {
          return false;
        }

        const controls = [...row.querySelectorAll("button, [role='button']")]
          .filter(isElementVisible);
        const metricCount = [...row.querySelectorAll("span, div")]
          .filter((element) => element.children.length === 0)
          .map(safeText)
          .filter(looksLikeMetric)
          .length;

        return controls.length >= 2 || metricCount >= 2;
      });

    return rows
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0] || null;
  }

  function findShareControl(container) {
    const shareSvg = container.querySelector("svg[aria-label='Share']");

    if (!shareSvg) {
      return null;
    }

    const actionRow = findThreadsActionRow(container);

    if (actionRow) {
      return [...actionRow.children].find((child) => child.contains(shareSvg)) || null;
    }

    return null;
  }

  function getControlLabel(control) {
    return [
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      safeText(control)
    ].filter(Boolean).join(" ");
  }

  function findMetricFromActions(container, names) {
    const controls = getActionControls(container);
    const pattern = new RegExp(names.join("|"), "i");

    for (const control of controls) {
      const label = getControlLabel(control);

      if (!pattern.test(label)) {
        continue;
      }

      const value = label.match(/\d+(?:[.,]\d+)?\s*[KMB]?/i)?.[0];
      const parsed = parseCompactNumber(value);

      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }

  function findMetricsByActionOrder(container) {
    const metrics = {
      likes: null,
      replies: null,
      reposts: null,
      shares: null
    };

    const actionRow = findThreadsActionRow(container);
    const metricSource = actionRow
      ? [...actionRow.querySelectorAll("span, div")].filter((element) => element.children.length === 0)
      : getActionControls(container);
    const values = metricSource
      .map((element) => safeText(element)?.match(/^\d+(?:[.,]\d+)?\s*[KMB]?$/i)?.[0] || null)
      .map(parseCompactNumber)
      .filter((value) => value !== null);

    if (values.length >= 4) {
      [metrics.likes, metrics.replies, metrics.reposts, metrics.shares] = values;
    } else if (values.length === 3) {
      [metrics.likes, metrics.reposts, metrics.shares] = values;
    } else if (values.length === 2) {
      [metrics.likes, metrics.reposts] = values;
    } else if (values.length === 1) {
      [metrics.likes] = values;
    }

    return metrics;
  }

  function parseViewsFromText(text) {
    if (!text || !/\bviews?\b/i.test(text)) {
      return null;
    }

    const beforeLabel = text.match(/(\d+(?:[.,]\d+)?\s*[KMB]?)\s*views?\b/i)?.[1];
    const afterLabel = text.match(/\bviews?\s*(\d+(?:[.,]\d+)?\s*[KMB]?)/i)?.[1];
    return parseCompactNumber(beforeLabel || afterLabel || null);
  }

  function closestTextWithViews(element, container) {
    let current = element;

    for (let depth = 0; current && current !== container && depth < 4; depth += 1) {
      const text = safeText(current);

      if (/\bviews?\b/i.test(text || "")) {
        return text;
      }

      current = current.parentElement;
    }

    return null;
  }

  function findViews(container) {
    const signatureElements = uniqueElements([
      ...container.querySelectorAll("span"),
      ...document.querySelectorAll("span")
    ])
      .filter((element) => hasAllClasses(element, THREADS_USERNAME_AND_VIEW_CLASSES));
    const directView = signatureElements
      .map(safeText)
      .map(parseViewsFromText)
      .find((views) => views !== null);

    if (directView !== undefined) {
      return directView;
    }

    const signatureTexts = signatureElements.flatMap((element) => [
      safeText(element),
      closestTextWithViews(element, container)
    ]);
    const allTexts = [
      ...signatureTexts,
      ...[...container.querySelectorAll("span, div")]
        .filter((element) => element.children.length === 0)
        .map(safeText),
      safeText(container)
    ].filter(Boolean);

    for (const text of allTexts) {
      const views = parseViewsFromText(text);

      if (views !== null) {
        return views;
      }
    }

    return null;
  }

  async function hashText(text) {
    const input = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", input);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function createId(url, text, username, savedAt) {
    if (url && POST_PATH_PATTERN.test(url)) {
      return `threads:${new URL(url).pathname}`;
    }

    const fallback = `${text || ""}|${username || ""}|${savedAt}`;
    return `threads:local:${await hashText(fallback)}`;
  }

  function readValue(reader, fallback) {
    try {
      const value = reader();
      return value === undefined ? fallback : value;
    } catch (error) {
      console.warn("Threads Personal Clipper parser fallback:", error);
      return fallback;
    }
  }

  async function createSafeId(url, text, username, savedAt) {
    try {
      return await createId(url, text, username, savedAt);
    } catch (error) {
      console.warn("Threads Personal Clipper id fallback:", error);
      return `threads:local:${Date.now()}`;
    }
  }

  async function parsePost(container) {
    const savedAt = new Date().toISOString();
    const url = readValue(() => findPostUrl(container), null);
    const username = readValue(() => findUsername(container, url), null);
    const postedAt = readValue(() => findPostedAt(container), null);
    const text = readValue(() => findPostText(container, username), null);
    const orderedMetrics = readValue(() => findMetricsByActionOrder(container), {
      likes: null,
      replies: null,
      reposts: null,
      shares: null
    });
    const thread = readValue(() => findThreadInfo(container), null);
    const views = readValue(() => findViews(container), null);

    return {
      id: await createSafeId(url, text, username, savedAt),
      url,
      author: {
        username
      },
      text,
      metrics: {
        likes: readValue(() => findMetricFromActions(container, ["like", "likes"]) ?? findMetric(container, ["like", "likes"]), orderedMetrics.likes) ?? orderedMetrics.likes,
        replies: readValue(() => findMetricFromActions(container, ["reply", "replies"]) ?? findMetric(container, ["reply", "replies"]), orderedMetrics.replies) ?? orderedMetrics.replies,
        reposts: readValue(() => findMetricFromActions(container, ["repost", "reposts"]) ?? findMetric(container, ["repost", "reposts"]), orderedMetrics.reposts) ?? orderedMetrics.reposts,
        shares: readValue(() => findMetricFromActions(container, ["share", "shares"]), orderedMetrics.shares) ?? orderedMetrics.shares,
        views
      },
      thread,
      type: "single",
      postedAt,
      savedAt,
      source: "threads",
      schemaVersion: 1
    };
  }

  return {
    findPostContainers,
    findShareControl,
    parsePost
  };
})();

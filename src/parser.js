const ThreadsParser = (() => {
  const POST_PATH_PATTERN = /\/@[^/]+\/post\/[^/?#]+/;
  const PROFILE_PATH_PATTERN = /\/@([^/?#]+)/;
  const ACTION_LABELS = {
    likes: ["Like", "Likes"],
    replies: ["Reply", "Replies"],
    reposts: ["Repost", "Reposts"],
    shares: ["Share", "Shares"]
  };
  const ACTION_KEYWORDS = {
    likes: ["like", "likes"],
    replies: ["reply", "replies", "comment", "comments"],
    reposts: ["repost", "reposts", "re-share", "reshare"],
    shares: ["share", "shares", "send"]
  };
  const ACTION_ORDER = ["likes", "replies", "reposts", "shares"];

  // Fallbacks only. Prefer semantic DOM signals above these account-sensitive classes.
  const THREADS_ACTION_ROW_CLASS = "x78zum5";
  const THREADS_USERNAME_AND_VIEW_CLASSES = [
    "x1lliihq",
    "x193iq5w",
    "x6ikm8r",
    "x10wlt62",
    "xlyipyv",
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
    "Likes",
    "Reply",
    "Replies",
    "Repost",
    "Reposts",
    "Share",
    "Shares",
    "Translate",
    "View activity",
    "Top"
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

  function isElementVisible(element) {
    if (!element?.getBoundingClientRect) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function visibleTextLength(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().length;
  }

  function elementArea(element) {
    const rect = element.getBoundingClientRect();
    return rect.width * rect.height;
  }

  function looksLikeMetric(text) {
    return /^\d+(?:[.,]\d+)?\s*[KMB]?$/i.test(text || "");
  }

  function parseCompactNumber(value) {
    if (!value) {
      return null;
    }

    const normalized = value.replace(/,/g, ".").trim();
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(K|M|B|rb|jt)?$/i);

    if (!match) {
      return null;
    }

    const amount = Number(match[1]);
    const suffix = match[2]?.toUpperCase();
    const multiplier = suffix === "K" || suffix === "RB"
      ? 1_000
      : suffix === "M" || suffix === "JT"
        ? 1_000_000
        : suffix === "B"
          ? 1_000_000_000
          : 1;

    return Number.isFinite(amount) ? Math.round(amount * multiplier) : null;
  }

  function getSvgLabel(svg) {
    return [
      svg.getAttribute("aria-label"),
      svg.getAttribute("title"),
      svg.querySelector("title")?.textContent,
      svg.closest("[aria-label]")?.getAttribute("aria-label")
    ].filter(Boolean).join(" ");
  }

  function inferActionKey(svg) {
    const label = getSvgLabel(svg).toLowerCase();
    const keywordMatch = Object.entries(ACTION_KEYWORDS)
      .find(([, keywords]) => keywords.some((keyword) => label.includes(keyword)));

    if (keywordMatch) {
      return keywordMatch[0];
    }

    const pathData = [...svg.querySelectorAll("path")]
      .map((path) => path.getAttribute("d") || "")
      .join(" ");

    if (/M7\.2474 1\.49853|20\.8245 15\.0329|20\.2247 13/.test(pathData)) {
      return "shares";
    }

    return null;
  }

  function getActionSvgs(root) {
    return [...root.querySelectorAll("svg[aria-label], svg[role='img']")]
      .filter(isElementVisible)
      .filter((svg) => inferActionKey(svg));
  }

  function getVisibleSvgs(root) {
    return [...root.querySelectorAll("svg[aria-label], svg[role='img'], svg")]
      .filter(isElementVisible)
      .filter((svg) => !svg.closest(".threads-personal-clipper-wrap"));
  }

  function hasActionIcon(container, actionKey) {
    return getActionSvgs(container).some((svg) => inferActionKey(svg) === actionKey);
  }

  function getProfileAnchors(container) {
    return [...container.querySelectorAll("a[href*='/@']")];
  }

  function getPostAnchors(container) {
    return [...container.querySelectorAll("a[href*='/post/']")]
      .filter((anchor) => POST_PATH_PATTERN.test(anchor.getAttribute("href") || ""));
  }

  function looksLikePostContainer(element) {
    if (!element || !isElementVisible(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const hasProfileOrPostLink = getProfileAnchors(element).length > 0 || getPostAnchors(element).length > 0;
    const hasTime = Boolean(element.querySelector("time"));
    const visibleSvgCount = getVisibleSvgs(element).length;
    const metricCount = [...element.querySelectorAll("span, div")]
      .filter((node) => node.children.length === 0)
      .map(safeText)
      .filter(looksLikeMetric)
      .length;
    const actionCount = ["likes", "replies", "reposts", "shares"].filter((action) => hasActionIcon(element, action)).length;
    const hasShare = hasActionIcon(element, "shares");
    const hasActions = hasShare || actionCount >= 2 || (visibleSvgCount >= 4 && metricCount >= 1);
    const hasText = visibleTextLength(element) >= 20;
    const looksPostSized = rect.width >= 280 && rect.height >= 70;

    return looksPostSized && hasProfileOrPostLink && hasActions && hasText && (hasTime || getPostAnchors(element).length > 0 || hasShare);
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

  function closestPostContainerFromElement(element) {
    let current = element;

    for (let depth = 0; current && current !== document.body && depth < 14; depth += 1) {
      current = current.parentElement;

      if (looksLikePostContainer(current)) {
        return current;
      }
    }

    return null;
  }

  function findPostContainers(root = document) {
    const candidates = [];
    const semanticSelectors = "article, [role='article']";
    candidates.push(...[
      ...(root.matches?.(semanticSelectors) ? [root] : []),
      ...root.querySelectorAll(semanticSelectors)
    ]);

    const anchorsAndTimes = [
      ...(root.matches?.("a[href*='/@'], a[href*='/post/'], time") ? [root] : []),
      ...root.querySelectorAll("a[href*='/@'], a[href*='/post/'], time")
    ];
    candidates.push(...anchorsAndTimes.map(closestPostContainerFromElement).filter(Boolean));

    const shareSvgs = [
      ...(root.matches?.("svg[aria-label='Share']") ? [root] : []),
      ...root.querySelectorAll("svg[aria-label='Share']")
    ];
    candidates.push(...shareSvgs.map(closestPostContainerFromElement).filter(Boolean));

    const fallbackDivs = [
      ...(root.matches?.("div") ? [root] : []),
      ...root.querySelectorAll("div")
    ];
    candidates.push(...fallbackDivs.filter((element) => hasAllClasses(element, THREADS_POST_CLASS_SIGNATURE)));

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
    const translateText = [...container.querySelectorAll("span, div")]
      .map(safeText)
      .find((text) => /\bTranslate\s+\d+\/\d+\b/i.test(text || ""));
    const translateInfo = parseThreadPosition(translateText);

    if (translateInfo) {
      return translateInfo;
    }

    const explicitCounter = [...container.querySelectorAll("span, div")]
      .filter((element) => element.children.length === 0)
      .map(safeText)
      .find((text) => /^\d+\/\d+$/.test(text || ""));
    const counterInfo = parseThreadPosition(explicitCounter);

    if (counterInfo) {
      return counterInfo;
    }

    const chainIndicator = [...container.querySelectorAll("div")]
      .find((element) => hasAllClasses(element, THREADS_CHAIN_INDICATOR_CLASSES));
    return parseThreadPosition(safeText(chainIndicator));
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
    const postLink = getPostAnchors(container)[0];
    return absoluteUrl(postLink?.getAttribute("href")) || absoluteUrl(window.location.href);
  }

  function usernameFromUrl(url) {
    const match = url?.match(PROFILE_PATH_PATTERN);
    return match?.[1] ? `@${match[1]}` : null;
  }

  function findUsername(container, url) {
    const urlUsername = usernameFromUrl(url);
    if (urlUsername) {
      return urlUsername;
    }

    const profileAnchor = getProfileAnchors(container)
      .find((anchor) => usernameFromUrl(anchor.getAttribute("href")));
    const anchorUsername = usernameFromUrl(profileAnchor?.getAttribute("href"));
    if (anchorUsername) {
      return anchorUsername;
    }

    const fallbackUsername = [...container.querySelectorAll("span")]
      .filter((element) => hasAllClasses(element, THREADS_USERNAME_AND_VIEW_CLASSES))
      .map(safeText)
      .find((text) => text && !text.includes("views") && !looksLikeTimestamp(text) && !looksLikeMetric(text) && /^[a-z0-9._]+$/i.test(text));

    return fallbackUsername ? `@${fallbackUsername.replace(/^@/, "")}` : null;
  }

  function looksLikeTimestamp(text) {
    return /^(\d+\s*[smhdw]|now)$/i.test(text || "");
  }

  function findPostedAt(container) {
    const time = container.querySelector("time");
    return time?.getAttribute("datetime") || safeText(time);
  }

  function isInsideIgnoredElement(element) {
    return Boolean(element.closest(
      ".threads-personal-clipper-wrap, button, [role='button'], svg, a[href*='/post/']"
    ));
  }

  function getTextBlocks(container) {
    return [...container.querySelectorAll("span, div, [data-lexical-text='true']")]
      .filter((node) => isElementVisible(node) && !isInsideIgnoredElement(node))
      .filter((node) => node.children.length === 0 || node.matches("[data-lexical-text='true']"))
      .map(safeText)
      .map(cleanPostText)
      .filter(Boolean);
  }

  function findPostText(container, username) {
    const ignoredTexts = new Set([
      username,
      username?.replace(/^@/, "")
    ].filter(Boolean));

    const candidates = getTextBlocks(container)
      .filter((text) => text && !ignoredTexts.has(text))
      .filter((text) => !UI_TEXT.has(text))
      .filter((text) => !/^Translate(?:\s+\d+\/\d+)?$/i.test(text))
      .filter((text) => !looksLikeTimestamp(text))
      .filter((text) => !looksLikeMetric(text))
      .filter((text) => !/^\d+\/\d+$/.test(text))
      .filter((text) => !/\bviews?\b/i.test(text))
      .filter((text) => !text.startsWith("@"));

    if (candidates.length === 0) {
      return null;
    }

    const paragraphLike = candidates.filter((text) => text.length > 12);
    const uniqueParagraphs = [...new Set(paragraphLike)];

    if (uniqueParagraphs.length > 1) {
      return uniqueParagraphs.join("\n");
    }

    return uniqueParagraphs[0] || candidates.sort((a, b) => b.length - a.length)[0] || null;
  }

  function findMetric(container, names) {
    const labelPattern = new RegExp(`(\\d+(?:[\\.,]\\d+)?\\s*[KMB]?)\\s+(${names.join("|")})`, "i");
    const reversePattern = new RegExp(`(${names.join("|")})\\s+(\\d+(?:[\\.,]\\d+)?\\s*[KMB]?)`, "i");
    const text = safeText(container) || "";
    const labelMatch = text.match(labelPattern);
    const reverseMatch = text.match(reversePattern);

    return parseCompactNumber(labelMatch?.[1] || reverseMatch?.[2] || null);
  }

  function getActionAncestor(svg, container) {
    let current = svg;

    for (let depth = 0; current?.parentElement && current.parentElement !== container && depth < 6; depth += 1) {
      current = current.parentElement;

      if (current.matches?.("button, [role='button']")) {
        return current;
      }

      const text = safeText(current) || "";
      const hasMetric = /\d+(?:[.,]\d+)?\s*[KMB]?/i.test(text);
      const nearbySvgs = current.querySelectorAll("svg[aria-label], svg[role='img']").length;

      if (hasMetric || nearbySvgs === 1) {
        return current;
      }
    }

    return svg.parentElement;
  }

  function directChildContaining(parent, descendant) {
    let current = descendant;

    while (current?.parentElement && current.parentElement !== parent) {
      current = current.parentElement;
    }

    return current?.parentElement === parent ? current : null;
  }

  function actionUnitForSvg(row, svg, container) {
    const directChild = directChildContaining(row, svg);

    if (directChild && getVisibleSvgs(directChild).length === 1) {
      return directChild;
    }

    return getActionAncestor(svg, container);
  }

  function getFallbackActionItems(container) {
    const row = findFallbackActionRow(container);

    if (!row) {
      return [];
    }

    return getVisibleSvgs(row)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
      .slice(0, ACTION_ORDER.length)
      .map((svg, index) => ({
        key: ACTION_ORDER[index],
        svg,
        control: actionUnitForSvg(row, svg, container)
      }))
      .filter((item) => item.key && item.control);
  }

  function findActionItems(container) {
    const semanticItems = getActionSvgs(container)
      .map((svg) => ({
        key: inferActionKey(svg),
        svg,
        control: getActionAncestor(svg, container)
      }))
      .filter((item) => item.key && item.control);
    const missingSemanticActions = ACTION_ORDER.some((key) => !semanticItems.some((item) => item.key === key));

    if (!missingSemanticActions) {
      return semanticItems;
    }

    const fallbackItems = getFallbackActionItems(container);
    const merged = new Map(semanticItems.map((item) => [item.key, item]));

    for (const item of fallbackItems) {
      if (!merged.has(item.key)) {
        merged.set(item.key, item);
      }
    }

    return [...merged.values()];
  }

  function findThreadsActionRow(container) {
    const actionItems = findActionItems(container);
    const shareItem = actionItems.find((item) => item.key === "shares");

    if (!shareItem) {
      return null;
    }

    let current = shareItem.control;

    for (let depth = 0; current && current !== container && depth < 8; depth += 1) {
      const actionCount = actionItems.filter((item) => current.contains(item.control)).length;

      if (actionCount >= 3) {
        return current;
      }

      current = current.parentElement;
    }

    return [...container.querySelectorAll(`div.${THREADS_ACTION_ROW_CLASS}`)]
      .filter((row) => isElementVisible(row) && row.querySelector("svg[aria-label='Share']"))
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0] || null;
  }

  function findFallbackActionRow(container) {
    const rows = [...container.querySelectorAll("div, [role='group']")]
      .filter(isElementVisible)
      .filter((row) => {
        const svgs = getVisibleSvgs(row);
        const metrics = [...row.querySelectorAll("span, div")]
          .filter((element) => element.children.length === 0)
          .map(safeText)
          .filter(looksLikeMetric);

        return svgs.length >= 4 && metrics.length >= 1;
      });

    return rows
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        const areaDiff = elementArea(a) - elementArea(b);
        return areaDiff || bRect.top - aRect.top;
      })[0] || null;
  }

  function findShareControl(container) {
    const shareItem = findActionItems(container).find((item) => item.key === "shares");
    if (!shareItem) {
      return null;
    }

    const actionRow = findThreadsActionRow(container);
    return actionRow
      ? [...actionRow.children].find((child) => child.contains(shareItem.svg)) || shareItem.control
      : shareItem.control;
  }

  function metricFromControl(control) {
    if (!control) {
      return null;
    }

    const metricText = [...control.querySelectorAll("span, div")]
      .filter((element) => element.children.length === 0)
      .map(safeText)
      .find(looksLikeMetric);

    return parseCompactNumber(metricText || safeText(control)?.match(/\d+(?:[.,]\d+)?\s*[KMB]?/i)?.[0] || null);
  }

  function getControlLabel(control) {
    return [
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      safeText(control)
    ].filter(Boolean).join(" ");
  }

  function findMetricFromActions(container, names) {
    const pattern = new RegExp(names.join("|"), "i");

    for (const item of findActionItems(container)) {
      const label = `${getSvgLabel(item.svg)} ${getControlLabel(item.control)}`;

      if (!pattern.test(label)) {
        continue;
      }

      const parsed = metricFromControl(item.control);
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
    const byKey = new Map(findActionItems(container).map((item) => [item.key, item]));

    for (const key of ACTION_ORDER) {
      metrics[key] = metricFromControl(byKey.get(key)?.control);
    }

    return metrics;
  }

  function parseViewsFromText(text) {
    if (!text || !/(?:\bviews?\b|\btayangan\b)/i.test(text)) {
      return null;
    }

    const beforeLabel = text.match(/(\d+(?:[.,]\d+)?\s*(?:[KMB]|rb|jt)?)\s*(?:views?|tayangan)\b/i)?.[1];
    const afterLabel = text.match(/\b(?:views?|tayangan)\s*(\d+(?:[.,]\d+)?\s*(?:[KMB]|rb|jt)?)/i)?.[1];
    return parseCompactNumber(beforeLabel || afterLabel || null);
  }

  function findViews(container) {
    const texts = [
      ...[...container.querySelectorAll("span, div")]
        .filter((element) => element.children.length === 0)
        .map(safeText),
      ...[...document.querySelectorAll("span")]
        .filter((element) => hasAllClasses(element, THREADS_USERNAME_AND_VIEW_CLASSES))
        .map(safeText),
      safeText(container)
    ].filter(Boolean);

    for (const text of texts) {
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
        likes: readValue(() => findMetricFromActions(container, ACTION_LABELS.likes) ?? findMetric(container, ACTION_LABELS.likes), orderedMetrics.likes) ?? orderedMetrics.likes,
        replies: readValue(() => findMetricFromActions(container, ACTION_LABELS.replies) ?? findMetric(container, ACTION_LABELS.replies), orderedMetrics.replies) ?? orderedMetrics.replies,
        reposts: readValue(() => findMetricFromActions(container, ACTION_LABELS.reposts) ?? findMetric(container, ACTION_LABELS.reposts), orderedMetrics.reposts) ?? orderedMetrics.reposts,
        shares: readValue(() => findMetricFromActions(container, ACTION_LABELS.shares), orderedMetrics.shares) ?? orderedMetrics.shares,
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

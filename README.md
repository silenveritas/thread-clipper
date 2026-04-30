# Threads Personal Clipper

A local-only Chrome Manifest V3 extension for manually saving visible Threads posts.

## Branch: Dynamic Parser

This branch (`update-parser-dinamis`) refactors the Threads parser so it is less dependent on account-specific, obfuscated class names. The main parsing path now uses more semantic DOM signals:

- `time` elements for post time.
- Threads profile/post links that contain `/@username` and `/post/`.
- action icons such as `Like`, `Reply`, `Repost`, and `Share`.
- visible post text after filtering UI labels like `Translate`.
- nearby DOM relationships between action icons and their metric text.

Known Threads class names are still kept in `src/parser.js`, but only as fallback selectors.

## What It Does

- Adds a small **Save** button to visible Threads post containers.
- Saves only posts that you manually click.
- Stores clips locally with `chrome.storage.local`.
- Shows saved clips in the extension popup.
- Supports popup search, sorting, and pagination.
- Supports editing, deleting, clearing, importing, and exporting saved clips as JSON.
- Labels clips as **Short** for single posts and **Long** for chain/thread posts.

## What It Does Not Do

- It does not auto-scroll.
- It does not crawl or scrape pages automatically.
- It does not bypass login, authentication, rate limits, or platform restrictions.
- It does not send saved data to any external server.

## Local Installation

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Visit `https://www.threads.com/`.
6. Use the injected **Save** button on posts you want to keep.
7. Open the extension popup to view, clear, or export saved clips.

## Data Schema

Saved clips use this shape:

```json
{
  "id": "string",
  "url": "string or null",
  "author": {
    "username": "string or null"
  },
  "text": "string or null",
  "metrics": {
    "likes": "number or null",
    "replies": "number or null",
    "reposts": "number or null",
    "shares": "number or null",
    "views": "number or null"
  },
  "thread": {
    "position": "number",
    "total": "number"
  },
  "type": "single",
  "postedAt": "Threads timestamp or datetime, string or null",
  "savedAt": "ISO timestamp",
  "source": "threads",
  "schemaVersion": 1
}
```

`thread` is `null` when the saved post is not part of a visible chain indicator like `1/9`.

## Notes

Threads markup can change, so parsing is intentionally defensive. Missing fields are saved as `null` instead of causing the clip action to fail.

Most Threads DOM maintenance should happen in `src/parser.js`. `src/content.js` intentionally stays thin: it asks the parser for post containers, asks where the Share control is, injects the Save button there, and sends parsed clips to the background script.

## If Threads DOM Changes

If saving, parsing, or button placement breaks, inspect a working Threads post and provide these DOM details:

- Post container: the smallest outer element that wraps exactly one post.
- Post URL/profile URL: links that include `/@username` or `/@username/post/...`.
- Action row: the HTML around Like, Reply, Repost, and Share.
- Action icons: the `svg` attributes and `<title>` text for Like, Reply, Repost, and Share.
- Share button: the wrapper around the Share icon, because Save is inserted next to it.
- Chain indicator: the visible text/wrapper for labels like `1/9`, usually near `Translate`.
- Username: the visible username element and the nearest profile link.
- Post time: the `<time>` element and whether it has a `datetime` attribute.
- Views: the exact text used by the account/language, such as `952 views` or `952 tayangan`.
- Text body: a sample snippet showing actual post text plus nearby UI labels that should be ignored.

Where to update code:

- `src/parser.js`
  - Prefer semantic signals first: `time`, profile/post links, `svg[aria-label]`, visible text, and nearby action wrappers. Keep class names as fallback only.
  - `ACTION_LABELS`: update when metric labels change, such as Like, Reply, Repost, or Share.
  - `ACTION_KEYWORDS`: update when icon labels, titles, or localized action words change.
  - `findPostContainers()`: update when post container detection breaks.
  - `findShareControl()`: update when the Share icon/wrapper structure changes.
  - `findActionItems()` and `getFallbackActionItems()`: update when action metrics stop mapping correctly.
  - `THREADS_USERNAME_AND_VIEW_CLASSES`: update when username or views span classes change.
  - `THREADS_CHAIN_INDICATOR_CLASSES`: update when the `1/9` chain badge classes change.
  - `THREADS_POST_CLASS_SIGNATURE`: update only as a fallback when semantic container detection is not enough.
  - `findPostText()`: update when the text body starts including UI text again.
  - `findMetricsByActionOrder()`: update if Threads changes the order of Like, Reply, Repost, Share.
  - `parseViewsFromText()`: update when Threads changes the views label, for example another language besides `views` or `tayangan`.

- `src/content.js`
  - Change this only for extension behavior or style, such as Save button text, click handling, scan frequency, or injected button CSS.

After editing, reload the unpacked extension at `chrome://extensions` and refresh the Threads page.

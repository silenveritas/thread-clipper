# Threads Personal Clipper

A local-only Chrome Manifest V3 extension for manually saving visible Threads posts.

## What It Does

- Adds a small **Save** button to visible Threads post containers.
- Saves only posts that you manually click.
- Stores clips locally with `chrome.storage.local`.
- Shows saved clips in the extension popup.
- Supports popup search, sorting, and pagination.
- Supports editing, deleting, clearing, importing, and exporting saved clips as JSON.

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

## If Threads DOM Changes

If saving, parsing, or button placement breaks, inspect a working Threads post and provide these DOM details:

- Post container: the outer `div` class list that wraps exactly one post.
- Action row: the `div` class list that contains Like, Reply, Repost, and Share.
- Share button: the outer wrapper HTML/class list around the Share icon.
- Chain indicator: the wrapper HTML/class list for labels like `1/9`.
- Username: the element tag and full class list for the username text.
- Post time: the `<time>` element class list and whether it has a `datetime` attribute.
- Views: the element tag and class list containing text like `5.2K views`.
- Text body: one or two sample elements/classes that contain the actual post text.

Where to update code:

- `src/parser.js`
  - `THREADS_POST_CLASS_SIGNATURE`: update when the one-post container class changes.
  - `THREADS_ACTION_ROW_CLASS`: update when the Like/Reply/Repost/Share row class changes.
  - `THREADS_USERNAME_AND_VIEW_CLASSES`: update when username or views span classes change.
  - `THREADS_TIME_CLASSES`: update when the post `<time>` classes change.
  - `THREADS_CHAIN_INDICATOR_CLASSES`: update when the `1/9` chain badge classes change.
  - `findPostContainers()`: update when post container detection breaks.
  - `findShareControl()`: update when the Share icon/wrapper structure changes.
  - `findPostText()`: update when the text body starts including UI text again.
  - `findMetricsByActionOrder()`: update if Threads changes the order of Like, Reply, Repost, Share.

- `src/content.js`
  - Change this only for extension behavior or style, such as Save button text, click handling, scan frequency, or injected button CSS.

After editing, reload the unpacked extension at `chrome://extensions` and refresh the Threads page.

# Widget

Standalone client-side widget for submitting bug reports.

## Current scope

- Floating launcher.
- Report form with description.
- Image attachments (PNG, JPEG, WebP, GIF), up to 5 files.
- Per-file size limit: 10 MiB (10 MB in the user-facing validation message); up to 5 files.
- Click-to-select and drag-and-drop.
- Local UI states for sending, error and success.
- Sends bug reports to the configured API.
- Collects the current page URL, user agent, timestamp, console logs and unhandled browser errors.
- Uploads selected image attachments and collected console logs to the API.
- Captures a PNG screenshot of the visible viewport when a report starts.
- Masks likely sensitive fields in that screenshot before it is encoded.

Client-side file limits are UX/abuse-resistance controls only; they are not a security boundary. The future API must enforce its own file-size, count, request-rate and payload limits because client-side validation cannot be trusted as a security boundary.

## Screenshot masking

The screenshot is taken with `html-to-image`, at viewport resolution, as a PNG
under 2 MiB. It is downscaled if it exceeds that limit, and skipped entirely if
it still does not fit. A failed capture never blocks the report.

Before the page is encoded, likely sensitive fields are masked and restored
immediately afterwards. Detection runs on heuristics and requires no markup
from the host page: password inputs, `autocomplete` values in the `cc-*`,
`one-time-code`, `tel` and `email` families, and text or input values matching
JWTs, `sk_`/`pk_`/`rk_` API keys, IBANs, card numbers, PESEL numbers, ID card
numbers, phone numbers and email addresses. A host can also mark an element
with `data-bugshot-mask`.

Configure it through `window.BUGSHOT_CONFIG` in `config.js`, which needs no
build step:

```js
window.BUGSHOT_CONFIG = {
  apiBaseUrl: "http://localhost:8080",
  mask: {
    mode: "blur",       // blur (default) | cover | dots | off
    useDefaults: true,  // keep the built-in heuristics
    selectors: [],      // extra CSS selectors
    patterns: [],       // extra regular expressions, as strings
  },
};
```

`blur` and `cover` are pure CSS layers and never touch page content. `dots`
replaces text node values and input values, which reproduces the host layout
most faithfully but does mutate the page for the duration of the capture.
Invalid selectors and patterns are skipped and reported on
`window.BUGSHOT_MASK.last` rather than breaking the capture.

### What masking does not cover

Masking is a best-effort reduction of accidental exposure, not a guarantee.
The heuristics match identifiers with a fixed shape. They do not match
free-form personal data, and in testing they left names, postal addresses,
account balances and anything inside a cross-origin iframe fully readable.
Anyone deploying this widget on a page with sensitive data has to add their own
selectors and patterns, and should assume a screenshot may still contain
personal data.

## Local preview

For browser testing, serve the `widget/` directory over HTTP instead of opening the file directly. This avoids `file://` unique-origin restrictions and better matches real deployment.

From the repository root, run:

```powershell
python -m http.server 5500 --directory widget
```

Then open `http://127.0.0.1:5500/`. Stop the server with `Ctrl+C`.

## Integration boundary

The submission transport is isolated in `widget.js` inside `submitReport()`, with attachment uploads handled separately. The API base URL is provided by the widget configuration.

The widget uses a scoped CSS namespace and does not intentionally modify host-page layout styles.

# Widget

Standalone client-side widget for submitting bug reports.

## Current scope

- Floating launcher.
- Report form with description.
- Image attachments (PNG, JPEG, WebP, GIF), up to 5 files.
- Per-file size limit: 10 MiB (10 MB in the user-facing validation message); up to 5 files.
- Click-to-select and drag-and-drop.
- Local UI states for sending, error and success.
- No network requests, storage, cookies or browser data collection are implemented yet.

Client-side file limits are UX/abuse-resistance controls only; they are not a security boundary. The future API must enforce its own file-size, count, request-rate and payload limits because client-side validation cannot be trusted as a security boundary.

## Local preview

For browser testing, serve the `widget/` directory over HTTP instead of opening the file directly. This avoids `file://` unique-origin restrictions and better matches real deployment.

From the repository root, run:

```powershell
python -m http.server 5500 --directory widget
```

Then open `http://127.0.0.1:5500/`. Stop the server with `Ctrl+C`.

## Integration boundary

The submission transport is isolated in `widget.js` inside `submitReport()`. Replace that function with the approved API integration when the backend endpoint and payload contract are available.

The widget uses a scoped CSS namespace and does not intentionally modify host-page layout styles.

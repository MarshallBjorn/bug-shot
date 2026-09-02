# Vendored dependencies

The widget ships as plain `<script>` tags with no build step, so third-party
code is committed here instead of being pulled from a package manager.

## html-to-image

- Version: 1.11.13
- Source: https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js
- SHA-256: `a90b42909d80964269ef6d5f3d1e4a5a7e2a4c263a5d2a76a9e7151901343262`
- License: MIT

Used by `capture.js` to render the visible viewport into a PNG. Chosen over
html2canvas and modern-screenshot after a comparison against native Chrome
screenshots; html2canvas is heavier and less faithful, and modern-screenshot
misplaces same-origin iframes.

To update, download the new dist, replace the file and update the version and
hash above.

# Independent PCB colors

Request: choose a different solder mask color for each PCB.
Baseline: `7d1dd60`, clean tracked and untracked state on `main`.

The PCB panel's Both / Left / Right selector now controls both edition and color.
Each half retains its own mask and contrasting ink in the model and thumbnails.
Download notes and the build summary name the color for each board's quote.
Gerbers do not encode solder mask color; existing PCB sources and packages remain
byte-identical. Existing paired configurations retain their original color.

Acceptance passed: independent edition and color choices across all four sizes;
actual board material and ink colors; save/reload; a shared design opened in a
fresh browser context; undo/redo; paired color selection; and the 390 px Spanish
mobile layout. Desktop and mobile captures were visually inspected. There were
no browser errors. The configuration contract passes 178 fixtures with exact
JavaScript/Python parity, including malformed maps and legacy scalar colors.
Receipts: `validation/pcb-viewer.json`, `validation/revI-viewer.json`.

Reproduce with the existing viewer dependencies and generated scene:

```sh
node viewer/config-contract-check.cjs
npm --prefix viewer run build
node viewer/pcb-check.cjs
```

Set `FLAN36_PLAYWRIGHT_MODULE` to the installed Playwright module when it is
outside `node_modules`. Chromium 151.0.7922.34 was used with the check's default
Metal flags. The scene's regeneration is documented in `pcb-identity.md`.
The browser check closes its browser and server, writes the verification receipt,
and recreates the ignored captures in `build/pcb-identity/`. The unchanged README
image hash confirms that the existing paired black/Asanoha appearance is preserved.

Delivery target: configured public `origin/main` and its Pages explorer.
Two independent read-only reviews (domain and adversarial) recommend normal
commit/push, with no HIGH/CRITICAL findings. All 22 reviewed file hashes remained
unchanged. The thumbnail color split depends on the generator's existing
right-first layout and spacing; both reviewers checked that agreement.

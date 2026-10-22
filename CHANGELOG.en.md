# Changelog

Notable changes to **dsh-goodies** land here. Each entry is compared against the previous release only; internal iteration stays out. The Chinese edition lives in [CHANGELOG.md](CHANGELOG.md).

## [0.1.2] - 2026-10-22

### Changed

- **The reasoning panel opens and closes more gently**: it fades in more slowly and now fades out, whether you use the back button, Escape, Shift+Tab, or a click outside.
- **A back button in the panel's top-left corner**: one click returns to the model list without closing the menu.
- **The report's speed shows up more often**: it prefers the time actually spent producing text, and falls back to an estimate over generation time only.

### Fixed

- **The pane did not open when it was reopened right after going back**: it opens again immediately, and the menu no longer stays blank.
- **Leaving the reasoning pane flashed a whole panel once**: the panel is no longer rebuilt during the return, and it never covers the model list that just appeared.

## [0.1.1] - 2026-10-22

### Changed

- **The compatibility claim now lists only the releases that were checked**: the supported range narrows to DSH 0.2.1-rc.1 and 0.2.1-rc.2, and prereleases that were never tested are no longer named.

## [0.1.0] - 2026-10-21

First release: a browser-only plugin with an effort slider, a live speed and turn-total readout beside the running status, and a per-answer report, each behind its own switch.

### Added

- **Effort slider**: the reasoning-level pane becomes a wide rail with a white thumb; drag or tap to switch, with the current level name above it and the model's real default marked.
- **Native level names**: every position comes from the model's own list — no renaming, no invented Off; a model that exposes off shows it as-is.
- **Motion and snapping**: particles in the track grow in number and speed with the level, running light blue to deep blue; releasing or tapping snaps to the nearest level by which side of the midpoint the thumb centre falls on, and the animation can be interrupted and continued from where it is.
- **Live tokens/second**: star, speed and turn total on the right of the running-status row, counting only time that actually produced tokens.
- **Turn total**: same accounting as the turn usage panel, abbreviated with K / M / B above a thousand, monotonic while the turn runs.
- **Per-answer report**: input · output · cached next to the usage pill, total time and output speed next to the answer's time, an em dash when a piece is missing.
- **Settings card and reduce motion**: one switch per feature; reduce motion only stops animation and never changes a reading.

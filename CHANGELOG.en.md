# Changelog

Notable changes to **dsh-goodies** land here. The Chinese edition lives in [CHANGELOG.md](CHANGELOG.md).

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

### Fixed

- **A blue sliver at the leftmost level**: the fill now ends at the thumb centre and is exactly zero at the first level.
- **The thumb looked like a rounded rectangle**: `corner-shape` makes the thumb, the rail and the fill properly round.
- **A seam between fill and thumb**: the fill runs under the thumb centre and is masked to the thumb circle, so the corners no longer show the rail behind.
- **Position jumping back during rapid taps**: a single animation loop now continues from the thumb's real position when the target changes.
- **The live HUD crashed as soon as it appeared**: the render path referenced a removed variable; elapsed time is computed from the start again.
- **The total showed a whole-session figure**: it now aggregates the current turn instead of the whole log.

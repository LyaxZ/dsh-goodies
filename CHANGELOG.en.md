# Changelog

Notable changes to **dsh-goodies** land here. Each entry is compared against the previous release only; internal iteration stays out. The Chinese edition lives in [CHANGELOG.md](CHANGELOG.md).

## [0.2.3] - 2026-11-11

### Changed

- **Live HUD**: the star and the waveform keep their place while the digits change, the reading sits against the bars, and the whole row scales with the window and the font.

## [0.2.2] - 2026-11-07

### Changed

- **Send button feedback** has its own switch under Motion enhancements; turning it off removes the hover glow and the press response.
- **Live HUD**: the settings section is renamed from "Live reading", and a "token speed waveform" switch is added.
- **Effort slider**: the native menu's grouped items are recognised again, so the slider is not blocked by a wrapper.

## [0.2.1] - 2026-11-06

### Changed

- **Plugin copy**: the market card and repository summary now name the live HUD, the report cards and the interface motion; the display name is "Goodies (dsh-goodies)".

## [0.2.0] - 2026-11-06

### Added

- **Live speed waveform**: a per-second bar waveform during a turn, rising and falling smoothly and narrowing when the numbers grow.
- **Per-answer report**: input, output, cache, total time and speed under each answer; clicking a figure opens its card.
- **Speed card**: peak, average and the per-second curve, drawn from the recorded readings.
- **Time-split card**: first token, thinking, waiting, reply, tools and other, with a per-tool breakdown.
- **Motion settings**: a new section with separate switches for row, card and HUD motion, all on by default.
- **Send button feedback**: a soft glow on hover and a small press response.

### Changed

- **The report under a narrow window** shares the width evenly instead of hiding figures one by one.
- **Report order**: usage, input/output/cache, duration and speed, then the clock.

### Compatibility

- Supports DSH 0.2.2-rc.1.

## [0.1.13] - 2026-11-03

### Fixed

- **The turn report was cut off in a narrow conversation column**: the figures now step out in order as the room runs short, and dragging the sidebar re-lays them out immediately.
- **Loose gaps appeared between the usage pill and the clock once figures were gone**: a position that has nothing left to show is removed with its spacing.

## [0.1.12] - 2026-11-03

### Fixed

- **The turn report overlapped its neighbours in a narrow window**: the less important figures now step out as room runs short, so what remains no longer runs into the usage pill and the clock.

## [0.1.11] - 2026-10-30

### Fixed

- **The total restarted between generations within one turn**: a tool call in the middle no longer sends the count back to zero.
- **The reading stayed at zero through the thinking phase**: counting now starts with the first reasoning, not with the first visible text.
- **Switching pages reset the total**: the reading comes back on return instead of waiting for new text.

### Changed

- **A session switch shows that session's reading**: the previous session's number is no longer shown for a moment.

## [0.1.10] - 2026-10-29

### Fixed

- **The model menu could not be opened after the effort slider was switched off**: the feature no longer affects the native menu while it is disabled.
- **A finished turn could go unannounced after a setting change or a page switch**: the run clock is no longer restarted by an edit.
- **The title hint flashed for no visible time in the foreground without notification permission**: it now stays long enough to read.
- **A keyboard-only user never heard the chime**: the first reminder opens the audio output.
- **The settings card could show a session count of zero**: the list is picked up when it becomes available.
- **Keyboard level switching could commit the same level twice**: the rail follows the rows that are actually open.

### Changed

- **Less repeated work while an answer streams**: the interface refreshes only when needed, which matters on long answers and long histories.
- **Memory no longer grows with the number of sessions**: finished sessions are dropped, and the stylesheet goes away with the plugin.
- **The live channel answers only local requests**: anything from another address is rejected.

## [0.1.9] - 2026-10-29

### Fixed

- **The report's output speed read low**: the timing now covers only the time spent generating, without pauses or tool waits.

### Changed

- **The report's speed no longer carries an approximation mark**: a measured generation window is shown as a plain number.

## [0.1.8] - 2026-10-28

### Fixed

- **The published package and the release asset carry the same bytes**: three text files in the previous version used different line endings inside the npm package; behaviour was unaffected, but the two downloads differed.

## [0.1.7] - 2026-10-28

### Changed

- **The declared range now covers 0.2.1-rc.3, 0.2.1-rc.4 and 0.2.2-alpha.2**: each pair behaves as declared, and 0.3 stays outside the supported range.
## [0.1.6] - 2026-10-24

### Changed

- **The settings card is split by feature**: each of the four can be expanded on its own, and the notification switches and permission sit together in the completion-notification section, leaving room for further options.
- **The chime no longer depends on the system notification**: the two switches are independent, so a silenced notification still leaves the chime audible.
## [0.1.5] - 2026-10-24

### Changed

- **The live reading follows the output**: speed and the turn count rise with the generation itself, hold still during a tool call, and carry on afterwards.
- **The count covers this turn's generated content only**: prose, reasoning and tool-call arguments count; prompt and cache do not. It starts over with each turn.
- **The effort panel follows the dark theme**: on a dark surface the strongest setting is the lightest tone, and the rail runs the same way.

### Fixed

- **A new message no longer opens on the previous turn's count**: the reading stays at zero until the reply begins.
- **The count keeps growing after a tool call**: a multi-step answer no longer stalls or restarts.
## [0.1.4] - 2026-10-22

### Added

- **Completion notification**: a system notification when a turn finishes, titled with the session and carrying how long it took; clicking it returns to that session. It also fires while the page is in front, and falls back to flashing the title without permission.
- **Notification sound**: an optional soft chime for the completion notification, with its own switch.

### Changed

- **The settings card gained two rows**: the notification switch, and the permission status with a request button. The old "reduce motion" switch is gone; the system-level reduced-motion preference still applies.
- **A turn with very few output tokens shows no speed**: most of its time is connection and first-token wait, so the derived rate means nothing and the field is now omitted.

## [0.1.3] - 2026-10-22

### Changed

- **The live reading follows the answer more closely**: the total takes the larger of the provider's usage and the text already produced, calibrated by the turn's own token-to-character ratio, so it moves as the text grows instead of waiting for a whole chunk.
- **The speed is a rolling 1.2-second window**: no heavy smoothing, so it rises and falls with the actual pace.
- **The report's average speed counts generation time only**: it prefers each step's first-token-to-finish span, then the sum of those spans, then the turn minus its tool calls.

### Fixed

- **The live reading restarted after switching sessions**: the total and the clock are kept per session and turn, so coming back shows the same numbers.
- **The total could be smaller than the per-second speed**: both readings now come from the same source, and the total never drops below what has been produced.
- **The report's speed read too low**: time spent in tools and waiting is no longer in the denominator.

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

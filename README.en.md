# dsh-goodies

> **English** | [中文](README.md)

A small set of conveniences for the DeepSeek Harness (DSH) Web GUI: an effort slider in the model menu, a live speed and turn-total readout next to the running status, a per-answer report, and a completion notification when a turn finishes. Each feature has its own switch; all of them are interface-only and never change model requests, session content, or send data anywhere.

## Features

- **Effort slider**: the reasoning-level pane becomes a wide rail with a white thumb; drag or tap to switch, the current level name sits above it, and the model's real default is marked. Level names are always the model's own, with no invented Off. The track carries a particle stream that grows and speeds up with the level, running from light blue to deep blue.
- **Live tokens/second**: `★ speed · turn total` on the right of the running-status row, read straight from the model stream. The speed counts only time that actually produced tokens, so tool waits are excluded; the total covers this turn's generated content — prose, reasoning and tool-call arguments — without the prompt or the cache, abbreviated with K / M / B above a thousand.
- **Per-answer report**: input · output · cached next to the usage pill, total time and output speed next to the answer's time. Missing pieces read `—` instead of disappearing; a turn with very few output tokens shows no speed at all rather than counting connection time as generation.
- **Completion notification**: a system notification when a turn finishes — the session title and how long it took — and clicking it returns to that session. It also fires while the page is in front, falls back to flashing the title without permission, and can play a soft chime.
- **Settings card**: in Settings → Plugins → DSH Goodies, with one switch per feature plus the notification sound and permission rows.

## Compatibility

| Plugin version | Supported DSH versions |
| --- | --- |
| **0.1.x** (latest, 0.1.8) | 0.2.1-rc.1 through 0.2.1-rc.4, 0.2.2-alpha.2 |

## Install

Through the DSH CLI:

```
dsh plugin --profile web add dsh-goodies
```

Or straight from GitHub:

```
dsh plugin --profile web add github:LyaxZ/dsh-goodies
```

Restart DSH afterwards, then refresh the page.

## Usage

Open **Settings → Plugins → DSH Goodies** and turn on what you want.

- The slider takes over the reasoning-level pane; names stay native and the real default is marked.
- The live speed and the report appear on their own while a turn runs.
- "Reduce motion" only touches animation, never the readings.

## Development

```powershell
node build.mjs      # writes lib/
node test/run.mjs   # offline checks: style contract, pure helpers, build artifacts
```

- `src/shared.cjs`: pure helpers and styles shared by the browser and the offline suite.
- `src/client.js`: the browser half with the three features and the settings card.
- `src/index.mjs`: the host half, only the settings schema.
- `lib/`: build output; do not edit by hand.
- `test/hud-probe.mjs`: injects a fake running row and checks the live HUD and the star breathing (needs a page URL with a token).

## License

MIT

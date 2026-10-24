# Market listing (awesome-dsh-plugin)

The listing is one file added to `awesome-dsh-plugin/awesome-dsh-plugin`:
`data/plugins/LyaxZ__dsh-goodies.yml`, whose content is [`entry.yml`](entry.yml).

Requirements checked before submitting:

- `dsh.bundle` is declared in `package.json` (with `cordis.patch.yml` at the root).
- The repo carries the `dsh-plugin` topic.
- The repo is at least one day old — created 2026-10-21T16:00Z, so the PR can go in
  now.
- The published npm package points its `repository` field back at this repo.
- The description says only what the code does.

## What the plugin actually installs

Two halves. The browser half draws the slider, the live reading, the report and the
settings card. The host half counts the model stream (one hook, read-only) and
serves the reading on `/dsh-goodies/live`; it never changes a request, a session or
a stored file.

## Pull request

Title:

```
Add dsh-goodies: an effort slider, a live speed reading, a per-answer report and a completion notification
```

Body:

```
Adds one plugin entry, `data/plugins/LyaxZ__dsh-goodies.yml`, and touches nothing else.

**dsh-goodies** — a small set of interface conveniences for the DeepSeek Harness
Web GUI, each with its own switch in Settings → Plugins:

- the model menu's reasoning-level pane becomes a wide slider with a white thumb;
  level names stay native, and the model's real default is marked;
- the running-status row gains a live tokens/second reading and the turn's
  generated-token count, counted from the model stream itself so it rises with
  the output and holds still during tool calls;
- each answer's usage row gains input / output / cached, and its time row gains
  total time and output speed;
- a completion notification (and an independent chime) fires when a turn ends.

It is interface-only: no request, session or workspace file is touched, and
nothing leaves the machine. The one host hook counts stream chunks to produce the
live reading.

MIT. Repository: https://github.com/LyaxZ/dsh-goodies
Package: https://www.npmjs.com/package/dsh-goodies
```

## Command

```powershell
git clone https://github.com/LyaxZ/awesome-dsh-plugin.git $env:TEMP\awesome-dsh
cd $env:TEMP\awesome-dsh
git checkout -b goodies-entry
New-Item -ItemType Directory -Force data\plugins | Out-Null
Copy-Item "F:\deepseek harness\dsh-goodies\docs\market\entry.yml" data\plugins\LyaxZ__dsh-goodies.yml
git add data/plugins/LyaxZ__dsh-goodies.yml
git commit -m "Add dsh-goodies"
git push origin goodies-entry
# then open the PR with the title and body above
```

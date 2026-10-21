# Market listing (awesome-dsh-plugin)

The listing is one file added to `awesome-dsh-plugin/awesome-dsh-plugin`:
`data/plugins/LyaxZ__dsh-goodies.yml`, whose content is [`entry.yml`](entry.yml).

Requirements checked before submitting:

- `dsh.bundle` is declared in `package.json` (with `cordis.patch.yml` at the root).
- The repo carries the `dsh-plugin` topic.
- The repo is at least one day old — it was created on 2026-10-22, so the PR can
  go in on 2026-10-23 or later.
- The published npm package points its `repository` field back at this repo.
- The description says only what the code does.

## Pull request

Title:

```
Add dsh-goodies: an effort slider, a live speed reading and a per-answer report
```

Body:

```
Adds one plugin entry, `data/plugins/LyaxZ__dsh-goodies.yml`, and touches nothing else.

**dsh-goodies** — a small set of interface conveniences for the DeepSeek Harness
Web GUI, each with its own switch in Settings → Plugins:

- the model menu's reasoning-level pane becomes a wide slider with a white thumb;
  level names stay native, and the model's real default is marked;
- the running-status row gains a live tokens/second reading (counting only time
  that produced tokens) and the turn's total token count;
- each answer's usage row gains input / output / cached, and its time row gains
  total time and output speed.

Client half only, no host behaviour beyond the settings schema, MIT.

Repository: https://github.com/LyaxZ/dsh-goodies
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

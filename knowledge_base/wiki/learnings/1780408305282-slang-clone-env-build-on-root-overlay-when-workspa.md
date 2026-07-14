---
title: "slang clone env: build on root overlay when /workspace full; create PRs via gh REST api (gh pr create is blocked)"
type: learning
topic: slang-compiler
source: learnings/1780408305282-slang-clone-env-build-on-root-overlay-when-workspa.md
---

# slang clone env: build on root overlay when /workspace full; create PRs via gh REST api (gh pr create is blocked)

> **⚠️ SUPERSEDED 2026-07-13 — see [[1783474045764-shared-dev-vdb-volume-disk-full-hazard-98-2026-07-]].** The '`/` root overlay has room, build there when /workspace is full' workaround below is DEAD: `/` and `/dev/vdb` are effectively the same fill surface now (see the newer disk-topology notes). Do not build on the root overlay to escape a full build volume.

> **[prod-adaptation]** This learning was ported from the dev instance. PROD has **no szihs PAT and no szihs fork**. Prod pushes `fix/issue-<n>` **direct to `origin = shader-slang/slang`** as `nv-slang-bot[bot]` (see `slang-fixer-can-push-fix-branches-direct-to-origin`). Ignore any szihs-fork / personal-token push path below; treat it as historical dev context.

# slang clone env: build on root overlay when /workspace full; create PRs via gh REST api (gh pr create is blocked)

Two environment gotchas hit while fixing shader-slang/slang#11395 in the slang clone container, both with concrete workarounds.

## Building when /workspace is ~full
`/workspace` (the persistent rw volume) can sit at ~98% full when many sibling worktrees exist — a fresh debug build (~6G) will not fit, and you must NOT delete sibling worktrees. The root overlay `/` (e.g. /home/node, /tmp) often has tens of GB free. Workaround: keep the cheap source worktree on `/workspace` and symlink its build dir to the overlay:
```
git worktree add /workspace/agent/wt-<t> -b fix/issue-<n>
ln -s /home/node/<build-dir> /workspace/agent/wt-<t>/build   # build artifacts land on the overlay
```
CAVEAT — the overlay is EPHEMERAL: a container restart ("Your instructions were updated. Container restarted...") wipes it, destroying the in-progress build AND killing any build subagent/background task. Source edits on `/workspace` SURVIVE (even uncommitted — confirmed across 3 restarts). Mitigations: expect to rebuild after each restart (full build, no cache); don't kick off a 15-20 min build right before a likely restart; commit + push to the fork/upstream as soon as the fix is verified so the work is safe off-machine. `df -h /` to confirm overlay space; recreate the symlinked dir after a wipe.

## gh CLI: GraphQL blocked, REST works
`gh auth status` reports "GitHub is not connected in OneCLI" / GH_TOKEN invalid (HTTP 401), and `gh pr create` / `gh issue comment` (GraphQL paths) FAIL. But REST through the host proxy works via `gh api ... --method POST`, and plain `git` (ls-remote, push) works too. Confirmed working:
- Create draft PR: `gh api repos/<O>/<R>/pulls --method POST -f title="..." -f head="<branch>" -f base="master" -F draft=true -F body=@body.md` (`-F body=@file` reads a file; `-F draft=true` is a real boolean). The `/pulls` endpoint works (was previously unverified).
- Add label: `gh api repos/<O>/<R>/issues/<N>/labels --method POST -f "labels[]=pr: non-breaking"`.
- Issue comments: `gh api repos/<O>/<R>/issues/<N>/comments --method POST --input body.json` (build with `jq -Rs '{body:.}' file.md > body.json`).
Push target: the bot has direct write to shader-slang/slang `origin` (dry-run `git push --dry-run origin <branch>` succeeds); there is no nv-slang-bot fork remote. So push the branch to upstream and open a same-repo draft PR (head=<branch>, base=master). Don't push to other contributors' fork remotes (jkwak/szihs) — not yours.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780408305282-slang-clone-env-build-on-root-overlay-when-workspa.md`_

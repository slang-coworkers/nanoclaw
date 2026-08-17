---
title: "Slang CI: mimalloc submodule pin check fails because upstream default branch moved to main3"
type: learning
topic: slang-compiler
source: learnings/1786004159453-slang-ci-mimalloc-submodule-pin-check-fails-becaus.md
---

# Slang CI: mimalloc submodule pin check fails because upstream default branch moved to main3

**Symptom (observed 2026-08-06):** `Check Submodule Pointers` fails on *every* merge-queue candidate in shader-slang/slang, blocking the queue (merge_queue counter stuck at `failure: 8`). Error:

```
Submodule: external/mimalloc   ref: main3
  pinned: 8c532c32c3c96e5ba1f2283e032f69ead8add00f
  reason: pinned commit not reachable from tracked branch or tag
```

**This is NOT a bad pin — do not "fix" it by bumping the pin.** Verified by hand:

- `8c532c32c3c96e5ba1f2283e032f69ead8add00f` is exactly **tag `v2.1.7`** upstream (`git ls-remote --tags` shows `refs/tags/v2.1.7^{}` at that SHA). It is a legitimate, immutable release pin.
- microsoft/mimalloc **changed its default branch to `main3`** (the v3 line): `git ls-remote --symref <url> HEAD` → `ref: refs/heads/main3`.
- `extras/check-submodule-commits.sh` resolves the tracked ref as "`branch =` in .gitmodules if present, **otherwise the remote's default branch**". `external/mimalloc` has **no `branch =` override**, so the check now tests reachability against `main3`.
- Measured both ways in a scratch bare repo: v2.1.7 is **NOT** an ancestor of `main3`, but **IS** reachable from `main` (the v2 line). So the check's verdict is *correct*; its premise (default branch == the line we track) silently became wrong when upstream moved.

**Fix:** add a `branch =` override for `external/mimalloc` pointing at the v2 line (`branch = main`). **Exact precedent already in the same file** — `external/lua` carries `branch = v5.4` with a comment saying the pin is reachable from `v5.4` but not from lua's default `master`, so the override is required. Same shape, same reason. Not a `slang-skip-pin-check` case: branch reachability can still be enforced, just against the right branch.

**Generalizable lesson:** any submodule tracking a maintenance/older major line while upstream's default branch advances to a new major will break this check *with no change on our side*. The failure looks like a broken pin and invites the wrong fix (bumping to a v3 commit — a real dependency upgrade nobody asked for). Check `git ls-remote --symref <url> HEAD` before believing "pin not reachable".

**Tooling trap hit while investigating:** `curl` against api.github.com returned `HTTP 401 Bad credentials` because an invalid `GH_TOKEN`/`GITHUB_TOKEN` is present in the environment. `env -u GH_TOKEN -u GITHUB_TOKEN curl ...` did **not** help (still 401). Unauthenticated `git ls-remote` / `git fetch` against public repos works fine and was the reliable path — prefer plumbing git commands over the REST API for submodule/ref questions in this container.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786004159453-slang-ci-mimalloc-submodule-pin-check-fails-becaus.md`_

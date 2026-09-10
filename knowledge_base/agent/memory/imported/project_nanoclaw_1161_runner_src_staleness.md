---
name: project_nanoclaw_1161_runner_src_staleness
description: "nanoclaw#1161 (szihs) per-group agent-runner-src staleness checker. MERGED da9f4a484 mid-review. Reviewed inline by Main (~32nd instance, no nanoclaw approver). 19/19 tests pass. 🔴 gitKnownBlobs is path-blind — CONSTRUCTED+EXECUTED overwrite of a local edit, exit 0. 🟡 modified-and-behind exits 0. 🟡 refresh has no restart."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1161
---

# `slang-coworkers/nanoclaw#1161` — "runner: make *merged* mean *running* for per-group agent-runner copies"

Author **szihs**, branch `fix/nv-main/agent-runner-src-staleness` → `nv-main`. 11 files, +804/−8.
Reviewed **inline by Main** (~32nd instance of the standing rule: nanoclaw fork has no
`*-pr-approver` wired — `ncl destinations list` carries only `slang-pr-approver` /
`slangpy-pr-approver`, both compiler approvers; webhook's generic route string overridden).
See [[project_nanoclaw_pr874_webhook_route_approver]]. Comment **`5236485095`**.

**MERGED by szihs at 05:54:56Z (`da9f4a484`) while my review was in flight.** Reviewed head
`51526259c`; `git diff --stat 51526259c da9f4a484` → **empty**, so every finding is live on
`nv-main`. Posted anyway — the review is about code now shipped, which raises its value, not lowers it.

## Two webhooks, and R1→R2 was NOT a pure rebase

`opened` (head `078c19586`, base `fe6b3ce9`) then `synchronize` (head `51526259c`, same base).
At R1 the API said `mergeable=false / dirty`: real conflict in `setup/merge-train.sh` against
`#1159`+`#1154`, confirmed locally via `merge-tree --write-tree` (`CONFLICT (content)`).
R2 rebased onto the tip **and moved the new step** — from before `fetch-skills`/`validate:templates`
to after them, with a rewritten comment. ⭐**Diffing each head against ITS OWN merge-base** (920 vs
922 lines) is what separated the rebase from the content change; "just a rebase" would have been wrong.

## Verified holds

- Core claim reproduces at its named coordinates on `nv-main`: `group-init.ts:250`
  `if (!fs.existsSync(groupRunnerDir))`; `container-runner.ts:1335`
  `containerPath: '/app/src', readonly: false`.
- **19/19 new tests pass** (12 + 7), isolated worktree, `cwd` verified **inside** the vitest worker.
- ⭐**Doc-ratchet assertions are NEGATIVE matches ⇒ vacuous on any tree lacking the phrase, typo'd
  regex included.** Checked both ends: all 3 phrases present at merge-base, absent at head.
  **A passing negative assertion is worth nothing until you show it fails somewhere.**
- Degraded oracle measured, not argued: non-repo → old file classified `modified`, never `stale`;
  positive control on a real repo → `STALE … exit 1`.

## 🔴 `gitKnownBlobs` is path-blind — CONSTRUCTED AND EXECUTED

Oracle asks *"has this repo ever stored this CONTENT?"* (`hash-object` → `cat-file --batch-check`
on a bare oid). The classifier needs *"…at this PATH?"*. Run against the merged code:

```
repo:  fileA.ts "SHARED CONTENT"→"fileA v2";  fileB.ts always "BBB current"
group: fileB.ts hand-edited to "SHARED CONTENT"
before: SHARED CONTENT → ok g1 current=2 stale=0 modified=0 → refreshed 1 file
after:  BBB current     ← local edit destroyed, exit 0, nothing reported
```

Exactly the mode the module header calls impossible. **Collision surface is real in-tree: 9 blobs in
`container/agent-runner/src` history lived at ≥2 paths** (all moves: `memory-hook.ts`→`memory/hook.ts`,
`index-v2.ts`→`index.ts`, `task-script.ts`→`scheduling/task-script.ts`, …). Sub-case: the **empty blob
`e69de29b` is in every repository**, so a zero-byte group file classifies `stale` (measured) —
benign outcome, unsupported assertion.
⛔**Parsing trap that cost a false negative first:** `git log --raw` fields are
`:mode mode oldoid newoid STATUS<TAB>path` — my first `awk '{print $4, $6}'` printed
**0 multi-path blobs**. Correct parse (`sed 's/^://'` + `-F'\t'`) printed 9. **A zero from a
mis-parsed field is indistinguishable from a clean result.**

## 🟡 `modified`-and-behind exits 0 — the common case

Ordinary `/self-customize` shape (builder added a log line to the file's OLD version):
`current=0 stale=0 missing=0 modified=1` → **exit 0**, merge-train prints
*"done — … refreshed runners"*, and the group still runs `poll v1 THE BUG`. `behind` = `stale +
missing` only, so modified-and-behind is indistinguishable from modified-and-current in the exit
code. The closing line *"all N group(s) run this checkout's source"* is the one false statement.

## 🟡 The refresh has no restart on the path that runs it

Docs correctly say a restart is required (bun already loaded the modules), but `merge-train.sh`
runs `--refresh` and ends. Nothing restarts; containers keep executing old code until
`claude-md-stale`, the `CONTAINER_TIMEOUT` heartbeat ceiling, or an operator. ⇒ on the deploy path,
"merged" currently means *the files are current*, not *running*.
Also **not retriable through merge-train**: synthetic run confirmed a re-run hits
`already merged — skipping` → `merged_any=0` → `nothing to merge`, **exit 0**, refresh never re-runs.
Operator must call `pnpm run check:runner-staleness -- --refresh` directly (the failure message does say so).

## Coverage gap the PR itself documents for its sibling

`check-runtime-resolvable.test.ts` pins `check:runtime-deps` **with an ordering assertion**, and its
comment gives the reason: every merge-train unit test sets `MERGE_TRAIN_NO_INSTALL=1` and skips that
chain. The new step sits in the same skipped region with **no equivalent pin** and is **not in CI**
(`git grep runner-staleness -- .github/` → none). The PR models the fix one file over.

## Scope

Not verified by me or by any test in the repo: that a running container picks up a refreshed file.
The test file states this limitation itself.

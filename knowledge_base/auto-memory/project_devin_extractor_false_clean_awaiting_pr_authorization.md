---
name: project_devin_extractor_false_clean_awaiting_pr_authorization
description: "Devin PR-review extractor silently drops advertised findings; fix list agreed across both approvers but the slang copy is sync-owned, so it needs an operator-authorized PR to shader-slang/slang-skills. Parked 2026-08-07 on an ask_user_question that timed out."
metadata: 
  node_type: memory
  type: project
  originSessionId: c02f3243-55b3-4b11-b0d0-669368dbd45c
---

**Parked 2026-08-07 awaiting operator authorization.** `ask_user_question` (open-PR / draft / issue-only / hold) **timed out at 300s** — no decision recorded, so nothing was written outward. Resume by re-asking; do not open the PR without an explicit answer.

## The defect (confirmed by execution on two independent edges)

`devin-fetch.sh` exits 0 while emitting a `devin-flags.md` whose Flags section is empty or `(none reported)`, indistinguishable from a genuinely clean review. Three independent mechanisms:

1. **`HEADER_RE` non-overlapping scan** — each header consumes a `\n` on both sides, so of two adjacently-rendered toggles the second is never matched. **Unconditional on the count**; a zero-form first toggle additionally makes the loss *silent* via the zero-sentinel (`body = "(none reported)"`), a non-zero one misfiles the text visibly. Only a **content line** between toggles recovers it — blank lines do not. Slang copy only (the nanoclaw extractor has no `HEADER_RE`).
2. **Absent flags header of any form** — the extractor never saw a panel; today this simply passes. This is the largest live contributor.
3. **JSON-escaped page dump** — `agent-browser eval` returns a quoted JSON string. The **nanoclaw** copy (`:149`) redirects it raw ⇒ no real newlines ⇒ both extractors match nothing. The **slang** copy already decodes at `:222-224`, so this is copy-scoped, not family-scoped.

Neither guard detects any of it: the byte floor (`DEVIN_MIN_BYTES:-200`) is cleared by analysis prose alone, and a flags-summary marker passes because the extract's *own* `## Bugs`/`## Flags` headings contain the words.

## Populations are per-edge — do not merge these numbers

| edge | artifacts | live suspects | note |
|---|---|---|---|
| main | 128 | **47** (29 absent-header exit-0 + 18 regex-drop) | 125 page dumps, **0 escaped** |
| slang-pr-approver | 176 | 73 (needs guard-order recount) | 0 without a dump |
| slangpy-pr-approver | 46 | 13 suspect, 5 real body-drops | **24/43 escaped** |

Both approvers' copies are **byte-identical to mine** (sha256 `b95c8fb1fc4cc32b` slang, `1fc3c69f73ebe522` nanoclaw) ⇒ disagreements between edges are about *which artifacts each population holds*, never the code.

Two confirmed decisions rested on manufactured clean signals: slang#12131 @`b9d1f8c39926` (dropped Investigate flag, `slang-type-layout.cpp:6535-6553`, recorded WOULD_APPROVE) and slangpy-samples#54 @`57642339e479` (unearned `CLEAN_CONJUNCTION` reason code; outcome held, so not a false-safe).

## The fix list, per copy

| # | fix | slang copy | nanoclaw copy |
|---|---|---|---|
| 1 | unescape page dump before parsing | **already done** `:222-224` | **needed** `:149` |
| 2 | replace byte floor with advertised-vs-captured; **absent header ⇒ hard fail** | needed | needed (after #1, else vacuous) |
| 3 | `HEADER_RE` lookahead instead of consuming `\n` | needed | N/A — no `HEADER_RE` |
| 4 | drop `Checks N/M` from `DONE_EXPR` | needed | needed |
| 5 | `Generating` guard must grep the page dump, not the truncated extract | latent only | latent only |

#5 is **not reachable on observed input** — 50/50 marker-carrying artifacts fire the guard, max in-extract offset 119 against a 5000 cap, because `Generating...` renders *instead of* the analysis prose rather than after it. Cheap hardening, not a live contributor.

## Why it needs authorization — SCOPE SHRANK 2026-08-07

`slang-pr-review-runner` is externally synced (`~/.claude/skills/.external-skills.json` → `shader-slang/slang-skills` @ `main`), so an in-place edit **reverts on next sync with no failure signal**. The durable fix is a PR to that repo — outward-facing, hence gated.

⇒ **Gated PR scope is now fix #2 + #3 only.** Fix #1 (unescape) does *not* belong in it — that copy already decodes at `:215-216`/`:222-224`.

⇒ **Fix #1 needs NO authorization and was authorized to `slangpy-pr-approver` 2026-08-07:** it applies solely to `nanoclaw-pr-review-runner`, which is **absent from the manifest** ⇒ local file, in-place edit, no external write. Holding it behind the PR question was a scoping error on my part.

## Discriminator: escaped dump ⇒ which copy produced the artifact

An escaped `devin-page.txt` on disk **proves the decode never ran**, so it attributes that artifact to the no-decode (nanoclaw) copy — and is *not* evidence about the slang copy. mtime cannot do this (both share install mtime `2026-07-27 10:51`). Corroborated across edges: my 125 artifacts are **125/125 slang-produced, 0 escaped**; theirs are mixed, **25 of 44 escaped**.

**Severity downgrade:** all 25 of their escaped dumps **decode cleanly**, so those findings are **recoverable from saved artifacts, not lost**.

⚠️ **"Measure header coverage post-decode" is population-specific.** True and load-bearing on a mixed population; a **no-op on mine** — measured 46 pre-decode → 46 post-decode, delta 0. So the 46/128 interim figure is already post-decode-valid and does not need re-litigating.

## Interim posture, in force until fixed

A Devin zero is **presumed uninformative** unless its page dump carries an explicit `N Flags` or `No flags` header — only 46 of my 128 do. Reconcile against `devin-page.txt` (on disk, free) before letting any zero contribute a clean signal.

Related: [[feedback_a_size_or_presence_guard_cannot_validate_a_transformation]] (shared: `1786114676965-a-size-or-presence-guard-cannot-validate-a-transfo`), [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]

## ⛔⭐⭐⭐ 2026-08-10 — THE APPROVER'S DURABLE ASK IS CONFIRMED, AND IT IS MINE TO ROUTE (they hold only a per-container lease)

They reported: *"the slang runner's `devin-fetch.sh` is absent from all 402 refs of the nanoclaw repo, so no PR can ever protect it and every rebuild reverts it."* **Verified on my edge, and the precise form matters:**
```
git ls-files | grep -E 'devin-fetch\.sh$'   in pr1175       -> 0 tracked files
                                             in nanoclaw-kb -> 0 tracked files
  (a naive grep 'devin-fetch' returns 72 in nanoclaw-kb — those are MENTIONS INSIDE
   knowledge-base learnings/memos, not the script. A count is not a file.)

live copies, BOTH unversioned, and DIVERGENT:
  /home/node/.claude/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh  10540 B  Aug 10 09:26
  /home/node/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh     16196 B  Aug 10 09:26
```
⇒ ⭐⭐⭐ **TWO COPIES OF ONE SCRAPER, 5.6 KB APART, NEITHER IN VERSION CONTROL, BOTH STAMPED AT THE SAME REBUILD (09:26).** ⇒ **The rebuild that DELIVERED the #1145 fix to the versioned sibling is the same rebuild that DISCARDED their hand-patch on the unversioned one** — exactly their finding, and it explains why the fix and the regression arrived together.

⇒ ⭐⭐ **A HAND-PATCH TO AN UNVERSIONED FILE IS A LEASE, NOT A FIX — its expiry is the next rebuild, which nobody schedules or announces.** Their framing (*"I only hold a per-container lease"*) is exactly right, and it is why this escalates rather than being re-patched again: **re-patching is guaranteed to be reverted, and the revert is silent.**

⚠️ **Instrument note worth keeping: `grep -c <name>` over `ls-files` conflated 72 doc mentions with 0 tracked files** — the count was non-zero and the answer was zero. **Anchor the pattern to a path terminus (`/devin-fetch\.sh$`) when asking "does this FILE exist", never a substring.** Same shape as the `{{`-vs-unterminated-`{{` predicate error earlier today: **the naive pattern over-matched and the over-match pointed the wrong way.**

✅ **Their own near-miss is the reusable half and it is one my store already carries: the restored guard test first printed NOTHING and they almost logged it as a pass — it was `MODULE_NOT_FOUND`.** ⇒ **A test that prints nothing is not a test that passed.** Same "empty output ≠ clean" generator as the Devin false-clean, now one layer up inside their own verification harness. **Their control was the right one: replay the exact page that caused the original false-clean, with the reverted backup as a positive (`done=true`) and both live copies as negatives (`done=false`).**

⇒ ✅ **ROUTED TO OPERATOR as a two-option decision, not a bug report:** (a) vendor `devin-fetch.sh` into the repo so a PR can protect it, or (b) delete the slang copy and point the slang skill at the nanoclaw one. **Both end the recurrence; leaving two copies where only one is versioned guarantees it repeats.** No GitHub write at my tier.

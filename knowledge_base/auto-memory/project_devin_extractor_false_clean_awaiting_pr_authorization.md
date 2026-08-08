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

Related: [[feedback_a_size_or_presence_guard_cannot_validate_a_transformation]], [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]

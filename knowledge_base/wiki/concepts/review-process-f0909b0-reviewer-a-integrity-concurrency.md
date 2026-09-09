---
title: Reviewer-A wrapper integrity & concurrency — INTEGRITY-FAIL, shared tmp, and delivery
type: concept
group: review-process
tags: [reviewer-a, integrity-fail, shared-tmp, concurrent-review, stream-jsonl, wrapper-success, in-thread-reply, delivery, slang-pr-review]
source_count: 7
---

## TL;DR

The `slang-pr-review-runner` (Reviewer A) wrapper (`compose-and-run.sh`) has two
recurring integrity hazards, both driven by a **shared, non-namespaced checkout**:

- **`INTEGRITY-FAIL` is often a FALSE POSITIVE from a clobbered shared `tmp/`.**
  Concurrent reviews of different PRs all stage into
  `/workspace/agent/slang/tmp/{pr-diff.patch,pr-files.txt,context.json}`. A second
  run overwrites those mid-flight, so the post-run guard compares the review against
  the *other* PR's files and raises INTEGRITY-FAIL even though the review targeted
  the correct diff. Do NOT dismiss it on the model's self-report, and do NOT discard
  the review on the guard's headline — **adjudicate by CONTENT with an independent
  measurement**: sha256 the run dir's `pr-diff.reference` against a fresh `gh pr diff
  <N>`, check the `final-review.md` footer `reviewed: <head> · diff sha256`, and
  confirm `stream.jsonl` saturates with the target PR's fingerprints (the wrong-PR
  hits are the model's own clobber-detection reads, not leaked review).
- **The wrapper can report `success` with a dead review.** A 96-byte
  `clarity-review.md` containing only `API Error: 400 Invalid JSON payload …` passed
  the exit-status and existence checks — "no findings" is indistinguishable from
  "died". Gate at merge time on a size floor (≥2 KB, treat <500 B as failed
  regardless of exit), a content sniff (`grep -qE '^API Error|Invalid JSON payload'`),
  and recover from `stream.jsonl` Write/Edit payloads before writing the reviewer
  off — but report the run as `reviewers_complete:false`.

Liveness: **stream-static is NOT death.** Reviewer A dispatches subagents that run
silent for minutes; gate the terminal test on `final-review.md` (≥500 B) or the
`{"type":"result"}` record, not on `stream.jsonl` growth. Prevention: give each run
its own isolated staging (worktree / PR-scoped tmp), or clear the shared tmp before
launch.

Process discipline: **an `Edit` is not a delivered change until built + committed +
pushed** (`git ls-remote` confirms the SHA), and **reply IN-THREAD** to PR review
comments, not as a conversation-level comment.

## INTEGRITY-FAIL: the shared-tmp false positive and how to adjudicate

`compose-and-run.sh`'s post-run guard re-reads the SHARED `$REPO_ROOT/tmp/pr-diff.patch`
(where `REPO_ROOT=/workspace/agent/slang` for *all* slang and slang-rhi runs) and
compares its `+++ b/` file set to the live PR's files. A concurrent review clobbers
that file, so the guard reads the other PR's diff and mismatches. This is documented
across three atoms with the same adjudication procedure and slightly different framings:

- On PR#12508 the guard's `INTEGRITY-FAIL.txt` listed PR#12509's VM/bytecode files, but
  `pr-diff.reference` sha256 == the live 12508 diff, the footer head matched, and 227
  12508-hits vs 13 clobber-detection hits confirmed all four subagents ran on 12508 —
  "the review was VALID; the guard's INPUT was stale". Discriminate by content with an
  independent measurement, never the model's self-report [Reviewer-A INTEGRITY-FAIL can be a false positive from a clobbered SHARED tmp/pr-files.txt](../learnings/1786557797524-reviewer-a-integrity-fail-can-be-a-false-positive-.md).
- On #12506 the guard reported PR#12493's files while `tmp/` held 12508/12509/12514
  artifacts (several reviews sharing one checkout). The positive-binding proof:
  `sha256sum <run_dir>/pr-diff.reference` (the runner's OWN capture at dispatch) vs the
  `final-review.md` footer; `gh pr view <PR> --json files` vs the Changes Overview;
  target fingerprints saturating `stream.jsonl`; `summarize.py <run_dir>` confirming
  drift==0. Bonus: REVIEW.md Step 1 makes the inner model self-correct — two subagents
  refused with "Staged Diff Does not match", the model regenerated an ISOLATED
  `tmp/pr12506iso-diff.patch` and re-dispatched — "so a spurious INTEGRITY-FAIL often
  coincides with a *correct* review" [Reviewer-A INTEGRITY-FAIL can be a false positive from a CONCURRENT PR review on the shared checkout](../learnings/1786584985080-reviewer-a-integrity-fail-can-be-a-false-positive-.md).
- The cross-repo instance (slang-rhi#834 flagged as reviewing slang#12493 files) states
  the four-step adjudication as a checklist — `pr-diff.reference` binding, the
  `final-review.md` footer, a LIVE `gh pr diff <N>` in `stream.jsonl` tool_use, and
  content sanity — and the prevention idea: "give each concurrent A-run its own worktree
  like Reviewer C already does (`run-clarity.sh` isolates into `wt-clarity-<run_key>`),
  or key the tmp diff path on the run". If all four point at the right PR, keep
  `reviewers_complete:true` and note the false positive [slang-pr-review INTEGRITY-FAIL false-positive from shared tmp across concurrent cross-PR runs](../learnings/1786670426510-slang-pr-review-integrity-fail-false-positive-from.md).

The clean-prevention companion: before (re-)launching Reviewer A, `rm -f
/workspace/agent/slang/tmp/{pr-diff.patch,pr-files.txt,context.json}` so the inner CLI
regenerates them fresh — the INTEGRITY-FAIL guard catches the wrong-diff case after the
fact, but clearing prevents wasting a full run. Also: a transient `API Error: 400
Invalid JSON payload` can kill Reviewer A mid-run (twice on #12479), but it is transient
— "don't call it deterministic after 1-2 failures if a sibling reviewer on the same
model succeeded" [Shared slang checkout tmp/ is a cross-review race — a concurrent PR clobbers your staging](../learnings/1786670089193-shared-slang-checkout-tmp-is-a-cross-review-race-a.md).

## Wrapper success with a dead review, and the liveness test

A dead run is not necessarily a lost run. Reviewer C on slang#12454 exited `subtype:
"success"` and produced a 96-byte `clarity-review.md` whose entire content was
`API Error: 400 Invalid JSON payload: unexpected end of data …` — the inner CLI died at
final assembly, and "a merge step that trusts either the exit status or the file's
existence ships a reviewer whose voice is an error string; 'no findings' is
indistinguishable from 'died'". The gate, in order: (1) size floor (≥2 KB real,
<500 B = failed); (2) content sniff (`grep -qE '^API Error|Invalid JSON payload|^Error:'`);
(3) recover from `stream.jsonl` Write/Edit `tool_use` payloads (applying the LATER Edits
— line-number corrections); (4) report `reviewers_complete:false` even when the recovered
content is complete. Parsing gotcha: `message` is sometimes a string not an object and
`input` can be absent — guard with `isinstance(x, dict)` [a reviewer wrapper can report success with a 96-byte error-string artifact](../learnings/1786388990762-a-reviewer-wrapper-can-report-success-with-a-96-by.md).

The complementary false-positive is declaring Reviewer A *dead* too early. A background
monitor that fires when `stream.jsonl` stops growing is WRONG — Reviewer A dispatches
Task/Agent subagents that run for **minutes** without writing to the parent stream, so
"the parent stream legitimately goes static mid-run". On #12479 the monitor fired
"STALLED — stream static 3x" (~90s) while the wrapper was alive and completed cleanly 3
min later. The correct terminal test, in priority: (1) `final-review.md` ≥500 B → DONE;
(2) `INTEGRITY-FAIL.txt` exists → wrong diff (adjudicate per above); (3) the
`{"type":"result"}` record's `is_error`/`api_error_status` → authoritative terminal
state; (4) wrapper process gone via `/proc/<pid>/cmdline` (NOT `pgrep -f`, which matches
the monitor's own command line) AND none of 1-3 → genuine crash. Give a generous
5+ min static-timeout as a backstop only [Reviewer A stream going static is NOT death — subagents run silent for minutes](../learnings/1786670080197-reviewer-a-stream-going-static-is-not-death-subage.md).

## Process delivery: not real until pushed, and reply in-thread

Two maintainer-flagged process failures on slang#12519: **an `Edit` to a source file is
NOT a delivered change.** The author edited, posted "pushing shortly", then ended the
turn — the PR head stayed at the old commit for ~4 hours. "The change isn't real until:
format → rebuild → verify tests → commit (amend) → push → confirm remote head == local
HEAD"; run that chain in the same session, never let a turn end between "edited the
file" and "pushed", and say "pushed as <sha>" only after `git ls-remote` confirms it.
Second: **reply IN-THREAD to PR review comments** via `gh api -X POST
repos/<o>/<r>/pulls/<n>/comments/<review_comment_id>/replies`, not a top-level
`gh pr comment` — the latter "makes 'addressed' and 'acknowledged' look identical and
leaves review threads empty/unresolvable in the Files Changed view". Note the critique
gate re-fires on ANY GitHub write once N edits have happened since the last OUTPUT_REVIEW
— budget a fresh review round before the push+reply [a code Edit is not delivered until built+committed+pushed; and reply IN-THREAD on PR review comments](../learnings/1786616755173-a-code-edit-is-not-delivered-until-built-committed.md).

**Source learnings (7):**

- [a reviewer wrapper can report success with a 96-byte error-string artifact](../learnings/1786388990762-a-reviewer-wrapper-can-report-success-with-a-96-by.md) — gate at merge on size floor + content sniff; recover from `stream.jsonl` Write/Edit payloads (apply later Edits); report `reviewers_complete:false`; guard `isinstance(x, dict)`.
- [Reviewer-A INTEGRITY-FAIL can be a false positive from a clobbered SHARED tmp/pr-files.txt](../learnings/1786557797524-reviewer-a-integrity-fail-can-be-a-false-positive-.md) — adjudicate by content (sha256 `pr-diff.reference` vs live diff, footer head, per-PR symbol hits), not the model's self-report or the guard headline.
- [Reviewer-A INTEGRITY-FAIL can be a false positive from a CONCURRENT PR review on the shared checkout](../learnings/1786584985080-reviewer-a-integrity-fail-can-be-a-false-positive-.md) — positive-binding proof procedure; REVIEW.md Step 1 self-corrects into an isolated diff, so a spurious INTEGRITY-FAIL often coincides with a correct review.
- [a code Edit is not delivered until built+committed+pushed; and reply IN-THREAD on PR review comments](../learnings/1786616755173-a-code-edit-is-not-delivered-until-built-committed.md) — confirm remote head via `git ls-remote` before saying "pushed"; use the review-comment `/replies` endpoint; the critique gate re-fires on any GitHub write after N edits.
- [Reviewer A stream going static is NOT death — subagents run silent for minutes](../learnings/1786670080197-reviewer-a-stream-going-static-is-not-death-subage.md) — terminal test priority: `final-review.md` ≥500 B, INTEGRITY-FAIL.txt, the `{"type":"result"}` record, then `/proc/<pid>/cmdline` (not `pgrep -f`); 5+ min static-timeout backstop only.
- [Shared slang checkout tmp/ is a cross-review race — a concurrent PR clobbers your staging](../learnings/1786670089193-shared-slang-checkout-tmp-is-a-cross-review-race-a.md) — clear the shared `tmp/{pr-diff.patch,pr-files.txt,context.json}` before launch; a transient 400 JSON-payload error is not deterministic if a sibling reviewer succeeded on the same model.
- [slang-pr-review INTEGRITY-FAIL false-positive from shared tmp across concurrent cross-PR runs](../learnings/1786670426510-slang-pr-review-integrity-fail-false-positive-from.md) — four-step adjudication checklist; give each A-run its own worktree like Reviewer C's `wt-clarity-<run_key>`, or key the tmp path on the run.

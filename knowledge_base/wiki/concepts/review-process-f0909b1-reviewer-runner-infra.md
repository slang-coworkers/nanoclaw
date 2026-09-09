---
title: Reviewer-runner infrastructure — API-400 payloads, integrity-fail, static-only runs, monitors, patch contamination
type: concept
group: review-process
tags: [reviewer-a, reviewer-c, clarity, slang-pr-review-runner, api-400, integrity-fail, monitor, patch-mode, shared-checkout, artifacts]
source_count: 11
---

## TL;DR

The `/slang-pr-review` workflow runs three reviewers — A (correctness, `slang-pr-review-runner` /
`compose-and-run.sh`), B (Devin, `devin-fetch.sh`), C (clarity, `slang-clarity-review-runner` /
`run-clarity.sh`). Their runners have infrastructure failure modes that read identically to success
unless you check the right artifact. Silence, a clean-looking file, and a green terminal reason are
all untrustworthy on their own.

- **Transient API-400 payload truncation kills Reviewer A/C** at turn 1 with `400 Invalid JSON
  payload: unexpected end of data: line 1 column ~199K–390K`. The char position is near-constant
  across PRs, so it's the fixed initial request body (CLAUDE.md + system-prompt + REVIEW.md
  scaffold, or the accumulated multi-skill clarity payload) truncated at a provider/gateway
  boundary — NOT your diff. It REPRODUCES on instant retries; only SPACED retries (~180s) recover.
- **A "completed" terminal reason does NOT guarantee a valid artifact.** Grep the artifact for the
  crash signature (`API Error|Invalid JSON|unexpected end of data`); a 96-byte `clarity-review.md`
  is the fake-clean size; a short verification-prose artifact ran but produced no findings.
- **Reviewer A can silently do a STATIC-only review** — a clean `final-review.md` with drift==0 does
  not imply it built anything; grep `tool-uses.jsonl` for `cmake|ninja|slang-test` and build it
  yourself if the request hinges on a local build.
- **INTEGRITY-FAIL is frequently a false alarm** from the shared `/workspace/agent/slang` checkout's
  `tmp/pr-diff.patch` being clobbered by a concurrent run; triangulate the diff sha256 across four
  independent sources before believing a wrong-diff review.
- **Patch-mode `git commit -am` sweeps in a dirty checkout's unrelated files** — verify the temp
  commit's FILE SET, not just its `diff sha256`.
- **Monitors must key on the runner's own terminal sentinels / artifacts, never generic failure
  words** — the streamed PR body legitimately contains "error"/"failed".
- **Runners self-assign a transcripts dir; there is no `--out` flag** except on `devin-fetch.sh`.

## The API-400 payload truncation (Reviewer A and C)

The signature: `terminal_reason: api_error`, `api_error_status: 400`, `result: "API Error: 400
Invalid JSON payload: unexpected end of data: line 1 column ~199,42X"`, num_turns:1, ~$0 cost,
~3s wall, no `final-review.md`. On PR #12650 Reviewer A died THREE times identically right after
reading the large PR body; B and C (smaller contexts) completed first try — so the discriminator is
REQUEST SIZE, not the PR
([Reviewer A can die on transient API-400 payload truncation](../learnings/1787266138406-reviewer-a-slang-pr-review-runner-can-die-on-trans.md)).
The key operational fact: the char position is near-CONSTANT (~199,415–199,422) across independent
dispatches and different PRs, so the truncation is in the ~195KB fixed initial request body at a
Bedrock/gateway boundary — and it REPRODUCES on immediate back-to-back retries. Do not conclude
"deterministic failure" from 2 fast retries and do not burn budget on instant re-dispatch; run a
SPACED-retry driver (~180s apart, success observed on attempt ~3 of a 6-attempt loop) and proceed
with B+C in parallel
([Reviewer A transient 400 payload-truncation reproduces on back-to-back retries](../learnings/1787341192642-reviewer-a-transient-400-payload-truncation-reprod.md)).

Reviewer C hits the SAME class but for a different reason: on PR #12670 and #12697 (both tiny diffs)
clarity failed twice at `column ~235K–390K`, and #12697's 81-line diff proves it's NOT diff-size —
it's payload ACCUMULATION, the multi-skill clarity pipeline (clarity → fine-grained → consolidate →
scope-filter → resolve-judgment-calls, each re-reading `tmp/` state) bloating the request regardless
of diff size. Two reproducible crashes at the same signature ⇒ a third retry is wasteful; skip C
gracefully (it's advisory/lower-bar/non-gating — Reviewer A correctness is the gating reviewer), and
check whether A's editorial filter already folded the top clarity concern into its KEPT findings
([Clarity reviewer API-400 is payload-accumulation, not diff-size, dependent](../learnings/1787371827876-clarity-reviewer-api-400-is-payload-accumulation-n.md)).
Crucially, a `completed` terminal reason does NOT guarantee a valid clarity artifact: always grep for
`API Error|Invalid JSON|unexpected end of data` first. Distinguish (a) an error-string artifact =
failed; (b) a short verification-prose artifact (743 bytes, "Now let me write the candidate files")
= ran but produced no formal candidates; the runner's own guard (`!!! CLARITY-INCOMPLETE:
clarity-review.md is 96B (floor 500B)`) fires correctly — 96 bytes is exactly the fake-clean size,
never a clean 0-findings result
([Clarity reviewer C can hit reproducible API-400 payload-overflow; 3rd retry may under-produce](../learnings/1787322332417-clarity-reviewer-c-can-hit-reproducible-api-400-pa.md)).

## Absence-of-build and integrity-fail read like success

Reviewer A can produce a clean `final-review.md` with drift==0 having done a purely STATIC review. On
PR #12681 (where the fixer said the local build was the most useful signal) a grep of A's
`tool-uses.jsonl` for `cmake|ninja|slang-test` returned ZERO — absence of a build reads identically to
a passed build unless you check. When the request hinges on a local build, run
`grep -oE '"command": "[^"]*(cmake|slang-test|ninja)[^"]*"' <run_dir_A>/tool-uses.jsonl`; if empty,
build it yourself. (Second gotcha: a passing spirv-asm FileCheck test with
`SLANG_RUN_SPIRV_VALIDATION=0` confirms emit-SHAPE only, not Vulkan validity — say so explicitly)
([Reviewer A can silently do a static-only review — verify the build actually ran](../learnings/1787323074074-reviewer-a-can-silently-do-a-static-only-review-ve.md)).

The diff-integrity NET in `compose-and-run.sh` (~lines 185-195) compares `tmp/pr-diff.patch`'s
`+++ b/` paths to `gh pr view --json files` at A's exit and writes `INTEGRITY-FAIL.txt` on mismatch —
but `/workspace/agent/slang` is a SHARED mutable checkout, so concurrent reviews clobber that file and
the net can list files belonging to neither the PR under review nor even its racer. Do NOT re-run on
the log line alone, and do NOT trust the model's self-report alone: triangulate the diff sha256 across
FOUR sources that agree only if A reviewed the right diff — live `gh pr diff`, A's run-START
`pr-diff.reference`, the `diff sha256` footer in `final-review.md`, and the diff-hash in Reviewer C's
independently-named run dir — then positive-control one finding's file:line against the live diff. On
PR 12647 all four agreed on `7bd29ae…` despite an INTEGRITY-FAIL listing a third PR's files — a valid
review
([Reviewer A INTEGRITY-FAIL can be a teardown-time false alarm under concurrent runs](../learnings/1787266145358-reviewer-a-integrity-fail-can-be-a-teardown-time-f.md)).

The related PATCH-MODE contamination is the same shared-checkout hazard but with a wrong-binding that
IS real damage: patch mode does `git -c ... commit -q -am` on a temp branch, and `commit -am` stages
ALL modified tracked files — so pre-existing uncommitted edits in the shared checkout get swept into
the temp commit alongside the patch, and Reviewer A reviews `your_patch + unrelated_dirty_files`. On
PR #12771 A's review came back about `EnumCase`/`slang-parser.cpp`/`core.meta.slang` — none in the
36-line CI-YAML patch. The `diff sha256` footer is NOT enough (it hashes the contaminated diff and
looks self-consistent); verify the temp commit's FILE SET (`git show --stat <temp-sha>` == the patch's
`diff --git` set). Reviewer C is immune (it builds an isolated worktree); when A and C disagree wildly
on WHAT the diff even is, suspect A-side contamination. Ensure the shared checkout is clean before
dispatch (`git -C <repo> status --porcelain` empty — and run it with `-C`, or from `/workspace/agent`
a naive `| wc -l` reads 0 = false all-clear)
([Patch-mode review diff contaminated by dirty shared checkout (git commit -am)](../learnings/1787746426193-patch-mode-review-diff-contaminated-by-dirty-share.md)).

## Monitors, re-sends, and the transcripts-dir flag

A Monitor watching a reviewer run must NOT grep the stream for generic failure words. The inner
`claude --print` streams the PR body and diff into the log as `tool_result` content, and a layout/docs
PR body legitimately contains "error"/"failed"/"no such file" — a `grep -qiE 'error|failed'` fires on
that echoed content, emitting a FALSE `REVIEWER_*_ERROR` and latching `done=1` so the real completion
never reports. Match only content-immune sentinels: `compose-and-run.sh` prefixes guard failures with
literal `!!!` (`!!! INTEGRITY-FAIL`, `!!! REVIEW-GUARD FAIL`); `run-clarity.sh` emits
`!!! CLARITY-INCOMPLETE`; success = the artifact present and non-empty (`final-review.md` /
`clarity-review.md` / `devin-flags.md`); B writes `devin-error.txt` on skip
([monitor grep for reviewer failure must not match streamed PR-body content](../learnings/1787605976090-monitor-grep-for-reviewer-failure-must-not-match-s.md)).
The generalization: generic failure tokens (`Error:`, `exit code [1-9]`, `fatal`, `Traceback`) appear
as ordinary CONTENT inside `tool_result` payloads during the normal mkdir/redirect retry dance —
watch the OUTPUT ARTIFACT (present + non-empty + stream stopped growing), and for a genuine CLI failure
grep the terminal result line anchored at line start (`grep -qE '^\{"type":"result"'`); a monitor's
completion event is a trigger to re-verify on disk, not a fact
([monitor for a claude-CLI reviewer run must not grep the stream for generic failure words](../learnings/1787869224351-monitor-for-a-claude-cli-reviewer-run-must-not-gre.md)).

When a fixer/parent reports "message not answered, please re-send" days after a review, do NOT re-run
the reviewers or reconstruct from memory. Check the artifact on disk first (the run dir's
`combined-review.md` is GC-reaped after a few days); check PR state + head-delta (`gh pr view --json
state,isDraft,headRefOid,mergedAt` — merged ⇒ moot; head unchanged ⇒ old verdict holds verbatim);
the reviewer STREAM LOGS survive when the run dir is reaped — reconstruct faithfully (A's
`final-review.md` = the LAST assistant text block in the stream JSONL, verified by the `reviewed:
<sha>` footer; C's = the `Write` tool_use payload for `clarity-review.md`), rebuild combined-review.md,
re-send with `in_reply_to=<the failure-notice id>`, and ask for receipt confirmation
([Review re-send after GC: check merge state + head-delta, reconstruct from stream logs](../learnings/1787558224979-review-re-send-after-gc-check-merge-state-head-del.md)).

A small interface fact that cost a re-dispatch cycle: `compose-and-run.sh` (A) and `run-clarity.sh`
(C) do NOT accept an `--out`/`--run-dir` flag — passing `--out <dir>` fails with `unknown flag --out`
and the reviewer never starts (silent if backgrounded). Both self-assign a run dir under
`<skill-dir>/transcripts/<mode>-<timestamp>` and print it as `>>> output → <path>`; grep the launch log
for `output →`. Only `devin-fetch.sh` (Reviewer B) takes `--out`
([slang-pr-review runners manage their own transcripts dir — no --out flag](../learnings/1787049654930-slang-pr-review-runners-manage-their-own-transcrip.md)).

**Source learnings (11):**

- [slang-pr-review runners manage their own transcripts dir — no --out flag](../learnings/1787049654930-slang-pr-review-runners-manage-their-own-transcrip.md) — A/C self-assign `transcripts/<mode>-<ts>`; grep the launch log for `output →`; only devin-fetch.sh takes `--out`.
- [Reviewer A (slang-pr-review-runner) can die on transient API-400 payload truncation](../learnings/1787266138406-reviewer-a-slang-pr-review-runner-can-die-on-trans.md) — PR #12650; 3 identical deaths after reading the large PR body; discriminator is request size; report A-absent and merge on B+C + own checks.
- [Reviewer A INTEGRITY-FAIL can be a teardown-time false alarm under concurrent runs](../learnings/1787266145358-reviewer-a-integrity-fail-can-be-a-teardown-time-f.md) — PR 12647; shared `tmp/pr-diff.patch` clobber; triangulate the diff sha256 across four sources + positive-control a finding; fix is per-run worktree/TMPDIR.
- [Clarity reviewer (C) can hit reproducible API-400 payload-overflow; 3rd retry may under-produce](../learnings/1787322332417-clarity-reviewer-c-can-hit-reproducible-api-400-pa.md) — PR #12670; a `completed` terminal reason ≠ valid artifact; 96B = fake-clean; distinguish error-string vs verification-prose artifacts.
- [Reviewer A can silently do a static-only review — verify the build actually ran](../learnings/1787323074074-reviewer-a-can-silently-do-a-static-only-review-ve.md) — PR #12681; grep `tool-uses.jsonl` for cmake/ninja/slang-test; SLANG_RUN_SPIRV_VALIDATION=0 confirms shape, not Vulkan validity.
- [Reviewer A transient 400 payload-truncation reproduces on back-to-back retries](../learnings/1787341192642-reviewer-a-transient-400-payload-truncation-reprod.md) — the char position is near-constant across PRs (fixed request body); use a spaced ~180s retry driver, not instant re-dispatch.
- [Clarity reviewer API-400 is payload-accumulation, not diff-size, dependent](../learnings/1787371827876-clarity-reviewer-api-400-is-payload-accumulation-n.md) — PR #12697 (81-line diff) crashed at ~360–390K; the multi-pass clarity chain re-reads tmp/ state; skip C after 2 crashes; check if A folded the concern.
- [Review re-send after GC: check merge state + head-delta, reconstruct from stream logs](../learnings/1787558224979-review-re-send-after-gc-check-merge-state-head-del.md) — slang#12626; artifact-first, then PR state, then stream logs (A = last assistant text block; C = Write payload); re-send on the right edge with receipt.
- [Monitor grep for reviewer failure must not match streamed PR-body content](../learnings/1787605976090-monitor-grep-for-reviewer-failure-must-not-match-s.md) — match content-immune sentinels (`!!!`, artifact presence, `devin-error.txt`), never the word "error" in the stream.
- [Monitor for a claude-CLI reviewer run must not grep the stream for generic failure words](../learnings/1787869224351-monitor-for-a-claude-cli-reviewer-run-must-not-gre.md) — PR #12806; generic tokens appear in tool_result content; watch the artifact + the line-start `^{"type":"result"`; a monitor event is a trigger to re-verify.
- [Patch-mode review diff contaminated by dirty shared checkout (git commit -am)](../learnings/1787746426193-patch-mode-review-diff-contaminated-by-dirty-share.md) — PR #12771; verify the temp commit's FILE SET, not just the diff sha256; ensure the checkout is clean before dispatch (`git -C` matters); Reviewer C's isolated worktree is immune.

---
title: Reviewer-A wrapper integrity & concurrency — INTEGRITY-FAIL, shared tmp, and delivery
type: concept
group: review-process
tags: [reviewer-a, integrity-fail, shared-tmp, concurrent-review, stream-jsonl, wrapper-success, in-thread-reply, delivery, slang-pr-review]
source_count: 17
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
that file, so the guard reads the other PR's diff and mismatches. The adjudication
procedure is identical across every observed instance: discriminate by CONTENT with an
independent measurement, never the model's self-report or the guard headline. Confirm
`sha256sum <run_dir>/pr-diff.reference` (the runner's OWN immutable capture at dispatch —
not the shared `tmp/`) against a fresh `gh pr diff <N>`; check the `final-review.md`
footer `reviewed:<head> · diff sha256`; confirm the target PR's fingerprints saturate
`stream.jsonl` tool_use (the wrong-PR hits are the model's own clobber-detection reads);
and `summarize.py <run_dir>` drift==0. If all agree, the review was VALID and the guard's
INPUT was stale — keep `reviewers_complete:true` (or `reviewers_complete:false` with the
findings flagged valid when A exited nonzero) and note the false positive. Observed on
PR#12508 (guard listed PR#12509's VM files; 227 target-hits vs 13 clobber-detection hits)
and across concurrent slang/slang-rhi cross-PR runs stating the same four-step checklist
[Reviewer-A INTEGRITY-FAIL is a false positive from a clobbered shared tmp — adjudicate by content](../learnings/1786557797524-reviewer-a-integrity-fail-can-be-a-false-positive-.md).
**The contamination need not be concurrent — a STALE cross-repo `tmp/pr-diff.patch` left
by a PRIOR run trips it too:** on slang#13239 round-2 a leftover slang-rhi
`tmp/pr-diff.patch` sat in the slang checkout, so the guard compared its `+++ b/` paths
against #13239 and false-tripped while `pr-diff.reference` sha256 == the live diff
(eb63ee7b0adf); `grep '^+++ b/' /workspace/agent/slang/tmp/pr-diff.patch` showing a
different repo/PR's files is the tell [INTEGRITY-FAIL can be a false positive from a stale cross-repo tmp/pr-diff.patch](../learnings/1790220188333-slang-pr-review-integrity-fail-can-be-a-false-posi.md).
REVIEW.md Step 1 also self-corrects — subagents that read the clobbered diff refuse
("Staged Diff Does not match"), the model regenerates an isolated `tmp/iso-<pr>/pr-diff.patch`
and re-dispatches — so a spurious INTEGRITY-FAIL routinely coincides with a *correct*
review; the durable prevention is a per-run isolated worktree (below).

The clean-prevention companion: before (re-)launching Reviewer A, `rm -f
/workspace/agent/slang/tmp/{pr-diff.patch,pr-files.txt,context.json}` so the inner CLI
regenerates them fresh — the INTEGRITY-FAIL guard catches the wrong-diff case after the
fact, but clearing prevents wasting a full run. Also: a transient `API Error: 400
Invalid JSON payload` can kill Reviewer A mid-run (twice on #12479), but it is transient
— "don't call it deterministic after 1-2 failures if a sibling reviewer on the same
model succeeded" [Shared slang checkout tmp/ is a cross-review race — a concurrent PR clobbers your staging](../learnings/1786670089193-shared-slang-checkout-tmp-is-a-cross-review-race-a.md).

**Confirmed prevention + a head-advance caveat.** A re-review run with
`REPO_ROOT=/workspace/agent/wt-867-revA-r2` (a dedicated `git worktree add --detach <slang-checkout>
origin/master`, which carries `REVIEW.md` + `.claude/agents` since they are tracked at origin/master)
produced NO INTEGRITY-FAIL even with other reviews running concurrently — the isolated worktree gives
compose-and-run its own `tmp/context.json` + `tmp/pr-diff.patch` that no sibling run can clobber.
Reviewer C's `run-clarity.sh` already self-isolates via its own `wt-*` worktree, so only Reviewer A
needs the explicit `REPO_ROOT` override; do it whenever a re-review might overlap another. Second,
the PR head can advance mid-review: a fixer pushed a new commit during a ~20-min pass, so the
reviewers reviewed the dispatched head while the current head moved on. After the reviewers finish,
re-read `gh pr view <pr> --json headRefOid` and compare it to `final-review.md`'s footer
`reviewed: <sha>`; if they differ, `git diff <reviewed>..<current>` and judge the delta — a
comments/rename-only delta means the review still covers the new head (disclose it), a logic delta
needs a re-run. Note `gh pr diff`'s sha is unstable when the base `main` moves (the merge-base shifts,
so the diff text changes for the same head), so confirm the right PR was reviewed with the integrity
FILE-list check, not the sha ([isolated REPO_ROOT worktree prevents the shared-tmp race; verify reviewed-commit vs current head](../learnings/1789479957663-isolated-repo-root-worktree-prevents-the-pr-review.md)).

**The exit=1 guards are a FAMILY of heuristics that over-fire on a valid review — read `final-review.md` before believing any of them.** Two more mechanisms confirm why INTEGRITY-FAIL stays a false positive even without an isolated worktree: (1) the inner CLI **self-heals** — when subagents read the clobbered shared `pr-diff.patch` and bail ("pre-staged diff does not match the requested PR"), the orchestrator isolates the correct diff into `tmp/iso-<pr>-review/pr-diff.patch` and re-runs the affected subagents, so the final review IS grounded in the right diff while the post-run net still re-reads the stale shared file [slang-pr-review-runner INTEGRITY-FAIL self-heals via tmp/iso-<pr>/ while the post-run net still trips](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md); (2) the model's sandbox **denies `> tmp/pr-diff.patch` redirects**, so the reviewer subagents fall back to a live bare `gh pr diff <N>` for the actual review content — another reason the review stays correct even when the shared tmp file is wrong [the sandbox denies tmp/pr-diff.patch redirects so subagents review via live gh pr diff](../learnings/1789441851541-slang-pr-review-runner-integrity-fail-can-be-a-fal.md). When it fires, do **ALL** of: footer `reviewed:<sha>` == live `headRefOid`; footer `diff sha256` == `sha256sum <run_dir>/pr-diff.reference`; findings cite the requested PR's files; `summarize.py` drift==0 — then keep `reviewers_complete:true` and document the rc=1 override with that evidence (**Reviewer B is also immune** — it scrapes Devin; only Reviewer A is exposed) [concurrent runner sessions collide on shared tmp → do all four checks before overriding rc=1](../learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md). The **sibling `REVIEW-GUARD FAIL`** heuristic ("final review looks like an infrastructure error, not a review") false-trips the same way: a complete 137-line review tripped it because its own coverage note read "the cross-backend and clarity passes terminated on transient API errors" — the guard pattern-matched the infra wording. Read the file: a full Verdict + Findings table = false trip (use it); a <500 B stub with no verdict = real failure [REVIEW-GUARD FAIL false-trips on infra-error wording inside a valid review](../learnings/1789512038521-slang-pr-review-runner-review-guard-fail-can-false.md). Confirmed again on #13227 round 2: `tmp/pr-diff.patch` held a diagnostics/constraint PR's files while the review correctly covered the CallShader/CUDA diff (run-dir `pr-diff.reference` sha256 == the live diff, footer hash `3714c8a3e0e3` matched, every finding on-topic) — honest reporting is `reviewers_complete:false` (A had a nonzero exit) **with the findings reported as valid** plus a one-line run-note on the race, not a discard ([INTEGRITY-FAIL exit 1 can be a shared-checkout tmp race, not a wrong-diff review](../learnings/1790108064998-slang-pr-review-runner-integrity-guard-exit-1-can-.md)).

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

**Output-extraction can silently grab the WRONG message → the real review is missing but rc=0.** Both runners extract their result as the *last assistant TEXT message*, which is fragile: the clarity runner has captured a trailing meta-conclusion ("the complete workflow.md is in my prior message… nothing further to do") as a 10-line `clarity-review.md` while the real 44 KB review sat earlier in the turn, and it has captured a mid-workflow line ("Now let me consolidate…") when the final step **Wrote** the canonical candidate file to `tmp/review-candidates/pr-<N>-clarity-workflow.md` via the Write tool instead of pasting it — both stubs clear the ~135–500 B incomplete-guard, so the run exits rc=0/`completed` with no `CLARITY-INCOMPLETE` marker and *looks* fine. Tell: `grep -c '### ' clarity-review.md`==0 (or no `## Kept`/`## Review Body`) with rc=0. Don't re-run (~$3–4 + ~20 min, and the `wt-clarity-*` worktree holding the tmp/ file is GC'd fast); recover the real body from the run dir's `stream.jsonl` — the largest assistant text turn containing `## Review Body`/`## Kept`, or the **content of the Write `tool_use`** [clarity runner captures a trailing meta-message; recover the body from stream.jsonl](../learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md) [clarity runner Writes the review to a GC'd tmp/ file; recover it from the Write tool_use in stream.jsonl](../learnings/1789573892015-clarity-runner-reviewer-c-can-lose-its-output-to-a.md). And to recover from the right run at all: identify YOUR run dir from the background log's `>>> output → <RUN_DIR>` line, **not** `ls -dt transcripts/pr-*` — a concurrently-finishing run bumps its dir mtime above your just-created one (Reviewer A's dir name is a bare `pr-<ts>` with no head SHA, so it is the ambiguous one; the clarity dir name embeds the head SHA and self-disambiguates) [identify a run dir from the bg log's "output →" line, not ls -dt](../learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md).

**A truncated Reviewer A reports a false `0/0/0` CLEAN, not just a wrong-body stub.** When the inner `claude --print` orchestrator dispatches its six subagents **asynchronously** and the print session ends mid-synthesis, its final text is an intermediate line (e.g. *"…holding for cross-backend before I finalize the table"*) with **no findings table**, so `summarize.py` reports `0 bugs / 0 gaps / 0 questions` and `Run state: success` — do NOT trust that as a clean review. Before believing the counts, parse `stream.jsonl` for the terminal `result` event and check its text for a "holding / before I finalize the table" pattern (or a suspiciously short ~1–2 KB `final-review.md` that reads like reasoning rather than a `**Verdict**:` + Findings table). The async subagent transcripts are symlinks cleared on session/container churn, so recovery usually fails — just re-run (≈$17–21, so check for truncation before spending it). A milder degradation: 3 of the 6 subagents (code-quality, cross-backend, doc-accuracy) can *refuse* when the harness-staged `tmp/pr-diff.patch` is sandbox-blocked; the orchestrator still finalizes but covers those dimensions with its own source-verified analysis — usable, but note the reduced independence in the verdict ([Reviewer A can truncate to a false 0/0/0 clean — verify the terminal result event finalized](../learnings/1790123188250-slang-pr-review-reviewer-a-can-truncate-to-a-false.md)).

## Patch-mode `git commit -am` drops NEW files → false "no test in patch" gap

A second harness artifact that makes Reviewer A raise a false finding — this time a false
**test-coverage gap**, not INTEGRITY-FAIL. In `compose-and-run.sh`'s *patch mode*, the sequence
`git checkout -b patch-review-<ts> origin/master` → `git apply --whitespace=nowarn "$PATCH_FILE"` →
`git -c ... commit -q -am "patch under review (temporary)"` drops every NEW file: `git apply`
creates new files as **untracked**, and `git commit -am` stages only **modified/deleted tracked**
files, so the reviewed target (`git diff`/`git show` of the temp branch) omits every `new file`
hunk. Reviewer A then sees only the modified `.cpp` and correctly-but-misleadingly reports 🟡 "patch
carries no regression test; tests exist in the tree but are untracked (`??`)" — even when the patch
file plainly contains the test files as `new file` diff hunks. **Tell:** the finding says the tests
show as `??` in `git status` — the fingerprint of this artifact. **Cross-check that disambiguates:**
Reviewer C (`slang-clarity-review-runner`) uses a worktree and commits the patch so new files ARE
included, so C reviews all the test files fine — when A says "no test" but C reviews the tests, it's
the `-am` artifact, not a missing test. **Reviewer action:** discount the "missing test" gap; verify
the tests exist in the patch file / on the fixer's branch instead. Until the runner is fixed to
`git add -A` before commit, A's test-coverage findings in patch mode are blind to any newly-added
file ([Patch-mode PR review: git commit -am drops NEW test files → false "no test in patch" gap](../learnings/1789333359114-patch-mode-pr-review-git-commit-am-drops-new-test-.md)).

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

**Source learnings (17):**

- [a reviewer wrapper can report success with a 96-byte error-string artifact](../learnings/1786388990762-a-reviewer-wrapper-can-report-success-with-a-96-by.md) — gate at merge on size floor + content sniff; recover from `stream.jsonl` Write/Edit payloads (apply later Edits); report `reviewers_complete:false`; guard `isinstance(x, dict)`.
- [Reviewer-A INTEGRITY-FAIL can be a false positive from a clobbered SHARED tmp/pr-files.txt](../learnings/1786557797524-reviewer-a-integrity-fail-can-be-a-false-positive-.md) — adjudicate by content (sha256 `pr-diff.reference` vs live diff, footer head, per-PR symbol hits), not the model's self-report or the guard headline.
- [INTEGRITY-FAIL false positive from a STALE cross-repo `tmp/pr-diff.patch` (not just concurrent); `pr-diff.reference` sha256 == live diff proves the review is valid; `grep '^+++ b/' tmp/pr-diff.patch` reveals the wrong-repo contamination.](../learnings/1790220188333-slang-pr-review-integrity-fail-can-be-a-false-posi.md)
- [a code Edit is not delivered until built+committed+pushed; and reply IN-THREAD on PR review comments](../learnings/1786616755173-a-code-edit-is-not-delivered-until-built-committed.md) — confirm remote head via `git ls-remote` before saying "pushed"; use the review-comment `/replies` endpoint; the critique gate re-fires on any GitHub write after N edits.
- [Reviewer A stream going static is NOT death — subagents run silent for minutes](../learnings/1786670080197-reviewer-a-stream-going-static-is-not-death-subage.md) — terminal test priority: `final-review.md` ≥500 B, INTEGRITY-FAIL.txt, the `{"type":"result"}` record, then `/proc/<pid>/cmdline` (not `pgrep -f`); 5+ min static-timeout backstop only.
- [Shared slang checkout tmp/ is a cross-review race — a concurrent PR clobbers your staging](../learnings/1786670089193-shared-slang-checkout-tmp-is-a-cross-review-race-a.md) — clear the shared `tmp/{pr-diff.patch,pr-files.txt,context.json}` before launch; a transient 400 JSON-payload error is not deterministic if a sibling reviewer succeeded on the same model.
- [patch-mode `git apply` + `git commit -am` drops untracked NEW files from the reviewed diff → false Reviewer-A "no test" gap (tell: tests show `??`); Reviewer C's worktree sees them, so discount the gap; runner should `git add -A` before commit.](../learnings/1789333359114-patch-mode-pr-review-git-commit-am-drops-new-test-.md)
- [isolated REPO_ROOT worktree prevents the PR-review shared-tmp race; verify reviewed-commit vs current head](../learnings/1789479957663-isolated-repo-root-worktree-prevents-the-pr-review.md) — a `wt-<pr>-revA` worktree of origin/master (with REVIEW.md + `.claude/agents`) gives Reviewer A its own `tmp/`; also re-read `headRefOid` after the pass and judge any mid-review delta.
- [slang-pr-review-runner INTEGRITY-FAIL self-heals via tmp/iso-<pr>/ while the post-run net still trips](../learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md) — the CLI isolates the correct diff into `tmp/iso-<pr>-review/` and re-runs the affected subagents, so the review is grounded correctly even though the post-run guard re-reads the still-clobbered shared file.
- [the sandbox denies tmp/pr-diff.patch redirects so subagents review via live gh pr diff](../learnings/1789441851541-slang-pr-review-runner-integrity-fail-can-be-a-fal.md) — reviewer subagents can't `> tmp/pr-diff.patch`, so they fall back to a live bare `gh pr diff <N>`; another reason review content stays correct under a clobbered shared tmp.
- [concurrent runner sessions collide on shared tmp → do all four checks before overriding rc=1](../learnings/1789518412257-concurrent-slang-pr-review-runner-sessions-collide.md) — footer sha vs headRefOid, footer diff sha256 vs `pr-diff.reference`, findings cite the requested PR, `summarize.py` drift==0; Reviewer B and C are immune, only A is exposed.
- [REVIEW-GUARD FAIL false-trips on infra-error wording inside a valid review](../learnings/1789512038521-slang-pr-review-runner-review-guard-fail-can-false.md) — the "looks like an infrastructure error" guard pattern-matches a review's own coverage note; read `final-review.md` (full Verdict + Findings = false trip; <500 B stub = real failure).
- [clarity runner captures a trailing meta-message; recover the body from stream.jsonl](../learnings/1789517911038-slang-clarity-review-runner-can-capture-a-trailing.md) — output-extraction grabs the last assistant TEXT turn; a trailing meta-conclusion becomes a 10-line stub at rc=0. Tell: `grep -c '### '`==0. Recover the largest `## Review Body`/`## Kept` text.
- [clarity runner Writes the review to a GC'd tmp/ file; recover it from the Write tool_use in stream.jsonl](../learnings/1789573892015-clarity-runner-reviewer-c-can-lose-its-output-to-a.md) — when the final step Writes the candidate file instead of pasting it, `clarity-review.md` is a ~1 KB stub; recover from the Write `tool_use` content, don't re-run.
- [identify a run dir from the bg log's "output →" line, not ls -dt](../learnings/1789507730747-slang-pr-review-runner-identify-a-run-dir-from-the.md) — a concurrently-finishing run bumps its mtime above yours; Reviewer A's bare `pr-<ts>` dir is the ambiguous one, so grep the bg job's `>>> output → <RUN_DIR>` line.
- [INTEGRITY-FAIL exit 1 can be a shared-checkout tmp race, not a wrong-diff review (#13227 r2)](../learnings/1790108064998-slang-pr-review-runner-integrity-guard-exit-1-can-.md) — adjudicate by `pr-diff.reference` sha256 vs live diff + footer hash + on-topic findings; report `reviewers_complete:false` with the findings valid, not a discard.
- [Reviewer A can truncate to a false 0/0/0 clean — verify the terminal result event finalized](../learnings/1790123188250-slang-pr-review-reviewer-a-can-truncate-to-a-false.md) — async subagent dispatch ends the print session mid-synthesis, so `summarize.py` reports 0/0/0 + `success`; check `stream.jsonl` for a "holding before I finalize the table" result and re-run.

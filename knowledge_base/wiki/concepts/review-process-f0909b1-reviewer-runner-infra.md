---
title: Reviewer-runner infrastructure — API-400 payloads, integrity-fail, static-only runs, monitors, patch contamination
type: concept
group: review-process
tags: [reviewer-a, reviewer-c, clarity, slang-pr-review-runner, api-400, integrity-fail, monitor, patch-mode, shared-checkout, artifacts]
source_count: 25
---

# Reviewer-runner infrastructure

The `/slang-pr-review` workflow runs three reviewers — A (correctness, `slang-pr-review-runner` /
`compose-and-run.sh`), B (Devin, `devin-fetch.sh`), C (clarity, `slang-clarity-review-runner` /
`run-clarity.sh`) — whose infrastructure failures read identically to success unless you check the
right artifact; silence, a clean-looking file, and a green terminal reason are untrustworthy alone.

## TL;DR

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
- **Reviewer A's inner `claude --print` lead kills its own background subagents by ending its
  turn** — launch EVERY run with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` AND a private
  `REPO_ROOT` worktree (neither runner script nor the workflow's dispatch line sets either). It
  hits small diffs too, and can exit 0 as "success". A `final-review.md` under ~1 KB or without a
  `**Verdict**` line, or none after a budget cap (even $30 on a 7-line follow-up once the ceiling
  is lifted), is no review, never 0/0/0: salvage `task_notification` summaries / interim
  `"type":"result"` lines and probe the leads, or run the REVIEW.md lenses yourself, label the
  result as such, and set `reviewers_complete=false`. Release no verdict until every substitute
  lens has returned, or label it provisional — a late IR lens can flip APPROVE to REQUEST_CHANGES.
- **Monitors must key on the runner's own terminal sentinels / artifacts, never generic failure
  words** — the streamed PR body legitimately contains "error"/"failed".
- **Runners self-assign a transcripts dir; there is no `--out` flag** except on `devin-fetch.sh`.

## The API-400 payload truncation (Reviewer A and C)

Signature: `terminal_reason: api_error`, `api_error_status: 400`, `result: "API Error: 400 Invalid
JSON payload: unexpected end of data: line 1 column ~199,42X"`, num_turns:1, ~$0, ~3s, no
`final-review.md`. On PR #12650 A died three times identically after reading the large PR body
while B and C (smaller contexts) completed — the discriminator is REQUEST SIZE, not the PR
([Reviewer A can die on transient API-400 payload truncation](../learnings/1787266138406-reviewer-a-slang-pr-review-runner-can-die-on-trans.md)).
The char position (~199,415–199,422) is near-constant across dispatches and PRs, so the cut is in
the ~195KB fixed initial body at a Bedrock/gateway boundary, and it REPRODUCES on back-to-back
retries. Two fast retries don't prove a deterministic failure; run a SPACED-retry driver (~180s
apart; success seen around attempt 3 of 6) and proceed with B+C in parallel
([Reviewer A transient 400 payload-truncation reproduces on back-to-back retries](../learnings/1787341192642-reviewer-a-transient-400-payload-truncation-reprod.md)).

Reviewer C hits the same class via payload ACCUMULATION: on #12670 and #12697 (an 81-line diff) it
failed twice at `column ~235K–390K` because the multi-skill pipeline (clarity → fine-grained →
consolidate → scope-filter → resolve-judgment-calls) re-reads `tmp/` state regardless of diff size.
After two identical crashes skip C (advisory, non-gating — A is the gating reviewer) and check
whether A's editorial filter already kept the top clarity concern
([Clarity reviewer API-400 is payload-accumulation, not diff-size, dependent](../learnings/1787371827876-clarity-reviewer-api-400-is-payload-accumulation-n.md)).
A `completed` terminal reason doesn't guarantee a valid clarity artifact: grep it for
`API Error|Invalid JSON|unexpected end of data`. An error string = failed; short verification prose
(743 bytes, "Now let me write the candidate files") = ran but produced no candidates; the runner's
guard (`!!! CLARITY-INCOMPLETE: clarity-review.md is 96B (floor 500B)`) is correct — 96 bytes is the
fake-clean size, never a clean 0-findings result
([Clarity reviewer C can hit reproducible API-400 payload-overflow; 3rd retry may under-produce](../learnings/1787322332417-clarity-reviewer-c-can-hit-reproducible-api-400-pa.md)).

## Absence-of-build and integrity-fail read like success

A clean `final-review.md` with drift==0 can come from a purely STATIC review: on #12681 (where the
local build was the key signal) `tool-uses.jsonl` had zero `cmake|ninja|slang-test` calls. When the
request hinges on a build, run
`grep -oE '"command": "[^"]*(cmake|slang-test|ninja)[^"]*"' <run_dir_A>/tool-uses.jsonl`; if empty,
build it yourself. A spirv-asm FileCheck pass with `SLANG_RUN_SPIRV_VALIDATION=0` confirms emit
shape only, not Vulkan validity — say so
([Reviewer A can silently do a static-only review — verify the build actually ran](../learnings/1787323074074-reviewer-a-can-silently-do-a-static-only-review-ve.md)).

The inverse: a reviewer that CANNOT build. For an SGL/AppWindow slangpy PR (`src/sgl/*`),
`build/linux-gcc` held only a stale `CMakeCache.txt` (`ninja: error: loading 'build-Debug.ninja'`),
and re-configuring failed on missing `python3-dev` (`Python.h`) then GLFW's
`libxinerama-dev`/`libxcursor-dev`/`libxi-dev` headers, which the non-root (uid 1000, no sudo)
container can't install. Don't call `install_packages` mid-review — approval → rebuild → **container
restart** destroys the review session. Do the source-level review, report the build as an explicit
ENVIRONMENT BLOCKER ("builds clean" then rests on the fixer's/codex's compile), and if a build is
required ask the operator for `python3-dev libxinerama-dev libxcursor-dev libxi-dev` first
(`-DSGL_BUILD_PYTHON=OFF` skips python3-dev but still needs X11)
([SlangPy sgl build needs system dev headers not present in the reviewer container](../learnings/1789382093432-slangpy-sgl-build-needs-system-dev-headers-not-pre.md)).

**INTEGRITY-FAIL under concurrency.** The net in `compose-and-run.sh` (~lines 185-195) compares
`tmp/pr-diff.patch`'s `+++ b/` paths to `gh pr view --json files` at exit and writes
`INTEGRITY-FAIL.txt` on mismatch — but `/workspace/agent/slang` is a SHARED checkout, so concurrent
reviews clobber the file and the net can list files of a third PR. Don't re-run on the log line,
and don't trust the model's self-report: triangulate the diff sha256 across live `gh pr diff`, A's
run-start `pr-diff.reference`, the `diff sha256` footer in `final-review.md`, and the hash in C's
run-dir name, then positive-control one finding's file:line. On PR 12647 all four agreed on
`7bd29ae…` despite an INTEGRITY-FAIL listing a third PR's files
([Reviewer A INTEGRITY-FAIL can be a teardown-time false alarm under concurrent runs](../learnings/1787266145358-reviewer-a-integrity-fail-can-be-a-teardown-time-f.md)).
On slang-rhi#867 a concurrent #868 review rewrote `slang/tmp/{pr-diff.patch,context.json}`; the trip
was false (A's reference hash matched `gh pr diff 867` and C's) but passed "by luck, not by
construction" — until scratch is per-run, confirm the reviewed `diff_hash` matches `gh pr diff <n>`
before trusting a verdict ([slang-reviewer compose-and-run.sh races on shared tmp/ across concurrent reviews](../learnings/1789438517649-slang-reviewer-compose-and-run-sh-races-on-shared-.md)).
On slang#13083 (amid #13081/#869/#868): (1) don't discard A on exit-1 alone — the inner model often
detects the mismatch, re-stages to an isolated path and stamps the correct `reviewed: <sha> · diff
sha256 <hash>`; verify head == `gh pr view <PR> --json headRefOid`, `summarize.py` success +
drift==0, and real target-PR symbols in the body. (2) Both runners write `transcripts/<key>-<TS>/`,
so `ls -1dt transcripts/*/ | head -1` may pick a concurrent run — pin the dir from the launch line
(`>>> output → <dir>`; clarity dirs embed `pr-pr<N>-<headsha>-<diffhash>`) and grep each section for
the target PR's symbols with 0 hits for the other PR's. Durable fixes: per-run tmp staging and a
machine-readable `RUN_DIR=` line
([concurrent slang PR reviews contaminate shared tmp/ and transcripts/ — pin run dirs, don't trust exit-1](../learnings/1789443118244-concurrent-slang-pr-reviews-contaminate-shared-tmp.md)).

**Patch-mode contamination is real damage.** Patch mode runs `git -c ... commit -q -am` on a temp
branch, which stages ALL modified tracked files, so dirty edits in the shared checkout get reviewed
with your patch. On #12771 A reviewed `EnumCase`/`slang-parser.cpp`/`core.meta.slang`, none in the
36-line CI-YAML patch. The `diff sha256` footer hashes the contaminated diff and looks consistent;
verify `git show --stat <temp-sha>` equals the patch's `diff --git` set. C is immune (isolated
worktree), so wild A/C disagreement on WHAT the diff is suggests A-side contamination. Before
dispatch require `git -C <repo> status --porcelain` empty (without `-C`, from `/workspace/agent`, a
`| wc -l` reads a false 0)
([Patch-mode review diff contaminated by dirty shared checkout (git commit -am)](../learnings/1787746426193-patch-mode-review-diff-contaminated-by-dirty-share.md)).

## Reviewer A's background-wait kill and budget cap → a false 0/0/0 that looks like APPROVE

`compose-and-run.sh` drives an inner `claude -p` whose lead dispatches 5–7 `.claude/agents/*`
subagents with `run_in_background: true`; print mode has a **600s background-wait ceiling**
(`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`, default 600000). Past it the CLI logs `Background tasks
still running after 600s; terminating. Set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 to wait
indefinitely.`, stops every subagent (`task_notification` `stop`/`killed`, 0 tokens) and skips the
editorial synthesis: `final-review.md` is a ~dozens-to-200-byte stub ("Next I'll check …") and the
summarizer reports **0/0/0** — identical to a clean APPROVE. REVIEW-GUARD catches it (`!!!
REVIEW-GUARD FAIL: final review is N bytes (<500)`, exit 1), but a `nohup … ; echo exited $?`
wrapper can mask the exit, so check the file size and grep for `REVIEW-GUARD FAIL` / `Background
tasks still running after`. slang#12875 burned $8.5 this way. Fix: export
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` before `compose-and-run.sh` (scripts don't set it; `repro.sh`
inherits it) at unchanged cost. A drift grep for `pulls/N/reviews` can false-positive on subagent
prompt text — check the PR's real reviews list ([#12875 600s kill](../learnings/1791298146686-slang-pr-review-runner-reviewer-a-killed-by-claude.md)).

**It recurs on every launch that omits the variable.** A variant: the lead ends its own turn ("The
reviewers are still running; I'll wait for their completion notifications") and every lens gets
`status: stopped`. slang#13386 failed 3/3, and #13378/#13381/#13384 the same day; bare retries only
sometimes worked ([compose-and-run can systematically kill its own background subagents — 3/3 on #13386](../learnings/1790924682986-reviewer-a-compose-and-run-can-systematically-kill.md)).
#13410 failed twice ($21 → 80 bytes; $6 → `REVIEW-GUARD FAIL: 93 bytes`)
([ALWAYS launch with CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0](../learnings/1790970036877-reviewer-a-always-launch-with-claude-code-print-bg.md)).
Diff size and a "success" exit are no guard: slang#13171 R2 (274 lines, 9 files) exited 0 at $11
with a 223-byte file, 7 `stopped` notifications and an empty `subagents/`. Treat an A 0/0/0 as clean
only if `wc -c final-review.md` > ~1 KB **and** it has a `**Verdict**` line
([Reviewer A truncated final-review.md on a SMALL diff too](../learnings/1791329053525-reviewer-a-truncated-final-review-md-on-a-small-di.md)).
Detect: `grep -c '"status":"stopped"' <run_dir>/stream.jsonl` equals the dispatch count, `completed`
is 0, and the `type:"result"` text says the lead is waiting; nothing is salvageable. #13315 R3
failed twice (166–186 bytes, `terminal_reason=completed`, no subagent `.jsonl`)
([compose-and-run can exit before its background subagents finish](../learnings/1791360790085-reviewer-a-compose-and-run-can-exit-before-its-bac.md)),
and #13502 failed once to a concurrent #13503 rewriting shared `slang/tmp/` (`INTEGRITY-FAIL:
reviewed diff != PR files`) and once, isolated but without the variable, to the ceiling (88-byte
stub, only `.meta.json` left)
([launch with the variable AND an isolated REPO_ROOT every time](../learnings/1791413704374-reviewer-a-launch-with-claude-code-print-bg-wait-c.md)).

**Launch line, every time** (neither script sets the variable; the workflow dispatch line omits
both): `git worktree add --detach /workspace/agent/wt-<N>-revA origin/master`, then
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 REPO_ROOT=/workspace/agent/wt-<N>-revA setsid nohup bash
…/compose-and-run.sh … </dev/null &` (`bash` because the exec bit can be missing). The durable fix
belongs in `repro.sh` (an env default, or a lead that waits for every `task_notification`). If a run
still dies, dispatch the REVIEW.md lenses (code-quality, ir-correctness, test-coverage,
cross-backend, security) as your own `Agent` subagents against a local diff + worktree, apply
REVIEW.md Step 3's editorial table, set `reviewers_complete=false`, and label it "Reviewer A (lenses
run directly — runner failed)". Wait for every lens or label the verdict "provisional — IR pass
pending": on #13315 an APPROVE_WITH_NITS went out while the substitute IR lens ran (~68 min); it
found a real ICE and forced an amended REQUEST_CHANGES
([don't release a verdict before every correctness pass lands](../learnings/1791365011484-don-t-release-a-review-verdict-before-every-correc.md)).

**Budget caps.** At `--max-budget-usd` ≤ ~$15, A dispatches six lenses then hits
`error_max_budget_usd` before merging, leaving no file or an "INCOMPLETE" note and a misleading
0/0/0 (#13400 R2 at $15, #13384 R4 at $8). Read interim reports via `grep '"type":"result"' A-*.log`
and the clarity candidates in `$REPO_ROOT/tmp/review-candidates/`, and probe A's leads yourself — on
#13400 one was a real 🔴 (`NativeRef<int*>` hitting a new `SLANG_RELEASE_ASSERT` in
`emitPtrTypeForwardDeclarationImpl`). Never report a capped run as clean
([under a small budget cap Reviewer A often produces no final-review.md](../learnings/1790963554835-slang-pr-review-reviewer-a-under-a-small-budget-ca.md)).
With the wall-clock ceiling lifted the cut moves to the budget even on tiny diffs: #13503 R2 (7
lines) hit the cap at $30.31 before writing `final-review.md`; a SendMessage "finalize now" didn't
help, and `REVIEW-GUARD FAIL: zero Task/Agent subagent dispatches` was misleading (6 Agent calls
were made) — read `tail -1 stream.jsonl` for `subtype: error_max_budget_usd` / `terminal_reason:
budget_exhausted`. Recover from the `summary` field of `{"type":"system","subtype":"task_notification","status":"completed"}`
events (dedupe by (task_id, len); 5 of 6 reports, 6–11 KB each), apply REVIEW.md's filter, label it
"Reconstructed" and attach raw outputs. For a follow-up round consider `--max-budget-usd 45`, since
2–3 lenses tend to chase the same lead (there, `try fwd_diff(...)` — a real ICE, not the predicted
one) ([$30 exhausted on a small PR; reconstruct from task_notification](../learnings/1791423170957-reviewer-a-can-exhaust-max-budget-usd-30-on-a-smal.md)).

**Missing exec bit.** `run-clarity.sh` ships `-rw-rw-r--` (since 2026-09-30 `compose-and-run.sh`
and `devin-fetch.sh` too, see [pipeline ops](review-process-f0909b2-pipeline-ops.md)), so direct
execution fails with exit 126. Invoke `bash /home/node/.claude/skills/slang-clarity-review-runner/scripts/run-clarity.sh --mode pr --pr <N> --repo <owner/repo> …`
rather than `chmod +x` on a skill file you didn't author. After an exit-126 the newest transcripts
dir is a STALE prior run — check the PR/head in its name
([slang-clarity-review-runner run-clarity.sh lacks the execute bit — invoke via `bash`](../learnings/1789719730698-slang-clarity-review-runner-run-clarity-sh-lacks-e.md)).

## Monitors, re-sends, and the transcripts-dir flag

**Monitors.** The inner `claude --print` streams the PR body and diff into the log as `tool_result`
content, and a docs PR body legitimately says "error"/"failed"/"no such file", so
`grep -qiE 'error|failed'` emits a FALSE `REVIEWER_*_ERROR` and latches `done=1`. Match only
content-immune sentinels: `!!! INTEGRITY-FAIL` / `!!! REVIEW-GUARD FAIL` (`compose-and-run.sh`),
`!!! CLARITY-INCOMPLETE` (`run-clarity.sh`); success = the artifact present and non-empty
(`final-review.md` / `clarity-review.md` / `devin-flags.md`); B writes `devin-error.txt` on skip
([monitor grep for reviewer failure must not match streamed PR-body content](../learnings/1787605976090-monitor-grep-for-reviewer-failure-must-not-match-s.md)).
Generic tokens (`Error:`, `exit code [1-9]`, `fatal`, `Traceback`) also appear in `tool_result`
payloads during normal retries — watch the artifact (present, non-empty, stream stopped growing),
detect real CLI failure with `grep -qE '^\{"type":"result"'`, and treat a monitor event as a trigger
to re-verify on disk
([monitor for a claude-CLI reviewer run must not grep the stream for generic failure words](../learnings/1787869224351-monitor-for-a-claude-cli-reviewer-run-must-not-gre.md)).

**Re-send after GC.** When asked to re-send a review days later, don't re-run or reconstruct from
memory. Check the artifact first (`combined-review.md` is GC-reaped after a few days), then
`gh pr view --json state,isDraft,headRefOid,mergedAt` (merged ⇒ moot; head unchanged ⇒ old verdict
holds). Stream logs survive the reap: A's `final-review.md` is the LAST assistant text block in the
stream JSONL (check the `reviewed: <sha>` footer); C's is the `Write` payload for
`clarity-review.md`. Rebuild `combined-review.md`, re-send with `in_reply_to=<failure-notice id>`,
and ask for receipt
([Review re-send after GC: check merge state + head-delta, reconstruct from stream logs](../learnings/1787558224979-review-re-send-after-gc-check-merge-state-head-del.md)).

**No `--out` flag.** `compose-and-run.sh` and `run-clarity.sh` reject `--out`/`--run-dir`
(`unknown flag --out`; silent if backgrounded). Both self-assign
`<skill-dir>/transcripts/<mode>-<timestamp>` and print `>>> output → <path>`; only `devin-fetch.sh`
takes `--out`
([slang-pr-review runners manage their own transcripts dir — no --out flag](../learnings/1787049654930-slang-pr-review-runners-manage-their-own-transcrip.md)).

**slang-rhi PRs** work without a `REVIEW.md`/`.claude/agents` there: keep `REPO_ROOT` at
`/workspace/agent/slang` and pass `--repo shader-slang/slang-rhi --pr <N>`. The slang checkout
**vendors slang-rhi at `external/slang-rhi/`**, so lenses get real source (on #868 the correctness
reviewer cited `external/slang-rhi/src/vulkan/vk-buffer.cpp` lines); it's a pinned submodule that may
lag head, so verify changed hunks against `gh pr diff`. `gh` reads on public slang-rhi work even when
`gh auth status` says `GH_TOKEN invalid`. A peer fix-review handoff from `slang-fixer` (no
`<github-post-authorized />`) gets no GitHub post — return `combined-review.md` on the peer edge only
([slang-pr-review-runner reviews slang-rhi PRs with real source via vendored external/slang-rhi](../learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md)).

**Source learnings (25):**

- [slang-pr-review runners manage their own transcripts dir — no --out flag](../learnings/1787049654930-slang-pr-review-runners-manage-their-own-transcrip.md) — grep launch log for `output →`; only devin-fetch.sh takes `--out`.
- [slang-pr-review-runner reviews slang-rhi PRs with real source via vendored external/slang-rhi](../learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md) — default REPO_ROOT, `--repo shader-slang/slang-rhi`; vendored submodule may lag.
- [Reviewer A (slang-pr-review-runner) can die on transient API-400 payload truncation](../learnings/1787266138406-reviewer-a-slang-pr-review-runner-can-die-on-trans.md) — PR #12650; discriminator is request size; merge on B+C.
- [Reviewer A INTEGRITY-FAIL can be a teardown-time false alarm under concurrent runs](../learnings/1787266145358-reviewer-a-integrity-fail-can-be-a-teardown-time-f.md) — PR 12647; triangulate diff sha256 across four sources.
- [Clarity reviewer (C) can hit reproducible API-400 payload-overflow; 3rd retry may under-produce](../learnings/1787322332417-clarity-reviewer-c-can-hit-reproducible-api-400-pa.md) — PR #12670; `completed` ≠ valid artifact; 96B = fake-clean.
- [Reviewer A can silently do a static-only review — verify the build actually ran](../learnings/1787323074074-reviewer-a-can-silently-do-a-static-only-review-ve.md) — PR #12681; grep `tool-uses.jsonl` for cmake/ninja/slang-test.
- [Reviewer A transient 400 payload-truncation reproduces on back-to-back retries](../learnings/1787341192642-reviewer-a-transient-400-payload-truncation-reprod.md) — near-constant char position; spaced ~180s retries.
- [Clarity reviewer API-400 is payload-accumulation, not diff-size, dependent](../learnings/1787371827876-clarity-reviewer-api-400-is-payload-accumulation-n.md) — PR #12697; skip C after 2 crashes.
- [Review re-send after GC: check merge state + head-delta, reconstruct from stream logs](../learnings/1787558224979-review-re-send-after-gc-check-merge-state-head-del.md) — slang#12626; artifact, then PR state, then stream logs.
- [Monitor grep for reviewer failure must not match streamed PR-body content](../learnings/1787605976090-monitor-grep-for-reviewer-failure-must-not-match-s.md) — match `!!!` sentinels and artifact presence only.
- [Monitor for a claude-CLI reviewer run must not grep the stream for generic failure words](../learnings/1787869224351-monitor-for-a-claude-cli-reviewer-run-must-not-gre.md) — PR #12806; watch artifact + line-start `^{"type":"result"`.
- [Patch-mode review diff contaminated by dirty shared checkout (git commit -am)](../learnings/1787746426193-patch-mode-review-diff-contaminated-by-dirty-share.md) — PR #12771; verify temp commit FILE SET; clean checkout first.
- [SlangPy sgl build needs system dev headers not present in the reviewer container](../learnings/1789382093432-slangpy-sgl-build-needs-system-dev-headers-not-pre.md) — don't `install_packages` mid-review; report env blocker.
- [slang-reviewer compose-and-run.sh races on shared tmp/ across concurrent reviews](../learnings/1789438517649-slang-reviewer-compose-and-run-sh-races-on-shared-.md) — slang-rhi#867/#868; confirm `diff_hash` == `gh pr diff <n>`.
- [Concurrent slang PR reviews contaminate shared tmp/ and transcripts/ — pin run dirs, don't trust exit-1](../learnings/1789443118244-concurrent-slang-pr-reviews-contaminate-shared-tmp.md) — slang#13083; pin run_dir from launch `output →` line.
- [Reviewer A compose-and-run can systematically kill its own background subagents (3/3 on #13386)](../learnings/1790924682986-reviewer-a-compose-and-run-can-systematically-kill.md) — lead ends turn while lenses run; run lenses yourself.
- [Reviewer A under a small budget cap often produces no final-review.md](../learnings/1790963554835-slang-pr-review-reviewer-a-under-a-small-budget-ca.md) — ≤$15 cap; read interim results, probe leads (#13400).
- [Reviewer A: ALWAYS launch with CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0](../learnings/1790970036877-reviewer-a-always-launch-with-claude-code-print-bg.md) — two guard-fails on #13410 without it.
- [Reviewer A truncated final-review.md on a SMALL diff too — check size, not just counts](../learnings/1791329053525-reviewer-a-truncated-final-review-md-on-a-small-di.md) — #13171 R2; require >~1 KB + `**Verdict**` line.
- [slang-clarity-review-runner run-clarity.sh lacks the execute bit — invoke via `bash`](../learnings/1789719730698-slang-clarity-review-runner-run-clarity-sh-lacks-e.md) — exit 126; after it, newest transcripts dir is stale.
- [Reviewer A killed by the 600s background-wait ceiling on #12875](../learnings/1791298146686-slang-pr-review-runner-reviewer-a-killed-by-claude.md) — stub + REVIEW-GUARD FAIL; export the variable.
- [Reviewer A (compose-and-run) can exit before its background subagents finish → REVIEW-GUARD FAIL](../learnings/1791360790085-reviewer-a-compose-and-run-can-exit-before-its-bac.md) — #13315 R3 2/2; `reviewers_complete=false`.
- [Don't release a review verdict before every correctness pass lands](../learnings/1791365011484-don-t-release-a-review-verdict-before-every-correc.md) — #13315: late IR lens found ICE → REQUEST_CHANGES.
- [Reviewer A: launch with CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 AND an isolated REPO_ROOT every time](../learnings/1791413704374-reviewer-a-launch-with-claude-code-print-bg-wait-c.md) — #13502 2/2: shared-tmp clobber, then the ceiling.
- [Reviewer A can exhaust --max-budget-usd 30 on a small PR; reconstruct from task_notification summaries](../learnings/1791423170957-reviewer-a-can-exhaust-max-budget-usd-30-on-a-smal.md) — #13503 R2 at $30.31; dedupe completed summaries.

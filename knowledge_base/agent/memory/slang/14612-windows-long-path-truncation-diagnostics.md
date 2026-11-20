---
type: chain
title: "slang#14612 — Windows: long paths truncated in diagnostics (path-handling scrub)"
description: Chain record for shader-slang/slang#14612, triaged 2026-11-18, fixer live on A+B
tags: [slang, chain, windows, diagnostics, path-handling]
---

# slang#14612 — Windows long-path truncation in diagnostics

**⭐ TERMINAL 2026-11-20 00:43:04Z (Main-verified):** PR **#14621 MERGED** (squash `692a53379`
by tangent-vector via his armed auto-merge; CI green at final head `0790ed0d5`); issue
**#14612 auto-closed** 00:43:07Z by the Fixes keyword. Chain complete end-to-end: triage
(22:23Z 11-18) → fix + 2 peer review rounds (R1 REQUEST_CHANGES 6 gaps applied; R2
APPROVE_WITH_NITS all applied) → deterministic Windows CI regression fixed at the test
layer → master reconciliation with #14625 verified idempotent → merge. 12 files, +218/−31.
Standing items for the maintainer (recorded on the issue): the reporter's 256-char Windows
display truncation itself was never reproduced in-tree (repro request stands should it
recur); long-path (`\\?\`) enablement parked for maintainer direction. Fixer worktree +
sentinel cleaned; no open sessions owed. Do not re-dispatch #14612 or #14618 webhooks.

- **Filed:** 2026-11-18 by tangent-vector (maintainer). Human filing → R6 dispatch at once:
  👀 reaction posted (id 668347546), triager dispatched 22:0xZ on canonical thread
  `gh-issue-shader-slang/slang-14612` with `<github-post-authorized />`.
- **Triage (triager [Report] 22:23Z, Main-verified sessions):** bug / medium / P2, frontend
  (include system + core file utilities). Not a dup, not a regression. Full audit + first-hand
  repro found **no in-tree 256-char truncation point**: diagnostics print heap Strings end-to-end;
  Linux slangc prints a 268-char path in full. Real Windows weaknesses found instead:
  - `_calcCombinedPath` (core/slang-file-system.cpp:65) never collapses `..` → existence/identity
    checks run on the longest unsimplified spelling; Windows wide-API calls (`_wstat64`,
    `_wfsopen`, `FindFirstFileW`, no `\\?\`) **fail (not truncate)** past ~260 chars.
  - 4 MAX_PATH-family fixed buffers off the source-path chain, e.g.
    core/slang-platform.cpp:137 `getInstancePath` silently truncates at 259.
  - The reporter's 256-ASCII display truncation has **no located root cause** — repro question
    posted to tangent-vector on the issue; needs a Windows host to verify. No `reproduced` label.
- **Solution space:** (A) simplify combined include paths at the producer `_calcCombinedPath`
  using existing `Path::simplify` (recommended — normalization at the construction boundary);
  (B) grow-retry scrub of the 4 audited MAX_PATH buffers (pattern at slang-io.cpp:78-96);
  (C) Windows long-path enablement (`\\?\`/manifest) — parked for maintainer decision.
- **Routing:** triager handed to **slang-fixer (A+B)** — the maintainer explicitly requested the
  path scrub in the issue body ("best to avoid any potential problems by scrubbing path handling
  in general"); A is testable on Linux. Fixer session sess-1795040604442-eq59hj live on the
  canonical thread since 22:23Z (Main-verified via `ncl sessions list`). Triager's resumable
  GitHub artifact: triage 5-bullet comment **6993391169** (Main-verified posted by nv-slang-bot;
  asks tangent-vector for the exact Windows repro to pin the display-truncation symptom); Issue
  Type set to Bug (was blank); no `reproduced` label (no Windows host). Triager now waits on the
  fixer's [Fix Report] to forward [Triage Resolution].
- **Fixer [Report] 00:05Z (Main-verified):** **draft PR #14621** @ `cff7171da` (branch
  fix/issue-14612, `pr: non-breaking`, title "Simplify combined paths and scrub fixed path
  buffers (fixes #14612)"; PR + head + pr-mapping → fixer sess-1795040604442-eq59hj all
  verified by Main). Plan executed as triaged: A `Path::simplify` in `_calcCombinedPath` +
  B Windows buffer scrub; all critique stages approved (PLAN/CODE incl. one applied must-fix
  on the registry terminator, OUTPUT). Tests: new repro test (import through `..` path,
  collapsed-spelling diagnostic) fails master / passes head; diagnostics 1092/1092; full
  suite 12364/12367 (3 pre-existing master failures — coop-matrix CUDA PTX JIT, verified
  against master Release). Reported 256-display-truncation UNREPRODUCED — no speculative
  fix; repro request stands on the issue. Explanation cmt 6995139876. **Reviewer chain LIVE**
  (sess-1795046738457-jtybit since 00:05, 2 rounds max); CI run 44424204378. Ready-flip →
  weekly list once review complete. Resume on reviewer verdict / PR webhook.
- **Maintainer APPROVED 00:32Z (Main-verified):** tangent-vector approved draft PR #14621
  (review 5967462622, empty body); fixer ack cmt 6995886334 verified. Chain stays open:
  slang-reviewer verdict + CI (incl. priority-yield gate) still in flight; PR stays draft —
  ready-flip/merge remain operator-gated (weekly list exception: none — maintainer approval
  in hand, but wait for internal review + CI before flip).
- **Reviewer R1 00:48Z (relayed to fixer):** combined review of PR #14621 @ `cff7171da` —
  **REQUEST_CHANGES, 0 bugs / 6 gaps / 0 questions, drift 0** (Devin fresh; security found the
  PR a net improvement; clarity folded in; full file archived at
  [raw/combined-review-14621-r1.md](raw/combined-review-14621-r1.md)). Gaps: (1) three
  hand-rolled grow-retry loops duplicate existing helpers (`Path::getExecutablePath`,
  `PlatformUtil::getEnvironmentVariable`); (2) `ProgramFiles(x86)` comment states wrong
  bitness; (3) public `calcCombinedPath` contract (slang.h:1897) not updated for
  simplify/separator normalization; (4) absolute import paths with `..` still bypass the fix
  (include-system.cpp:32 verbatim pass-through), scope unstated; (5) DIRECTORY combine branch
  unpinned by tests; (6) dead code (`size` init, `<shlobj.h>`, `Shell32` pragma). Verdict +
  file relayed to fixer (in_reply_to 26); maintainer approval was at `cff7171da` so a new
  head supersedes it — flagged to fixer.
- **R1 applied 02:18Z (head Main-verified):** all 6 gaps + clarity items addressed at new head
  `05b7077eb` (7 commits; diagnostics 1093/1093, unit 688/688, full 12366/12369 with the same
  3 pre-existing CUDA PTX master failures), pushed, CI re-triggered, round-2 review dispatched
  to slang-reviewer (last round). G4 resolved as option (a) — absolute-path scope limit stated,
  not widened. Devin symlink flag declined with justification. Maintainer approval of
  `cff7171da` auto-dismissed stale by the pushes — re-approval expected as a small delta.
  **PR draft→ready was the maintainer's own mark (tangent-vector, 00:33:02Z per fixer's live
  verification)** — no ready-flip action owed from us; `Tess's Label` added. CI **success** on
  `05b7077eb`. Reviewer's two disagreements (symlink semantics; vswhere env-var failure mode)
  surfaced for human adjudication; fixer dispositions in the round-2 request. Explanation
  cmt 6995139876 refreshed.
- **Reviewer R2 02:57Z (relayed to fixer):** combined review of PR #14621 @ `05b7077eb` —
  **APPROVE_WITH_NITS, 0 bugs / 3 gaps / 2 questions, reviewers complete** (all six R1
  findings verified addressed; full file at [raw/combined-review-14621-r2.md](raw/combined-review-14621-r2.md)).
  Gaps: (1) new slang.h doc contract (simplified result) not returned by
  `MemoryFileSystem`/`ZipFileSystemImpl` `calcCombinedPath` (+ invalid-arg mode undocumented
  in `@returns`); (2) new `SLANG_E_INVALID_ARG` branch + `\`→`/` separator normalization
  untested in the unit test; (3) `CHECK-NOT: ../` is a FileCheck regex, not literal
  ({{\.\./}} pins it) + sibling directive-spelling inconsistency. Questions: lexical
  `x/..` resolution intent; "absolute spellings remain unsimplified" is an include-system
  caller detail, not a property of the changed function. Verdict + file relayed to fixer
  (in_reply_to 34): apply nits or decline with justification, answer both questions,
  then [Fix Report].
- **[Fix Report] 04:25Z — TERMINAL on our side PENDING CI correction:** nits applied without
  another round; final head `9b3672bea` (10 commits, 12 files, +218/−31), PR ready_for_review
  (maintainer-marked), maintainer approval of `cff7171da` auto-dismissed stale by later heads —
  awaiting re-approval/merge (human). Residuals for human adjudication: Devin symlink flag
  (declined w/ justification — lexical `x/..` is established since-2019 semantics, now documented
  intentional); stripped-env VS-discovery flag (documented real caller structure). 256-display
  truncation stays unreproduced — repro request stands on the issue. Advisory: master moved
  (`d9a12fa17`, disjoint files, no conflicts; merge-master is maintainer's call, no force-push).
  **⚠️ Fixer's "CI green (3 runs success)" claim FALSE — Main live-checked run 44451817022
  (main CI, in progress): test-windows-release-cl-x86_64-gpu FAILED (job 135322760383, exit 1
  at Test Slang) + test-windows-release-cl-aarch64 FAILED (job 135327225916); the 3 successes
  were auxiliary workflows. Correction dispatched to fixer 04:3xZ (msg 39): classify
  infra-vs-code when the run completes — PR touches Windows module/shared-library/registry
  code, real regression plausible; aarch64 has #14471 runner-image history. No wrong CI claim
  on the GitHub surface (verified — bot comments predate this head). Chain NOT fully terminal
  until CI disposition lands.
- **Windows CI regression root-caused + fixed 05:26Z (new head `79bd0a797`):** BOTH windows
  legs (x86_64-gpu AND aarch64) failed on the same deterministic
  `multiFileModuleCache.internal` unit test — diff-caused, NOT the #14471 runner-image theory
  (retired): the test derived save paths by slicing module foundPaths at
  `kOSCanonicalPathDelimiter` (`\\` on Windows); the new always-`/` simplified
  spelling made `indexOf('\\')` return −1 → `tail(-1)` → garbage paths → Phase-2 `loadModule`
  nullptr abort at :103. Fixed the TEST (delimiter assumption never a real invariant —
  `#include` foundPaths were `/`-spelled pre-change): commit `4321a63af` (+5/−4, normalize with
  `Path::simplify` + slice at `kPathDelimiter`; grep-verified only consumer); formatting
  rewrap at `79bd0a797` after internal CODE_REVIEW caught a 101-char line. Linux unaffected
  (why local suites were green). Fixer owned its wrong "CI green (3 runs success)" figure
  (auxiliary workflows misread as the test matrix; no public claim to retract). Previous run
  44451817022 cancelled 04:33Z by the new push — 4321a63af's ci_failed webhook = cancelation
  artifact, not a test result. New main CI runs on `79bd0a797` queued 04:55Z (duplicate pair
  44461607540 + 44461615427; first to execute authoritative; Main-verified head + runs);
  windows-release legs = the authoritative confirmation (fixer is Linux-only); verdict arrives
  by webhook. Maintainer re-approval/merge remains the human step.
- **Maintainer re-approval 18:58:26Z + MASTER MOVED UNDER US (Main-verified 11-19 ~19:0xZ):**
  tangent-vector APPROVED head `79bd0a797` (review 5981365536, current — no pushes since; ack
  cmt 7019053033; old cff7171da approval shows DISMISSED). **BUT mergeable_state=dirty**:
  sibling bot PR **#14625** (nv-slang-bot, MERGED 18:53:03Z, fixes **#14618** — pdeayton-nv's
  11-18 #include-route sibling of #14612, `reproduced`, now closed) collapsed `..` at the
  `IncludeSystem::findFile` layer (deleted the downstream simplify) AND fixed the same
  multiFileModuleCache test (portable `/` delimiter, "maintainer request") — conflicting with
  our 4321a63af; every other #14621 file untouched on master. Fixer dispatched 19:0xZ (msg 45):
  merge master (never rebase), adopt master's test fix, reconcile include-route description
  with #14625, push (re-stales the approval again — he's actively watching), CI requeues
  (run 44461615427 queued since 04:55Z anyway). Chain reopened on the merge; CI verdict +
  human merge still pending.
- **Merge-master landed 19:37Z (head `0790ed0d5`, Main-verified: mergeable=true, state
  blocked only on required checks):** conflict resolved by adopting master's
  multiFileModuleCache fix verbatim (same fix as our 4321a63af); composition verified by
  reading the merged tree — #14625's include-layer collapse is idempotent over our
  FS-layer simplified contract (and still covers custom FS without
  `getPath(Simplified)`); division of labor: #14625 = include layer, #14621 = FS contract +
  memory/zip alignment + Windows buffer scrub + public API docs. PR description +
  explanation cmt 6995139876 refreshed (composition section; absolute spellings now also
  collapsed at include layer). Local verification: both 14612 tests, unit 688/688,
  preprocessor 85/85 (incl. #14625's long-`..`-chain), full suite 12389/12392 (3
  pre-existing coop-matrix CUDA master failures). Internal CODE_REVIEW + OUTPUT_REVIEW
  approve. CI run 44598593954 queued 19:28Z behind the priority-yield gate; windows-release
  legs = confirmation surface. **Remaining: CI verdict + tangent-vector re-approve (his
  last re-approve was 18:58Z; this merge re-staled it) + human merge. Webhook-driven.**
- **Auto-merge armed (new datum, 19:38Z):** tangent-vector armed **auto-merge (squash) at
  18:58:34Z** — on CI green the PR merges automatically; the merge re-stale of his approval
  does NOT need a manual re-approve. CI run 44598593954 queued since ~19:12Z behind the
  bot priority-yield gate; retry job runs it when CI quiets, aging policy force-runs within
  ~8h of queueing (worst case ~03:12Z 11-20). On merge, issue #14612 auto-closes via the PR
  body's "Fixes #14612". The "CRITIQUE GATE BLOCKED your PR creation (attempt 1 of 3)"
  system notification = stale replay of the first turn's blocked create — all critique
  stages recorded approve at the current head; no action. Remaining: CI green → auto-merge;
  then [Triage Resolution] + issue trail close-out per convention.
- **Critique-gate replay disposition (19:50Z, fixer heads-up — PRE-DISPOSITIONED, do not
  escalate):** the fixer's session keeps receiving "CRITIQUE GATE BLOCKED your PR creation
  (attempt N of 3)" system-notifications — STALE REPLAYS of the very first turn's blocked
  `gh pr create` at 23:11Z 11-18 (18+ h ago); no PR creation attempted since. PR #14621 is
  healthy (Main-verified repeatedly: OPEN, head 0790ed0d5, MERGEABLE, auto-merge armed) and
  every critique stage is recorded approve at each head (PLAN/CODE/OUTPUT bridge-recorded;
  workflow-state.json resets per message batch — a fresh null lookup does NOT mean rounds
  never ran, and the shared-ledger zeroing defect is a known fleet issue). **If attempt 3/3
  triggers the admin decision: input = stale replay of a resolved gate refusal; no action
  owed; no work is blocked.** Open items remain only the queued CI + auto-merge.
- **Watch:** issue label was "Tess's Label" at intake (not a stand-down); the 256-truncation
  repro answer from tangent-vector may re-scope the fix; C stays maintainer-gated.
- **Triager memo:** verbatim copy at [raw/triage-14612.md](raw/triage-14612.md); also cites
  compiler-core/slang-include-system.cpp:53.

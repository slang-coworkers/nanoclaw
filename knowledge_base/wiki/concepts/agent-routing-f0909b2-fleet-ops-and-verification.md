---
title: Fleet operations — CI/GitHub infra, dispatch routing & verify-before-you-claim
type: concept
group: agent-routing
tags: [gh-auth, onecli, falcor-gate, ci-rerun, dispatch, wired-coworkers, stale-toolchain, verification, revert-drill, skill-drift]
source_count: 17
---

## TL;DR

Operational field notes for running the Slang/SlangPy coworker fleet, plus the
verification discipline that stops false premises from propagating.

**GitHub auth is a red herring under app-token / OneCLI-proxy setups.**
`gh auth status` reporting "GH_TOKEN invalid" and `gh api user` → 403 is EXPECTED
for a GitHub App installation token (it can't hit `/user`). Repo-scoped reads and
writes still work — test the actual call before escalating. On slang containers,
GraphQL-backed `gh` subcommands (`gh issue view`, `gh pr view`) break too, so use
`gh api` (REST) for everything. When `GH_TOKEN` is a OneCLI gateway routing token
(prefix `ROUT…`) and GitHub is disconnected, REST is fully dead — but `git fetch`
over https and the `slang-mcp` GitHub tools have independent auth and still work;
run `/slang-pr-review` in `--mode patch`.

**The falcor-build-approval-gate wedge blocks reruns for the WHOLE run.** A job
stuck at `status:waiting` keeps the run non-terminal, so `gh run rerun --failed`,
`--job`, and the job-scoped `actions/jobs/{id}/rerun` API all fail with
"already running" / 403 — even for unrelated, genuinely-flaky sibling jobs.
Check `gh run view --json jobs` for a waiting gate before concluding the rerun
API is broken; there's no workaround short of a human approving the gate.

**Dispatch routing:** a triager WIRED peer-to-peer to the fixer auto-hands-off
the instant it finishes — so don't blindly re-dispatch on top of it. Run the
two-session detector (`ncl sessions list | grep <fixer-group>`) FIRST. The same
canonical `thread_id` folds a double-dispatch into one session; when a race
happens, resolve the EDGE (who is the single parent), not the session.

**Verify before you claim.** Reproduce any "separate finding" on the SAME
toolchain as the PR head — a stale checkout pins an old slang with already-fixed
bugs and produces phantom bugs. Bisect the toolchain FIRST for a
"not-reproducible-at-HEAD" crash. Run the revert-drill on any pinning test.
Verify which code path actually fires before recommending a fix. And verify a
skill's VERSION (md5 + `git log -S`) before citing its mechanism — runtime copies
drift from canonical.

## GitHub auth: "invalid token" is almost always a red herring

Three independent reports converge on one rule: **do not escalate "can't reach
GitHub" on the basis of `gh auth status` alone — test the actual repo-scoped
call.** Running as `nv-slang-bot[bot]`, `gh auth status` may report "The token in
GH_TOKEN is invalid" and `gh api user` returns 403 "Resource not accessible by
integration" — this is expected because the token is a GitHub App installation
token, which cannot hit the `/user` endpoint that `gh auth status` probes. The
installation token still works for repo-scoped reads and writes: issue reads,
posting/patching comments, adding labels, GraphQL `updateIssue` all succeed
([gh auth red herring, app token](../learnings/1788374386518-gh-auth-status-says-gh-token-invalid-red-herring-f.md)).
A second report adds the operational workaround: on slang containers the App-token
auth precheck also breaks GraphQL-backed `gh` subcommands (`gh issue view`,
`gh pr view` return empty), so **use `gh api` for everything** — including posting
via `jq -Rsn --arg b "$BODY" '{body:$b}' | gh api .../comments --method POST
--input -`. Do NOT `env -u GH_TOKEN` (that removes the only credential; there's no
`gh auth login` state)
([gh auth falsely invalid; use gh api](../learnings/1788881883720-gh-auth-status-falsely-reports-nv-slang-bot-token-.md)).

The third report is the harder case: when `GH_TOKEN` is a OneCLI **gateway
routing token** (prefix `ROUT…`, ~23 chars) and GitHub isn't connected in OneCLI,
ALL github REST traffic is dead (`curl api.github.com` → 403
`{"error":"app_not_connected"}`), and there's no keyring fallback. Two things
still work and let a PR review proceed without escalating: `git fetch` over https
(git protocol takes a different proxy path — `git fetch origin pull/<N>/head:pr-<N>`
then diff against the merge-base), and the `slang-mcp` GitHub MCP tools (independent
auth). Run Reviewers A and C in `--mode patch --patch <diff>` (network-free);
`--mode pr` is unusable because the inner claude CLI's `gh pr diff` hits the blocked
REST API. Only escalate the OneCLI disconnection if you actually need to POST back
([gh/api blocked by OneCLI, git-fetch works](../learnings/1788913121098-slang-pr-review-gh-api-blocked-by-onecli-but-git-f.md)).

## The falcor-build-approval-gate wedge: whole-run rerun block

Three sweeps refine the same CI failure mode. Initially observed: `gh run rerun
<id> --failed` returns "run cannot be rerun; This workflow is already running"
even though the target job (e.g. `test-windows-debug-cl-x86_64-gpu-dx / test-slang`)
shows `completed/failure` — because a separate `falcor-build-approval-gate` job is
stuck at `status:waiting` (a manual environment-approval gate), which keeps the
whole run's overall `status` at `waiting`, and `gh run rerun` refuses any
non-terminal run. This has been wedged for 3+ consecutive days on some PRs; the
operational rule is to check `gh run view <id> --json jobs` for a `waiting` job
before calling rerun and, if present, note it as blocked-pending-approval-gate and
move on rather than retry-looping
([gh run rerun fails on wedged falcor gate](../learnings/1788545503656-gh-run-rerun-fails-on-wedged-falcor-build-approval.md)).

The next two sweeps widen the blast radius: it is NOT limited to Falcor jobs. The
job-scoped rerun via `gh api -X POST repos/{...}/actions/jobs/{job_id}/rerun` ALSO
fails (HTTP 403 "The workflow run containing this job is already running"), so a
genuinely-intermittent failure on an *unrelated* job cannot be rerun at all while
the gate sits pending
([falcor gate blocks ALL reruns](../learnings/1788631867865-falcor-build-approval-gate-waiting-blocks-all-reru.md)).
Confirmed again on PR #12840: an unrelated GPU flake
("The self-hosted runner lost communication with the server", sibling GPU jobs
green) could not be rerun via either `--failed` or `--job` — the pending gate
makes an otherwise-rerunnable flake un-rerunnable as a side effect. If you hit
"already running" on a run that otherwise looks fully completed, check
`gh run view <id> --json jobs --jq '.jobs[] | select(.status!="completed")'` for a
stuck gate before concluding the rerun API is broken
([falcor gate wedge blocks sibling jobs](../learnings/1788675398136-falcor-build-approval-gate-wedge-blocks-rerun-of-u.md)).
A related but distinct signature to classify correctly: `test-falcor / Test (Falcor)`
failing at the *trigger* step with `run-external-ci: trigger failed: HTTP 403
Forbidden` (fails fast) is a genuinely intermittent bridge-auth issue — safe to
rerun, recurring 30+ times in a 7-day window, suggesting a standing Falcor-bridge
credential problem a maintainer should fix at the source; this differs from
`test-falcor` failing *after* the full ~47-49 min external GitLab pipeline, which
is a legitimate external result, not infra
([gh run rerun fails on wedged falcor gate](../learnings/1788545503656-gh-run-rerun-fails-on-wedged-falcor-build-approval.md)).

## Dispatch routing: wired coworkers and the two-session detector

Two reports on the same slang triage→fix chain surface a race and its safety net.
When a triager is WIRED peer-to-peer to the fixer, it auto-dispatches the fix
handoff the instant it finishes triage — so if the orchestrator ALSO dispatches,
that's two dispatches to the same coworker for one task
([wired triager→fixer double-dispatch](../learnings/1788903865197-wired-triager-fixer-don-t-double-dispatch-claim-th.md)).
On slang#12964 it didn't blow up because both dispatches carried the same canonical
`thread_id` (`gh-issue-shader-slang/slang-12964`), so per-thread routing folded
them into ONE fixer session — the classic thread-less phantom-session failure did
NOT occur. The subtler residual: that one session then had TWO upstream edges
(orchestrator + triager), so its `[Fix Report]` could route to whichever parent it
replied to last. The fix is to resolve the EDGE, not the session: the orchestrator
that owns the webhook chain + `report_pr_created` PR mapping is the single parent;
the triager sends one disowning line ("parent owns this chain — report to parent;
disregard my dispatch as the routing edge; memo stands as reference") and steps
out. Don't re-dispatch or retract
([wired triager→fixer double-dispatch](../learnings/1788903865197-wired-triager-fixer-don-t-double-dispatch-claim-th.md)).

The companion report sharpens the trigger: a triager memo sent UP to the
orchestrator is FYI/oversight material, NOT a "relay this to the fixer for me"
request — the triager→fixer handoff is already happening peer-to-peer. On
slang#12971 the orchestrator misread the memo as a relay request and re-dispatched
via `send_file`, duplicating the completed handoff. **Before ANY dispatch to a
peer another coworker said it's handling, run the detector FIRST:**
`ncl sessions list --limit 3000 | grep <recipient-group-id> | grep <thread>` — two
`running` sessions for one task means thread_ids diverged (a true duplicate); one
session with two upstream edges is a routing-ambiguity, not a duplicate. If you've
already double-dispatched, send a stand-down phrased to be SAFE in BOTH outcomes
("continue the work you're doing" for the real session; "if a SEPARATE session
spun up, treat as no-op and don't open a second PR") — never a bare "stop"
([triager memo is FYI; two-session detector](../learnings/1788910357132-triager-memo-sent-up-to-the-orchestrator-is-fyi-no.md)).

## Script-gated deferral tasks: fail toward WAKE, not silence

When arming a `schedule_task --script` gate that keys off an external API ("wake
me when PR #N merges"), the `wakeAgent` decision must treat a **failed probe**
differently from a **negative result** — the naive form fails toward silence,
staying quiet forever while looking healthy
([script-gated deferral tasks](../learnings/1788432587694-script-gated-deferral-tasks-must-distinguish-condi.md)).
The concrete bug: keying on `.state` (a derived string) let a `gh api` 404 body
(`{"message":"Not Found"}`) flow into `$state`, which read as "still-open" and
stayed silent — indistinguishable from a genuinely open PR, and identical to what
an expired token would produce. The rules: (1) branch on the authoritative field
(`.merged` boolean), not a derived string; (2) make "probe failed" its own arm
that WAKES with a note ("gh api didn't return a boolean; token may be expired");
(3) enumerate every terminal outcome (merged→wake, closed-unmerged→wake,
api-error→wake, still-open→silent); (4) **verify with a deliberately-failing
control before arming** — run against the live target, a known-satisfied target,
AND a bogus/unreachable target; if the bogus one doesn't wake, the gate fails
toward silence. This is the task-gate analogue of the Monitor "silence is not
success" rule ([script-gated deferral tasks](../learnings/1788432587694-script-gated-deferral-tasks-must-distinguish-condi.md)).

## Verify before you claim: stale toolchains and false premises

A cluster of reports share one meta-lesson: **a premise, claim, or "separate
finding" is worthless until reproduced/verified on the exact target — stale
checkouts, false invariants, and unverified code paths propagate phantom bugs.**

Stale-toolchain phantoms are the most expensive. On slangpy#1136 a reported
"separate pre-existing CPU array-marshalling segfault" turned out to be a
stale-toolchain ghost: the local checkout was 68 commits behind, pinning slang
2026.4.1, where the crash reproduced; after rebasing to 2026.12.2 the crash was
gone but the "separate finding" was never re-checked on the PR-head toolchain
([verify separate findings on same toolchain](../learnings/1788483703122-verify-separate-findings-on-the-same-toolchain-as-.md)).
Rules: reproduce any separate finding on the SAME commit + submodule/toolchain as
the PR head; don't over-attribute a crash site to a layer (a SIGSEGV *at* a test
within a full-suite run isn't proof of isolated marshalling); and
`git show <rhi-commit>:CMakeLists.txt | grep SLANG_RHI_FETCH_SLANG_VERSION` tells
you exactly which slang a given slang-rhi pin resolves to. The sibling report
(slangpy#1138) shows the ~3h cost when this isn't caught: an auto-filed P2 bug ran
a full triage→fix→review chain before bisection showed it was already fixed
upstream. For the FILING coworker: reproduce on a current toolchain and pin the
exact slang + slang-rhi versions before filing; if it doesn't reproduce on
current, file a bisection note, not a live-bug report. For the TRIAGER: a crash
"not reproducible at HEAD in any build config" → **bisect the toolchain version
FIRST** — the slang source is shared across build configs, so a genuine codegen
null-deref would crash *every* config; if only one environment crashes, suspect a
stale toolchain, not codegen
([auto-filed bug reports must confirm reproduction](../learnings/1788492271185-auto-filed-bug-reports-must-confirm-reproduction-o.md)).

The same discipline applies to compiler facts and claims caught by codex or peer
review:

- **A review comment can be exactly backward.** An initial comment claimed
  `as<T>` was "structural, not canonicalizing" — the peer reviewer and codex both
  flagged it backward. In fact `as<T>(Type* obj)` is
  `dynamicCast<T>(obj->getCanonicalType())` (slang-ast-base.h:615-619): it
  canonicalizes (so `as<AndType>(t)` matches a `typealias` resolving to a
  conjunction — an explicit `getCanonicalType()` first is redundant) and is
  null-safe (no separate guard). Prefer `if (auto x = as<Foo>(type))`. Note
  `as<T>` on a general `NodeBase*`/IR inst is the plain non-canonicalizing cast
  ([as<T>(Type*) canonicalizes and is null-safe](../learnings/1788311284196-as-lt-t-gt-type-casts-the-canonical-type-and-is-nu.md)).
- **A "coverage" test that survives the revert-drill is worthless.** When a
  predicate threads a preservation flag down a recursion, a regression test only
  pins the THREADED parameter if the trigger is reachable ONLY through the thread.
  On slang#12875 the reject fired on `enclosingPreserved || isTypePreservedBy...`,
  so tests where the empty was a direct field, or itself decorated, tripped the
  LOCAL branch and passed even with the parameter deleted. Nest the trigger one
  level deeper inside an UNDECORATED sub-struct so the reject can only fire via the
  threaded flag, and always run the revert-drill (delete the param, confirm the new
  test FAILS). The same PR taught: when a helper claims to MIRROR an upstream
  decision function, mirror its ORDER, not just its set (codex CODE_REVIEW caught a
  Metal short-circuit placed before the intrinsic/work-graph check)
  ([threaded preservation-flag test / revert-drill](../learnings/1788428197044-testing-a-threaded-propagated-preservation-flag-ne.md)).
- **Verify which code path actually fires before recommending a fix.** A prior
  learning said `disableIRValidationScope()` could guard a `-validate-ir-detailed`
  post-pass SIGABRT — verified false in-code. At-insert validation
  (`validateIRInstOperands`, gated by `_enableIRValidationAtInsert`, which
  `IRValidationScope`/`disableIRValidationScope()` toggles) and post-pass module
  validation (`validateIRModule` from `postPassHooks`, emitting E40007) are
  distinct and independently gated; the scope is already restored by the time the
  pass-boundary validation runs, so it does NOT suppress an E40007 abort. The
  correct fix is at the producer (fix the insert point) — on #12914, a real
  insert-ordering bug in `DifferentialPairTypeBuilder::_createDiffPairType`
  ([correction: disableIRValidationScope does NOT gate post-pass](../learnings/1788583742043-correction-disableirvalidationscope-does-not-gate-.md)).
- **Don't build a fix on an unverified size assumption.** For a slangi VM printf
  width bug, the triage premise "Print operand `.size` == IR scalar width" was
  FALSE: `FieldExtract` and constant-index `GetElement` copy the *containing*
  value's operand and only shift the offset, so a 4-byte `float` field of a
  `DifferentialPair<float>` has `size == 8`. A "8 bytes ⇒ read a double" heuristic
  misreads a padded/aliased float. The principled fix is producer-side: at
  `kIROp_Printf` emission, pin a float/double arg operand's `.size` to its own
  natural size and thread that width to the formatter. Verify operand widths
  empirically, not from a size assumption
  ([slangi VM operand .size is aggregate size](../learnings/1788900537665-slangi-vm-operand-size-is-an-aggregate-storage-siz.md)).
  The follow-up PR #12967 shows the trap in the fix itself: a `half` projected from
  an 8-byte aggregate inherits `size==8` and, left UNPINNED, flows to the formatter
  which then over-reads as `double` — WORSE than pre-fix. A code comment claiming
  "half is unpinned so printf reads it as a 4-byte float as before" is a FALSE
  universal invariant; three reviewers (correctness + Devin + clarity) passed it,
  and an independent codex DECISION_REVIEW caught it — always run the critique-gate
  codex pass before emitting a `[Resolution]`/verdict close-out, and audit each
  unpinned type against `size==8`
  ([printf width-from-operand-size: unpinned half misread as double](../learnings/1788904081233-printf-width-from-operand-size-fixes-an-unpinned-f.md)).
- **Verify a skill's VERSION before citing its mechanism.** A retracted okf-synth
  atom had claimed a persistent ESCALATE on a load-bearing operational file is
  fixed by an `okf_synth: exempt` frontmatter flag — that mechanism does NOT exist
  in the canonical/deployed `okf_synth.py` (verified by md5 + `git log -S'_is_exempt'`
  showing it was never committed); it lives only in a divergent, unmerged runtime
  copy on some groups. The actual truth: there is no self-declared or prose-table
  exemption; a genuinely load-bearing top offender is a KNOWN, harmless
  DOSSIER-heuristic false positive handled by **manual filtering**, never by editing
  the tool (Step 0 rewrites it each run) or deleting the file (that destroys real
  data). Meta-lessons that hold: "I read the shipped skill" is worthless if your
  runtime copy is divergent — cross-check `md5sum` + `git log -S` against
  `/app/skills/` and the source clone; grep beats a confident assertion; the root
  cause is skill-copy drift, flagged to the operator to reconcile once
  ([okf-synth exempt mechanism retracted; skill-copy drift](../learnings/1788842883204-okf-synth-escalate-on-a-load-bearing-top-offender-.md)).

**Source learnings (17):**

- [`gh auth status` says "GH_TOKEN invalid" — red herring for the app installation token](../learnings/1788374386518-gh-auth-status-says-gh-token-invalid-red-herring-f.md) — App tokens can't hit `/user`; repo-scoped reads/writes still work — test the actual call before escalating.
- [gh auth status falsely reports nv-slang-bot token invalid; gh api still works](../learnings/1788881883720-gh-auth-status-falsely-reports-nv-slang-bot-token-.md) — Use `gh api` (REST) for everything; GraphQL-backed `gh` subcommands break; never `env -u GH_TOKEN`.
- [Slang PR review: gh/api blocked by OneCLI but git-fetch + slang-mcp work — use --mode patch](../learnings/1788913121098-slang-pr-review-gh-api-blocked-by-onecli-but-git-f.md) — OneCLI `ROUT…` token + disconnected GitHub kills REST; `git fetch` and slang-mcp tools have independent auth.
- [gh run rerun fails on wedged falcor-build-approval-gate](../learnings/1788545503656-gh-run-rerun-fails-on-wedged-falcor-build-approval.md) — A `waiting` gate keeps the run non-terminal; check jobs before rerun; trigger-step 403 is a distinct rerunnable bridge-auth flake.
- [falcor-build-approval-gate 'waiting' blocks ALL reruns in that run](../learnings/1788631867865-falcor-build-approval-gate-waiting-blocks-all-reru.md) — Job-scoped rerun API also 403s; blast radius is the whole run, not just Falcor jobs.
- [falcor-build-approval-gate wedge blocks rerun of unrelated sibling jobs](../learnings/1788675398136-falcor-build-approval-gate-wedge-blocks-rerun-of-u.md) — An unrelated GPU flake becomes un-rerunnable; grep `jobs[] | select(.status!="completed")` before concluding the API is broken.
- [Script-gated deferral tasks must distinguish "condition not met" from "probe failed"](../learnings/1788432587694-script-gated-deferral-tasks-must-distinguish-condi.md) — Branch on the authoritative field; make probe-failure its own WAKE arm; verify with a deliberately-failing control before arming.
- [Wired triager→fixer: don't double-dispatch; claim the edge on the canonical thread](../learnings/1788903865197-wired-triager-fixer-don-t-double-dispatch-claim-th.md) — Same `thread_id` folds a race into one session; resolve the EDGE (single parent), not the session.
- [Triager memo sent UP is FYI, not a relay request — run the two-session detector](../learnings/1788910357132-triager-memo-sent-up-to-the-orchestrator-is-fyi-no.md) — `ncl sessions list | grep <group> | grep <thread>` before dispatching; safe-in-both-outcomes stand-down, never a bare "stop".
- [Verify "separate findings" on the SAME toolchain as the PR head](../learnings/1788483703122-verify-separate-findings-on-the-same-toolchain-as-.md) — A behind-by-N checkout pins an old slang with already-fixed bugs; `SLANG_RHI_FETCH_SLANG_VERSION` resolves the pin.
- [Auto-filed bug reports must confirm reproduction on a current toolchain](../learnings/1788492271185-auto-filed-bug-reports-must-confirm-reproduction-o.md) — Pin exact slang+slang-rhi versions; a crash in only one config → bisect toolchain first (shared source would crash every config).
- [as<T>(Type*) casts the CANONICAL type and is null-safe](../learnings/1788311284196-as-lt-t-gt-type-casts-the-canonical-type-and-is-nu.md) — `as<T>` on `Type*` canonicalizes + is null-safe; an initial "structural not canonicalizing" claim was backward, flagged by peer + codex.
- [Testing a threaded preservation flag: nest the trigger inside an UNDECORATED sub-struct](../learnings/1788428197044-testing-a-threaded-propagated-preservation-flag-ne.md) — A test that survives the revert-drill is worthless; mirror a decision function's ORDER, not just its set.
- [CORRECTION: disableIRValidationScope does NOT gate the post-pass validateIRModule (E40007)](../learnings/1788583742043-correction-disableirvalidationscope-does-not-gate-.md) — At-insert vs post-pass validation are independently gated; fix the producer insert point, not a validation scope.
- [slangi VM operand .size is an aggregate/storage size, not the scalar width](../learnings/1788900537665-slangi-vm-operand-size-is-an-aggregate-storage-siz.md) — Extracted sub-objects keep the container's `.size`; a size-based double/float heuristic misreads; pin width producer-side.
- [printf width-from-operand-size: an UNPINNED half can be misread as double](../learnings/1788904081233-printf-width-from-operand-size-fixes-an-unpinned-f.md) — A width-from-size rule interacts with EVERY unpinned type via the aliased operand; run codex before a `[Resolution]` close-out.
- [okf-synth has NO `okf_synth: exempt`; a load-bearing top offender is a known false positive](../learnings/1788842883204-okf-synth-escalate-on-a-load-bearing-top-offender-.md) — Verify a skill's version (md5 + `git log -S`) before citing its mechanism; runtime copies drift from canonical.

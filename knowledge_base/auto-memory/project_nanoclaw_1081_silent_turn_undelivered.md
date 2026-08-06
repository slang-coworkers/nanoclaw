---
name: project_nanoclaw_1081_silent_turn_undelivered
description: "slang-coworkers/nanoclaw#1081 — poll-loop 'deliveredNothing' guard is UNREACHABLE for the text:null bug it documents, and its 'undelivered' status has NO consumer; the 2nd commit (codex rotation) is the real fix"
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1081
---

**slang-coworkers/nanoclaw#1081** — `fix(poll-loop): a turn that delivers nothing is undelivered, not completed`, author **szihs**, base `nv-main`. **ROUTING: inline by Main, 6th instance of the rule** — webhook task string said "route to a `*-pr-approver`"; that string targets PRODUCT (slang/slangpy) PRs. See [[project_nanoclaw_pr874_webhook_route_approver]].

**Two webhooks in one session:** `opened` @ `47a97619` (+13/−1, 1 file), then `synchronize` @ **`d41b94c9`** (+131/−1, 2 files) — a genuinely NEW commit (`fix(codex): rotate stale threads`), so re-verified both findings on the new head rather than reporting from the old one. Reviewed OPEN (no merge race — first non-race after 6 consecutive).

## 🔴 1. The guard cannot fire for the bug it documents

`deliveredNothing = sent === 0 && !event.text?.trim() && !routing.taskRun` sits **inside `} else if (event.text) {`** (`poll-loop.ts:918`). The documented payload is `last_agent_message: null` ⇒ `codex.ts:465` yields `text: resultText || null` = **`null`**, which is falsy ⇒ branch skipped, control lands in the trailing `else` at :994. Guard never evaluated.

Measured (real `processQuery`, codex provider, @`d41b94c9`):

| `event.text` | exchange | guard ran |
|---|---|---|
| `null` ← the documented payload | *(none)* | ❌ |
| `''` | *(none)* | ❌ |
| `'  \n '` | `undelivered` | ✅ |
| `'OK host-x'` (control) | `completed` | n/a |

⇒ it catches ONLY whitespace-but-non-empty — the one shape Codex doesn't produce. ⭐⭐⭐**`!event.text?.trim()` READS as null-safe and that is exactly what hides it — the optional chain advertises handling a case the ENCLOSING BRANCH already excluded.** A null-guard written inside a truthiness branch is dead by construction.

## 🔴 2. `undelivered` has no consumer — trigger still ack'd `completed`

Two independent reasons, both measured:
- **(a)** status → `notifyExchangeComplete` → `provider.onExchangeComplete`, an ARCHIVING hook from `3d2f3e58` ("Dormant for the default provider"). **Enumerated at the REGISTRATION SITE** (`grep registerProvider`): all 4 registered providers (`claude`/`codex`/`opencode`/`mock`) implement it **0 times**; only 2 test fakes do. No hook ⇒ `if (!hook) return;` ⇒ status computed and discarded.
- **(b)** Redrive keys on **`processing_ack`** = `bounced-transient|bounced-unknown` (see `messages-in.ts` `markBounced` docstring: `syncProcessingAcks` ignores those so the row stays PENDING for `redriveBouncedA2a`). This path writes neither, and `markCompleted(initialBatchIds)` still runs unconditionally at the branch bottom.

Measured even where the guard DOES fire: `text:'  \n '` → exchange `undelivered`, **`processing_ack = completed`** ⇒ trigger consumed, no re-arm. Real fix needs `markBounced`, like the a2a-bounce path above it does deliberately.

## ✅ What holds

- **The 2nd commit is the real fix and it works.** `maybeRotateContinuation` on the motivating fixture (`rollout-2026-05-27T15-20-51-<id>.jsonl`) → `"codex rollout 69.7d old > 14d cap"`, file renamed aside; fresh thread → `null` (control), unknown → `null`, oversize → rotates on bytes. Matches `claude.ts` semantics (filename-derived age, rename-not-delete, `>0 ? : Infinity` disable knob). Wired at `poll-loop.ts:308` before resume.
- **No regressions — baseline measured, not assumed:** full suite byte-identical to base `a5e5b487`, **275 pass / 1 skip / 12 fail / 9 errors** on BOTH. The 12 (`critique-gate text-output integration`) are pre-existing.
- 🟡 No test on either commit (a single `text: null` case would have failed instantly and exposed #1); Claude's equivalent ships `claude.rotate.test.ts` with 4 cases. 🟡 Scope note calls continuation-staleness "separate" but commit 2 fixes it in-PR.

⚠️**A typecheck error I saw (`Cannot find type definition file for 'bun'`) was MY symlinked `node_modules`, not a PR defect — not published.** Same class as the #1078 lesson: a finding contradicting the PR's own working state is probably about my environment.

Comment `5189917785`.

## 3rd webhook @ `e5ee5d6e` — 🔴🔴 BLOCK: the branch DOES NOT COMPILE

Title changed (`fix(codex): silent turns — …`), no reply comment. `d41b94c9` (rotation) was **REVERTED** by `e167c9d5`, replaced by `e5ee5d6e` (idle cap in runner-owned code). Cumulative diff shrank to +50/−2, 2 files.

**`poll-loop.ts:322` calls `continuationMaxIdleMs()`, which is DEFINED NOWHERE** (census: 1 reference, 0 definitions; `CONTINUATION_MAX_IDLE_DAYS` from the commit message also absent). `bun run typecheck` → **`TS2304: Cannot find name 'continuationMaxIdleMs'`**. The helper was evidently lost in the revert; the call site survived. **CI already red (`ci: FAILURE`) and correct.**

⭐⭐⭐**BLAST RADIUS WIDER THAN THE FEATURE: the call is UNCONDITIONAL, before the `ageMs > maxIdleMs` compare ⇒ it throws for ANY stored continuation, fresh or stale.** Measured on real `runPollLoop`: fresh → `ReferenceError`, 51d-idle → `ReferenceError`. Branch is `!rotateReason && !maybeRotateContinuation` ⇒ affects **`codex`/`opencode`/`mock`**; `claude` short-circuits safely. ⭐⭐⭐**I WROTE THE FRESH CASE AS A CONTROL EXPECTING IT TO PASS — ITS FAILURE IS THE FINDING.** A control that fails unexpectedly is worth more than the probe it was guarding.

**Regressions (clean `bun install --frozen-lockfile` BOTH trees): base `a5e5b487` = 342 pass/3 fail; head `e5ee5d6e` = 340 pass/5 fail** ⇒ 2 introduced (`clears continuation when provider reports session invalid`, `/clear command …`), both the ReferenceError. The 3 critique-gate are pre-existing.

**✅ The revert rationale is RIGHT and beat my own review — two things I missed at `d41b94c9`:** (1) **DURABILITY** — `codex.ts` is **skill-installed payload** (`add-codex/SKILL.md`: "overwrite each file, never merge") ⇒ the next `/add-codex` silently reverts any fix there. I tested that rotation WORKED and never asked whether it would **SURVIVE**. (2) **It measured the wrong thing** — Codex resumes an opaque `threadId` server-side; only `clearContinuation` gates resume, so renaming the local rollout governed NOTHING. ⭐⭐⭐**My "✅ rotation works" was correct about the OBSERVABLE (file moved, reason string returned) and wrong about the EFFECT — a passing probe on a mechanism that governs nothing.** Idle-over-age in runner-owned code is the stronger design; `getContinuationAgeMs` verified correct (0ms fresh / 51.0d backdated / null unset).

**Both prior 🔴 UNCHANGED (byte-identical in the diff).** New commit asserts *"Exchanges are already archived per turn via onExchangeComplete"* — **FALSE on this fork** (0 of 4 providers implement it ⇒ `if (!hook) return`), so "dropping a continuation loses no history" doesn't hold for a server-side provider.

⚠️⚠️**TWO OF MY OWN ERRORS THIS ROUND, both caught by re-measuring:**
1. **I published `275 pass/12 fail/9 errors` from a tree where I had SYMLINKED `node_modules`** — `@types/bun` missing, distorting BOTH counts (real: 342/3 and 340/5). The *conclusion* (no regressions at `d41b94c9`) held, but the FIGURES were wrong and public. ⭐⭐⭐**I had already noticed the symlink caused a typecheck error and correctly withheld THAT — then published test counts from the same poisoned tree. Quarantine the TREE, not the one symptom you noticed.**
2. **I briefly concluded "already merged onto `nv-main`" from a stale `FETCH_HEAD`** — `git merge-base` against `FETCH_HEAD` compared the PR branch to ITSELF (base==head), which I read as containment. Re-checked against explicit `origin/nv-main`: **all 3 commits are branch-only, `nv-main` is CLEAN at `a5e5b487`.** ⭐⭐⭐**`FETCH_HEAD` is whatever you fetched LAST — never use it as a stand-in for a branch; name `origin/<branch>` explicitly.** Nearly published a false "live regression on nv-main" alarm.

Comment `5190482627`. Verdict was BLOCK (compile break); unmerged, CI red — a real pre-merge gate.

## 4th webhook @ `7ae6477d` — ✅ BLOCKER CLEARED (verified, not trusted)

`fix(poll-loop): define continuationMaxIdleMs (fixes TS2304)`, +12 lines, the helper restored in runner-owned code. **CI green — but verified independently, since a passing gate is a claim.** `bun run typecheck` exit 0 on a **clean `bun install --frozen-lockfile`** (`@types/bun` present — instrument checked first this time, per [[feedback_quarantine_the_tree_not_the_one_symptom]]).

**Suite: base `a5e5b487` 342/3 · `e5ee5d6e` 340/5 · head `7ae6477d` 342/3** ⇒ exactly back to baseline; both regressions (`clears continuation when provider reports session invalid`, `/clear command`) pass again. The 3 critique-gate remain pre-existing.

**The control that FAILED last round now passes** — the check that mattered most. Measured on real `runPollLoop`:

| scenario | throw? | continuation |
|---|---|---|
| fresh | no | `thr-fresh` **kept** |
| 51d idle (the incident) | no | **dropped** (`idle 51.0d > 14d cap`) |
| 13d / 15d boundary | no | 13d kept · 15d dropped |
| `CONTINUATION_MAX_IDLE_DAYS=0` | no | **kept** (disable works) |
| provider WITH own hook, 51d idle | no | **kept** (no double-rotation) |

Cap lands where documented (14d), non-positive-disables matches the Claude knob, `!maybeRotateContinuation` correctly defers to file-based providers.

**🔴 Both original findings UNCHANGED across all 5 commits** (byte-identical; re-measured at this head: `text:null` → no exchange; `'  \n '` → `undelivered` but `processing_ack=completed`). ⇒ **the PR fixes the CAUSE (rotation would have prevented 2026-07-17) but the DETECTION half named in its own title is still inert.** Also still true: the `onExchangeComplete` archiving premise is false on this fork (0/4 providers), so "dropping a continuation loses no history" is wrong now that the cap actually drops threads.

🟡**Still ZERO tests across 5 commits** — `CONTINUATION_MAX_IDLE_DAYS` appears exactly once (its own `process.env` read). ⭐⭐**Third consecutive review where the missing test is the SAME missing test** — it is what would have caught the `TS2304` pre-CI *and* the `text:null` gap. `claude.rotate.test.ts` is the ready template. Offered to contribute my probes as a real `poll-loop.rotate.test.ts`.

Comment `5190558156`. **Verdict: blocker cleared, rotation half sound and landable; 2 standing 🔴 follow up.** `nv-main` re-checked against **explicit `origin/nv-main`**: still `a5e5b487`, all 5 commits branch-only, nothing live.

⭐⭐⭐**Chain lesson: 4 webhooks, 4 distinct heads, and the PR CHANGED SHAPE TWICE mid-review (a commit I validated was reverted; a compile break appeared and was fixed). Never carry a verdict forward across a `synchronize` — re-fetch, re-diff, re-measure. My d41b94c9 "✅ rotation works" became obsolete within one push.**

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]], [[feedback_control_the_instrument_not_the_reasoning]], [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]], [[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]].

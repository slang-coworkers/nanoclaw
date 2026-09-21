---
name: project_12362_nonmatching_handlers_escaping_throw_hang
description: "slang#12362 — do-catch whose handlers DON'T match the thrown type (so the throw escapes a `throws` fn) hangs slangc. RESOLVED/root-caused: one-char typo in findErrorHandler (slang-lower-to-ir.cpp:833-834) re-reads list HEAD not handler->prev. NOT a dup of #12343 (measured 2×2). Corrected model exposes an unreported clause-3-of-3 bug. Not a regression (v2025.10+, 87 tags)."
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12362
---

# slang#12362 — non-matching catch handlers + escaping `throw` → compiler HANG

Author **skiminki-nv** (MEMBER/maintainer, self-filed), 2026-08-05. Repro (`slangc -target hlsl -entry computeMain -stage compute`): `void throwingFunction() throws ErrorCode` with `do { throw ErrorCode.SomeError; } catch (int ex) {} catch (uint ex) {}` — **neither handler matches `ErrorCode`**, so the exception must propagate out of the do-catch and out of the `throws` function. Hang: no output, no diagnostic. `try g();` (call to a `throws` fn) in place of the direct `throw` hangs too. ⭐ Reporter's request: keep a real call to `throwingFunction()` in the regression test so a future compiler can't prune the unused function early — honor it, it is reviewer-proofing, not decoration.

## ✅ RESOLVED — root cause is a one-character typo in AST→IR lowering (not an IR pass)

`findErrorHandler`, `source/slang/slang-lower-to-ir.cpp:833-834`:
```cpp
for (auto handler = context->catchHandler; handler != nullptr;
     handler = context->catchHandler->prev)   // ← re-reads the HEAD, not handler->prev
```
The advance re-reads the list head's `prev` every iteration ⇒ from step 2 on, `handler` is pinned to a constant and never reaches `nullptr` (203/203 SIGPROF samples on `:833/:834/:836`). The checker's twin walk `findMatchingCatchStmt` (`slang-check-stmt.cpp:47`) advances correctly with `outerStmtInfo->next` — same algorithm, one letter apart. Lowering is the right layer: the checker never stores the selected `CatchStmt` on `ThrowStmt`, so lowering must re-derive (codex-confirmed). Tree-wide sweep for the defect class returns **exactly one** instance (re-swept with a second, differently-shaped regex — control fired).

**Not a regression.** Line entered in `57c3f9382` (#6916 "Implement throw & catch statements", 2025-05-23), first shipped **v2025.10** (`git tag --contains` = 87, `v2025.9` control returns 0). ⇒ the v2025.10+ range is affected — belongs in the GitHub comment so the maintainer sizes it.

**Reporter's discriminator is WRONG, and the corrected model exposes an unreported bug.** Not "≥2 handlers that don't catch" — the loop only ever examines **two** handlers, so it is *"≥2 clauses AND neither of the FIRST TWO matches."* ⛔ **match in clause 3 of 3 → HANGS** ⇒ the third catch clause is unreachable **even when it is the correct handler** — a distinct user-visible bug the issue never mentions. Whoever writes the fix must cover this cell.

**Not a dup of #12343** — triager ran the 2×2 in an isolated worktree: #12362 hangs on both pristine `19d1d4065` AND with #12348 (`72b528b42`) applied, while the **positive control** (#12343's own repro) hangs pristine and compiles with #12348. Measured separate producer. ⛔ Do not let #12348's merge close this.

## Verdict + validation

Verdict posted 08-05 (comment `5189699880`, `nv-slang-bot[bot]`, root cause `slang-lower-to-ir.cpp:833`, clause-3-of-3 + v2025.10/87-tags bisect all present, MINE-verified live). Final test runs under `slang-test` **2/2 passing**, FileCheck asserting `caught-by-third` → `propagated-out` + `CHECK-NOT: wrong-handler`. Convention: all 13 in-tree error-handling tests use `catch(err: T)` (C-style `catch (int ex)` parses but appears 0 times) — use the in-tree spelling; `INTERPRET` requires `main`, so carry `main()` + `computeMain` both calling a shared `run()`. **No assert added** — `visitCatchStmt` push/pop is balanced and nodes are stack-allocated in the recursion, so there is no malformed state to detect; any assert would be a tautology ("the cursor advanced"), dead the moment the line is correct.

## RESUME

skiminki-nv authors his own fixes (framing is the deliverable). RESUME = **(a)** confirm the 5-bullet is POSTED ON THE ISSUE (GitHub is primary observability); **(b)** when he opens his PR, check it fixes the **clause-3-of-3** cell too, not just the reported 2-handler case, and that the regression test keeps a real call to `throwingFunction()` per his pruning note; or **(c)** a fresh substantive human comment.

## Durable lessons

- ⭐⭐⭐ **"Reproduce the reported case" is a floor, not a finish** — a corrected mechanism model predicts cells the reporter never tried (here, clause-3-of-3).
- ⭐⭐⭐ **A null result without a positive control is indistinguishable from a build that never applied the patch.** The "#12348 still hangs #12362" null is only meaningful because the same binary *does* fix #12343.
- ⭐⭐⭐ **In a cluster of same-author / same-subsystem / same-week defects, ALL surface similarity (trigger, mode, timing, adjacent numbers) is worth ZERO for dedup** — only a differential experiment or a root-cause trace decides. A failure mode ("hang, no diagnostic") is just as downstream as a trigger surface. But **don't over-retract**: it is strictly weaker for DEDUP yet still useful for PRIORITIZATION (cheap to mis-triage as a flake, expensive for a user) — name the job a signal IS good for rather than discarding it.
- ⭐⭐ **A wrong hypothesis that names its own falsifier costs one experiment; one asserted as a finding costs a wrong close.** Ship dup hypotheses labelled HYPOTHESIS-TO-TEST with the 2×2 pre-specified.
- ⭐⭐ **A second method that could have failed differently is the only re-measurement worth doing.**
- ⭐⭐⭐ **"It compiles now" is not the claim worth making about an error-handling fix** — a wrong-handler dispatch also compiles; only the FileCheck asserts distinguish a catch from a mis-dispatch.
- ⭐⭐⭐ **`git cat-file -e <commit>:<path>` cannot distinguish "not in this tree" from "this commit isn't local"** — both exit non-zero. ALWAYS pair a path-absence probe with an object-existence control (`cat-file -t <commit>`) on the SAME commit; fetch the PR head first. ([[technique_source_pristine_binary_stale_guard_probe]])
- ⭐⭐⭐ **A refutation of someone else's specific numeric claim is the highest-risk output there is** — adversarial, looks rigorous, and an off-by-one in your matcher manufactures it. When comparing a prefix across two files of DIFFERENT length, anchor the window to the SHORTER file's actual length, never the boundary quoted in the claim (a peer's "lines 1-N" is 1-indexed prose about *their* file, not a `head -N` arg for yours). **Re-derive the matcher before publishing any mismatch.** A positive control proves you read the right file; it cannot detect a misaligned enumeration.
- ⭐⭐⭐ **For an already-transmitted artifact, the size is a property of the TRANSMISSION, not the file** — the two diverge the moment you keep editing. Take the figure from the send, or re-measure AND re-send — never re-measure and re-DESCRIBE.
- ⭐⭐⭐ **Quote no pass/fail count without naming the build state it was taken in** — a bare "2194/2194" is a fact-shaped fragment, not a fact (two build states = two experiments, not one sweep with a discrepancy). ⇒ **state artifact sizes on every send; the redundancy is the detector** ([[feedback_delivered_artifact_missing_index_row]]).
- ⭐⭐ **A concurrence backed by a mechanism is worth more than a concurrence; ask for the reason even when the answer agrees.**
- ⚠️ **Do not index any internal reviewer verdict as a GitHub review state** — `APPROVE_WITH_NITS` is a local pipeline verdict, not in GitHub's enum; #12348 has 0 GitHub reviews.
- ⏳ **When an unmerged PR is acting as your control, that control has an expiry date; spend it while it's cheap.** The two-state window (#12348 unmerged vs master) cleanly separated these chains; once #12348 merges, separating a 4th throw/catch report costs a revert build. Triager kept `wt-12362` with both columns pre-built + a `WHY-THIS-EXISTS.txt`; delete only when #12348 merges AND #12362 resolves (both conditions).

## Sibling chains (same author, subsystem, week)

- [[project_12343_catch_interface_exception_cfg_merge_hang]] — HANG, CFG block-merge inner-walk fixpoint (`slang-ir-simplify-cfg.cpp:961-976`). Fix in draft PR #12348. Closest sibling (same failure mode) but **measured separate producer**.
- [[project_12361_catchall_direct_throw_sccp_param_ice]] — ICE `sccp.cpp(1289): param`, catch-all over a direct throw. Measured NOT to share a producer with #12343.
- [[project_12330_entrypoint_throws_not_diagnosed]] — EP `throws` undiagnosed; may interact with #12362's expected behavior (an escaping unhandled throw may warrant a diagnostic — don't settle #12362's expected behavior in isolation). #12330 governs entry points, a different function class.
- [[project_12326_throw_statement_missing_semicolon]] — skiminki-nv opened his own PR ~1h after our verdict.

⭐ Three throw/catch defects in ~48h from one maintainer working through the feature suggests error-handling lowering is under-exercised generally — name it upward as a cluster (not a common-root-cause claim).

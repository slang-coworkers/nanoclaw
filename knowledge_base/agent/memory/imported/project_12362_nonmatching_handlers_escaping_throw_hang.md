---
name: project_12362_nonmatching_handlers_escaping_throw_hang
description: "slang#12362 — do-catch whose handlers DON'T match the thrown type (so the throw escapes a `throws` fn) hangs slangc. Third skiminki-nv throw/catch chain this week. Dispatched to triager with a two-state differential vs unmerged #12348; NOT asserted as a dup of #12343"
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12362
---

# slang#12362 — non-matching catch handlers + escaping `throw` → compiler HANG

Author **skiminki-nv** (MEMBER/maintainer, self-filed), 2026-08-05. `Dev Opened`, 0 human comments.
https://github.com/shader-slang/slang/issues/12362 · reporter SHA `19d1d4065bcdbe2c1e0817f9ead7c4d245758e5d`

**Repro** (`slangc -target hlsl -entry computeMain -stage compute test.slang`):
`void throwingFunction() throws ErrorCode` containing `do { throw ErrorCode.SomeError; }
catch (int ex) {} catch (uint ex) {}` — **neither handler matches `ErrorCode`**, so the exception
must propagate *out* of the do-catch and out of the `throws` function. Hang: no output, no diagnostic.

**Reporter's own discriminator:** *"there must be at least 2 catch handlers that don't catch the
thrown exception."* He also notes `try g();` (a call to a `throws` fn) in place of the direct `throw`
hangs too, and that `computeMain`'s body is **not** required for the repro — but he prefers keeping a
real call to `throwingFunction()` in the regression test so a future compiler can't prune the
otherwise-unused function early. ⭐**Honor that request in the test; it is a reviewer-proofing note,
not decoration.**

He flags #12361 and #12343 as *possibly* related.

## What I verified myself (Main, routing-level only — NOT a triage)

- Clone `/workspace/agent/slang` **and** `origin/master` are both at exactly the reporter's SHA
  `19d1d4065` (2026-08-05 05:17Z) ⇒ no version-skew caveat for the triager.
- **No duplicate.** `repo:shader-slang/slang hang catch state:open` → 4 hits: this issue, #12343,
  #12348 (the #12343 fix PR), and #12197 (RayQuery, unrelated).
- **Coverage gap is real and NARROWER than "multi-catch is untested".** I enumerated all 13 files in
  `tests/language-feature/error-handling/`; 3 have ≥2 `catch` clauses (`basic.slang` 4,
  `catch-all.slang` 2, `generics.slang` 2). But in `basic.slang`'s two-handler `multiCatchFunc`,
  **every handler matches a thrown type and the function is not `throws`** — the exception never
  escapes. Same for `containedThrow()` (direct throw, one *matching* handler, no `throws` clause).
  ⇒ the uncovered shape is specifically **handlers present but NONE matching + exception escapes an
  enclosing `throws` function.** ⭐⭐**"multi-catch is tested" is true and irrelevant — the axis that
  matters is whether the throw ESCAPES the handlers, not how many handlers exist.**
- ⚠️ I did **not** build or run. Nothing here is a diagnosis.

## ✅ RESOLVED 08-05 08:45Z — ROOT-CAUSED. My dup hypothesis below was REFUTED BY MEASUREMENT (2nd time)

**Triager ran the 2×2 in an isolated worktree (`/workspace/agent/wt-12362`). NOT dup-by-cause.**

| | pristine `19d1d4065` | with #12348 (`72b528b42`) |
|---|---|---|
| #12362 direct-`throw` | hang (124) | **hang (124)** |
| #12362 `try g();` | hang (124) | **hang (124)** |
| control: `catch (ErrorCode)` matches | compile 370B | compile 370B |
| **positive control: #12343's own repro** | hang (124) | **compile (0)** |

⭐⭐⭐**That last row is what makes the null MEANINGFUL** — the same binary that still hangs on #12362
*does* fix #12343, proving #12348's walk was **live, not silently absent.** A null result without a
positive control is indistinguishable from a build that never applied the patch.

**ROOT CAUSE — a one-character typo in AST→IR lowering, not an IR pass.** `findErrorHandler`,
`source/slang/slang-lower-to-ir.cpp:833-834`:
```cpp
for (auto handler = context->catchHandler; handler != nullptr;
     handler = context->catchHandler->prev)   // ← re-reads the HEAD, not handler->prev
```
The advance re-reads the list head's `prev` every iteration ⇒ from step 2 on, `handler` is pinned to
a constant and never reaches `nullptr`. 203/203 SIGPROF samples land on `:833/:834/:836`.
**MINE-verified: I read both lines at `:833-834` — the typo is exactly as reported.**

**Reporter's discriminator is WRONG, and the corrected model exposes an unreported bug.** Not "≥2
handlers that don't catch" — the loop only ever examines **two** handlers, so it is *"≥2 clauses AND
neither of the FIRST TWO matches."* 9-cell matrix: 1 non-matching → compiles · 2 or 3 non-matching →
hang · match in clause 1 or 2 of 3 → compiles · ⛔**match in clause 3 of 3 → HANGS** ⇒ **the third
catch clause is unreachable even when it is the CORRECT handler.** That cell is a distinct
user-visible bug the issue never mentions. ⭐⭐**A corrected mechanism model predicts cells the
reporter never tried — which is exactly why "reproduce the reported case" is a floor, not a finish.**

**My #12330 coupling worry RESOLVED — no waiting needed.** `SemanticsStmtVisitor::visitThrowStmt`
(`slang-check-stmt.cpp:647`) diagnoses an uncaught throw **only** when the parent fn is non-`throws`.
Here it's `throws ErrorCode`, so propagation is the **sanctioned** path and both lowering call sites
implement it (`:8963-8970` emits `IRThrow`; `:913-920` synthesizes a re-throwing fail block).
⇒ "clean compile" is the **checker's** verdict, not merely the reporter's assertion. #12330 concerns
**entry points** — a different function class; it would govern `computeMain`, not `throwingFunction`.

**Not a regression.** Line entered in `57c3f9382` (#6916 "Implement throw & catch statements",
2025-05-23), first shipped **v2025.10**. ✅**MINE-verified with controls: must-hit → the line IS
present at `57c3f9382:774`; must-miss → parent has `catchHandler` count 0; `git tag --contains` = 87,
earliest `v2025.10` by version sort, and the `v2025.9` control correctly returns 0.**

**Layer question settled by a decisive contrast:** the checker's twin walk `findMatchingCatchStmt`
(`slang-check-stmt.cpp:47`) advances correctly with `outerStmtInfo->next` — same algorithm, one
letter apart. ✅**MINE-verified by reading it.** Tree-wide sweep for the defect class returns
**exactly one instance**; ✅**I re-swept independently with a DIFFERENT regex shape (two-arrow advance
not rooted at the loop var, plus a multiline-continuation variant) across `source/slang`,
`source/compiler-core`, `source/core` — also exactly one, with the control firing.** ⭐⭐**A
second method that could have failed differently is the only re-measurement worth doing.**

codex independently confirmed chain order/reachability, no other termination path, one-liner
sufficiency (`int` vs `ErrorCode` are distinct canonical IR types), and that lowering is the right
layer (the checker never stores the selected `CatchStmt` on `ThrowStmt`, so lowering must re-derive).

### ⛔⭐⭐⭐ MY ERROR, TWICE — escalating confidence on an OBSERVABLE is not progress

On #12361 I hypothesized a shared producer from a shared **trigger surface** — refuted by
measurement. Here I upgraded to a shared **failure MODE** (hang, flat RSS, no diagnostic) and treated
that as a *stronger* signal, writing "it matters more here." **Also refuted.** ⇒ ⭐⭐⭐**A failure mode
is just as downstream as a trigger surface: "hang" only says SOME loop doesn't terminate, and a
compiler has thousands. I mistook moving along a chain of observables for moving toward a cause.**
⇒ **In a cluster of same-author / same-subsystem / same-week defects, ALL surface similarity
(trigger, mode, timing, adjacent issue numbers) is worth ZERO for dup determination — only a
differential experiment or a root-cause trace decides.** Now **2 independent instances**, so this is
no longer a single-case rule. ✅**What I did right both times: shipped it explicitly labelled
HYPOTHESIS-TO-TEST with the 2×2 pre-specified, and told the triager not to record dup-by-cause
without it. A wrong hypothesis that names its own falsifier costs one experiment; one asserted as a
finding costs a wrong close.**

## ⏳ (SUPERSEDED — kept for the reasoning trail) TIME-LIMITED EXPERIMENT

**PR #12348** (`fix/issue-12343`, head `72b528b42d`) is **still open, still draft,
`mergeable_state: behind`, `merged: false`** — while master == the reporter's SHA. This is the *same*
lucky two-state window that cleanly separated #12343 from #12361 (see
[[project_12343_catch_interface_exception_cfg_merge_hang]]), and it is **open again**.

It matters more here than it did for #12361 because **#12362 and #12343 share a failure MODE (hang,
flat RSS, no diagnostic), not just a trigger surface** — and #12343's root cause is an infinite
*inner* block-merge walk in `slang-ir-simplify-cfg.cpp:961-976`. A do-catch whose handlers don't
match plausibly reaches a similar merge shape.

⛔**This is a HYPOTHESIS TO TEST, not a finding.** The #12343 memo's hardest-won lesson applies
directly: *a shared trigger surface is the most seductive false-dup signal — same author, same week,
same subsystem, adjacent numbers.* My last shared-producer hypothesis (#12343 ↔ #12361) was
**refuted by measurement**. Run the 2×2, don't argue it:

| | pristine `19d1d4065` | with #12348 (`72b528b42`) |
|---|---|---|
| #12362 repro (direct `throw`) | expect hang | **← the load-bearing cell** |
| #12362 variant (`try g();`) | expect hang | ← reporter says this hangs too |

If the right-hand column compiles → dup-by-cause, #12362 closes on #12348 and needs only a
regression test added to that PR. If it still hangs → **separate producer, and #12348's Approach A
is incomplete** — which is worth knowing *before* #12348 merges, not after.

⭐⭐**The window closes when #12348 merges.** After that, reproducing the pristine state costs a
checkout and a build.

## Routing

Dispatched to **slang-triager**, canonical thread `gh-issue-shader-slang/slang-12362`.
**No fixer dispatch** — skiminki-nv authors his own fixes (on
[[project_12326_throw_statement_missing_semicolon]] he opened PR #12328 adopting our recommendation
essentially verbatim ~1h after our verdict). ⇒ **the framing is the deliverable**; get the layer
right the first time.

⚠️**Do not index any internal reviewer verdict as a GitHub review state** — #12348 has **0** GitHub
reviews; the triager's earlier *"APPROVE_WITH_NITS"* on it was a local pipeline verdict.
`APPROVE_WITH_NITS` is not in GitHub's enum.

## Sibling chains (same author, same subsystem, same week — 3 now)

- [[project_12343_catch_interface_exception_cfg_merge_hang]] — **HANG**, CFG block-merge inner-walk
  fixpoint. Fix in draft PR #12348, unmerged. *Closest sibling: same failure mode.*
- [[project_12361_catchall_direct_throw_sccp_param_ice]] — **ICE** `sccp.cpp(1289): param`, catch-all
  over a direct `throw`. **Measured NOT to share a producer with #12343.**
- [[project_12330_entrypoint_throws_not_diagnosed]] — EP `throws` undiagnosed. Adjacent: #12362's
  handlers let the exception escape a `throws` function, so what the *correct* diagnostic behavior is
  may interact with #12330. **The triager must not settle #12362's expected behavior in isolation** —
  the reporter asserts "clean compile", but an escaping unhandled throw may warrant a diagnostic.

⭐**Three throw/catch defects in ~48h from one maintainer working through the feature suggests
error-handling lowering is under-exercised generally** — worth naming upward as a cluster, not just
three tickets. Not a claim about a common root cause.

## ✅ VERDICT POSTED 08-05 08:54Z — MINE-verified live, both owed items present

**Comment `5189699880`** — https://github.com/shader-slang/slang/issues/12362#issuecomment-5189699880
✅**Verified by me against the live API, not taken on report:** `nv-slang-bot[bot]`, 08:54:18Z,
6,745 chars, `comments: 1` (fresh POST, not stacked), labels `Dev Opened` + `reproduced`,
state `open`. Owed item 1 (**clause-3-of-3**) → 5 hits. Owed item 2 → `v2025.10`, `87 tags`, `bisect`
all present. Root cause cited as `slang-lower-to-ir.cpp:833`. ⭐**Negative control clean: 0 hits for
`APPROVE_WITH_NITS` or HTML-escaped `&gt;`/`&lt;`** — the escaping check matters because a
`->`-heavy root cause is exactly what mangles in a shell-quoted POST.
⇒ **GitHub observability obligation MET.** Triager memo: `triage-12362.md`, 155 lines,
`/workspace/inbox/a2a-1785920933607-hugrz3/` (verified on disk).

**No assert added, and the triager's defense is better than my instinct was.** I argued "the list was
well-formed, so an assert guards a typo not a shape." It added the mechanism: `visitCatchStmt`
push/pop is **balanced** (`:9027`/`:9039`) and the nodes are **stack-allocated in the recursion**, so
there is no malformed state that *could* be detected. Any assert would have to say "the cursor
advanced" — ⭐⭐**a tautology guard, dead the moment the line is correct.** ⭐⭐**A concurrence backed
by a mechanism is worth more than a concurrence; ask for the reason even when the answer agrees.**

**Runtime semantics verified, not merely termination.** First pass showed only exit 0; the final test
runs under `slang-test` **2/2 passing** with FileCheck asserting `caught-by-third` →
`propagated-out` + `CHECK-NOT: wrong-handler` ⇒ the third clause genuinely **catches** and the
unmatched throw genuinely **escapes**. Guard re-proven on the final text (slangc 124, slangi 124 on
pristine). ⭐⭐⭐**"It compiles now" is not the claim worth making about an error-handling fix — a
wrong-handler dispatch also compiles. Only the FileCheck asserts distinguish them.**

**Convention correction, before anyone writes the PR:** ✅**MINE-verified — all 13 in-tree
error-handling tests use `catch(err: T)` (9 occurrences); the issue's C-style `catch (int ex)` appears
0 times, though it parses.** Use the in-tree spelling. `INTERPRET` requires `main`, so the test
carries `main()` + `computeMain` both calling a shared `run()` — satisfies the reporter's real-call
requirement on both paths without duplicated bodies.

**The "2 failures" in the sweep are NOT ours — and I confirmed it myself rather than accept it.**
`tests/language-feature/` = 2192/2194, 615 ignored; the 2 are `catch-interface-typed.slang{,.1}` =
**#12343's own test**, present only because the worktree is based at #12348's head with the CFG fix
deliberately reverted for clean attribution.
⛔⭐⭐⭐**MY NEAR-MISS: `git cat-file -e 72b528b42:<path>` returned ABSENT and I almost read that as
"the test isn't in #12348." My control caught it — `git cat-file -t 72b528b42` → `fatal: Not a valid
object name`: the PR head was NEVER FETCHED, so every "absent" was a FALSE ABSENCE, not evidence.**
After `git fetch origin pull/12348/head`, with a must-exist control file firing: **PRESENT at
`72b528b42`, absent on `origin/master`** ⇒ attribution confirmed exactly as reported.
⇒ ⭐⭐⭐**`cat-file -e` cannot distinguish "not in this tree" from "this commit isn't local" — both
exit non-zero. ALWAYS pair a path-absence probe with an object-existence control on the SAME
commit.** This is the [[technique_source_pristine_binary_stale_guard_probe]] failure in a new
instrument: an absence that means "I can't see" reads identically to one that means "it isn't there."

**On failure-mode vs trigger-surface, the triager sharpened my self-correction and it's right.** I
said a failure mode is *no better* than a trigger surface. More precisely: **strictly weaker for
DEDUP, still useful for PRIORITIZATION** — "hang, no diagnostic" said nothing about cause but did
correctly say *cheap to mis-triage as a flake, expensive for a user*, which is why prioritizing the
window was correct. ⭐⭐⭐**Don't over-retract: the fix for "I used this signal for the wrong job" is
to name the job it IS good for, not to discard the signal.** (Cf. the store's own warning that a
predictive test discriminates over-retraction only.)

⏳**PERISHABLE INSTRUMENT — the triager's flag, and it generalizes.** The two-state window exists
**only** while #12348 is unmerged. Once it merges, cleanly separating a *fourth* throw/catch report
from these three gets materially harder — the "pristine" column stops existing without a revert
build. ⇒ ⭐⭐**When an unmerged PR is acting as your control, that control has an expiry date; spend
it while it's cheap.** Given 3 defects in ~48h in this subsystem, a fourth is likely.

## ⚠️ 09:16Z FINAL — two figures MOVED between messages; one is an undelivered artifact

**Closed: all 11 cells compile with the one-liner; test 2/2 guard-proven; `language-feature`
2194/2194 (was 2192/2194 at 09:08 — the 2 failures were #12343's own test, resolved by restoring
the CFG fix, exactly as attributed); `bugs` 638/638.** ⭐**A count that CHANGES between two reports
of "the same" sweep is not noise — here it was legitimate (different build state) and the triager
volunteered the reason. Ask; don't average.**

### ✅ 09:18Z RESOLVED — 203-line memo delivered, prefix claim VERIFIED, and the cause was a TEMPORAL error

**Held now: `/workspace/inbox/a2a-1785921510023-h8tw4o/triage-12362.md`, 203 lines / 12,889 bytes**
(msgs #12 and #14 announce the **same** re-send — one file on disk, not two deliveries).
✅**Claim "lines 1-156 byte-identical" VERIFIED, and stronger than stated: the old 155-line copy is a
BYTE-EXACT PREFIX of the new file** (`sha256(OLD) == sha256(head -c 9581 NEW)`; `diff` empty; control
correctly fails at a deliberately wrong 9,000-byte length). Line 156 is the blank separator. New
material = 5 sections at 157-203: `VALIDATION RESULTS`, `Conventions for whoever writes the PR`,
`NO assert added at the walk`, `Artifacts`, `Status`.

⛔⭐⭐⭐**MY OWN MATCHER ERROR, and it produced a FALSE "DIFFER" that would have accused a peer.** I ran
`head -156` on **both** files to test "lines 1-156 identical" — but the old file is only **155**
lines, so `head -156` yielded 155 lines from one side and 156 from the other and the hashes differed.
**The claim was true; my instrument was misaligned.** ⇒ ⭐⭐⭐**When comparing a prefix across two
files of DIFFERENT length, anchor the window to the SHORTER file's actual length, never to the
boundary quoted in the claim** — a peer's "lines 1-N" is 1-indexed prose about *their* file, not a
`head -N` argument for yours. ⇒ ⛔**A refutation of someone else's specific numeric claim is the
highest-risk output there is: it is adversarial, it looks rigorous, and a one-off-by-one in MY matcher
manufactures it. RE-DERIVE THE MATCHER BEFORE PUBLISHING ANY MISMATCH.** ✅**What saved it: the
full-file control fired ("files differ ✓"), which told me the comparison was live — but note the
control PASSED while the result was still WRONG, exactly this store's "a positive control proves you
read the right file, it cannot detect a misaligned enumeration."**

**Cause was neither of my two hypotheses, and the triager's own account is the accurate one:** there
was only ever **ONE** `send_file` (09:08). File mtime `09:14:49` ⇒ it appended the validation section
*after* sending, then at 09:16 reported the file's **current** size as the size of what it had
**transmitted**. ⇒ ⭐⭐⭐**THE RULE IS NARROWER THAN "STATE SIZES": for an already-transmitted
artifact, the size is a property of the TRANSMISSION, not of the file, and the two diverge the moment
you keep editing. Take the figure from the send, or re-measure AND re-send — never re-measure and
re-DESCRIBE.** My "either grew after send, or send_file failed silently" was the right shape but
credited an innocent race; the real defect was **describing a past action with a present
measurement.** ⭐⭐**A temporal boundary, not a unit/version one — same family as "a near-miss figure
is a boundary, not noise," except the reporter moved the boundary themselves.**

**Sweep-count refinement (triager's, and it corrects my framing):** 2192/2194 and 2194/2194 were
measured on **two genuinely different binaries** — master+one-liner with #12348 **reverted out** (for
clean attribution) vs **both fixes present**. ⇒ **there was never one sweep with a discrepancy to
reconcile; there were two experiments.** I framed it as "volunteered the reason," which understates
it. ⭐⭐⭐**Quote no pass/fail count without naming the build state it was taken in — a bare
"2194/2194" is not a fact, it is a fact-shaped fragment.**

⛔**(superseded, kept for the trail) MEMO SIZE MISMATCH — 155 vs 203 lines, only 155 on disk.** At 09:08 the memo
was announced as **155 lines**; I verified 155 at
`/workspace/inbox/a2a-1785920933607-hugrz3/triage-12362.md`. At 09:16 it is described as **203 lines
sent**. `find /workspace/inbox -name triage-12362.md` returns **exactly one file, 155 lines**, and
`/workspace/inbox/` holds **one** a2a dir (09:08). ⇒ **the 203-line revision was never delivered to
me** — either it grew locally after sending, or the second `send_file` silently failed.
⭐⭐⭐**This is the [[feedback_delivered_artifact_missing_index_row]] class caught EARLY for once: the
only reason I noticed is that the line count was stated BOTH times and I had verified the first.
A single unstated figure would have hidden it completely** ⇒ **state artifact sizes on every send;
the redundancy is the detector.** ⚠️**Anything only in the 203-line version is NOT in my store.**
Not chain-blocking (the verdict comment is the durable artifact and it's posted+verified), but do not
cite "the 203-line memo" as though I hold it.

⏳**PERISHABLE-CONTROL FOLLOW-THROUGH (triager acted on it):** kept `wt-12362` with **both columns
pre-built**, snapshotted pristine binaries, and a `WHY-THIS-EXISTS.txt` recipe ⇒ a 4th throw/catch
differential costs minutes, not a revert build. ✅**`df` MINE-verified: 64G avail on /workspace
(124G, 49% used)** — the headroom claim holds. ⚠️**I CANNOT see the worktree or its recipe from my
container (separate fs) — that part is the triager's report, not my measurement.** Delete once
#12348 merges **and** #12362 resolves — ⛔**both conditions; deleting on the first leaves a live
chain without its instrument.**

## RESUME

**RESUME = (a)** triager's final verdict lands → confirm the **5-bullet is POSTED ON THE ISSUE**
(GitHub is primary observability; a root-cause this cheap to state must not sit only in our store),
**(b)** skiminki-nv opens his PR → check it fixes the **clause-3-of-3** cell too, not just the
reported 2-handler case, and that the regression test **keeps a real call to `throwingFunction()`**
per his own pruning note, or **(c)** a fresh substantive human comment.

⚠️**Two things owed that the issue does not currently capture:** the **clause-3-of-3 unreachable
handler** (distinct user-visible bug, found by the corrected model) and the fact that the **v2025.10+
release range is affected** (87 tags) — both belong in the GitHub comment so the maintainer sizes it
correctly. ⛔**Do not let #12348's merge close this** — measured separate producer.

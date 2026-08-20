---
name: project_12339_include_occurrence_provenance
description: "#12339 SPIR-V debug info: carry include-occurrence provenance so DebugFunction ownership is resolvable — own-bot echo; MY OWN 'does not reproduce' finding was RETRACTED: I measured master, the issue describes an UNLANDED branch"
metadata:
  node_type: memory
  type: project
  originSessionId: session-12339-triage
---

# #12339 — include-occurrence provenance for DebugFunction ownership

**shader-slang/slang#12339**, filed **2026-08-04 13:22Z** by `nv-slang-bot[bot]` — **own-bot echo ⇒ NO re-triage, NO fixer dispatch, NOTHING POSTED.** 0 comments/labels/assignees. Successor of merged **#12148** (`0864e60e63`, merged 08-04 05:41Z by pdeayton-nv); near-successor of **#12150** (OPEN, assigned **pdeayton-nv**).

## 🔴 RETRACTION (same session, before publishing) — my "does not reproduce" finding was WRONG

I built a repro of the body's Symptom 3, measured it at master, found `variantFn2` scoped to the **entry point's** CU rather than f1's, and drafted a memo + index row asserting **"the worked example DOES NOT REPRODUCE"** and **"2 of 4 code claims are wrong."** Both headline claims were **wrong**. Caught before any GitHub post or dispatch; the memo and index row are rewritten from this measurement, not appended to.

**Defect 1 — I conflated "module-global fallback" with "bound to a real CU."** I measured the *outcome* of the fallback and read it as *absence* of the fallback.

Decisive measurement (`__include` case, `i.spvasm`), enumerating which files have a `DebugSource` but **no** `DebugCompilationUnit`:
```
DebugSources: {inc.slang, imain.slang}
CUs         : {imain.slang}
=> DebugSource but NO CU: ['inc.slang']
```
The mechanism, read at the source rather than inferred:
- `slang-lower-to-ir.cpp:15474-15480` emits a CU **only** `if (... && !source->isIncludedFile())` ⇒ an included file gets a `DebugSource` and **never** a CU ⇒ `mapDebugSourceToCompilationUnit` has no entry ⇒ `parentScope` is **null** (`:14701`).
- `slang-emit-spirv.cpp:10596-10604`: `if (auto irParentScope = debugFunc->getParentScope()) scope = ensureInst(...); if (!scope) scope = findDebugScope(debugFunc);` ⇒ null parent falls back to the **module-global** scope.
- `slang-emit-spirv.cpp:12190-12210` **sets that module-global scope to the entry point's CU** ("Also update the module-level debug scope to use the entry point's compilation unit").

⇒ **"falls back to the module-global scope" and "scoped to the entry point's CU" are THE SAME OBSERVATION.** So Symptom 1's *"keep a null parent scope and fall back to the module-global scope"* is **CORRECT**, and my "got a non-null CU, claim not observed" was me reporting the fallback as a refutation of the fallback. Symptom 4's fallback outcome is likewise **CORRECT at master**.

**Defect 2 — I "corrected" a claim the issue never made.** I wrote that the `slang-session.cpp` attribution was wrong because the only `createSourceView` there is the serialized-module path. Re-reading the body clause-by-clause: *"The `__include` path in `slang-session.cpp` **receives** the directive location but never **threads it into** view creation."* It does **not** claim the view is created there. And it verifies: `Linkage::findAndIncludeFile` (`slang-session.cpp:1964`) takes `SourceLoc const& loc`, creates **no** view, and the root view is made downstream at `slang-preprocessor.cpp:5103` with `SourceLoc::fromRaw(0)` — whose own comment says *"there is no 'initiating' source loc."* **The claim is right; I refuted a strawman.** (Same shape as [[feedback_gate_remedy_may_be_disjunctive_reread_it]] — a **reading** defect on a requirement, which no control catches.)

**Defect 3 — wrong tree.** `findIncludingNonIncludedSourceFile` and both cited tests really are absent from master (verified 3 ways, with non-zero controls). But the body says the resolution *"now counts distinct includers … and binds only when there is exactly one"* — **that logic is not at master**, so the issue is describing an **unlanded branch** (the fixer holds `wt-slang-12150`; per [[project_12150_include_line_cu_scoping]] this code lived in #12148's pre-strip head `4ccab1cc` and was stripped before merge). Measuring master and reporting "does not reproduce" is measuring **a different tree than the claim is about** — the exact defect the #12150 fixer session had *already saved as a learning* ("Before trusting a clean test result, verify you own the tree you measured"), which I then committed anyway.

## 08-05 UPDATE — sibling posted triage; my retraction CONFIRMED at the source; two of my facts DECAYED

**State moved:** triage comment **`5194175309`** posted 08-05 16:01Z by a **sibling** slang-triager session (`sess-1785932426187-0boyp4`, thread `gh-issue-shader-slang/slang-12339`) — **not by me.** Label **`reproduced`** applied 16:02Z; **pdeayton-nv assigned** by jhelferty-nv 18:16Z. Per [[feedback_sibling_write_under_shared_bot_identity]] the GitHub author field does not identify the writer — the safe reading is *"our bot posted it"*, and here `ncl sessions list` independently shows the owning sibling session.

**The sibling independently reached my retracted-to position** — its verdict carries the same master-vs-branch correction (a table of 4 body claims vs master `7175a561b`) and the same `slang-session.cpp:1964`-receives-but-`preprocessor.cpp:5100-5103`-creates correction. Convergent, on separate measurements. ⭐ Two edges reaching one conclusion guards against measurement error only — but here the mechanism is readable at the source, so it is more than replication.

**⛔ TWO OF MY FACTS DECAYED — both were true when written and are now FALSE:**
1. *"No PR carries this work"* (searched `fix/issue-12150` head, 400 branches, 230 open PRs, PR bodies, #12150's timeline — all empty). **PR #12340 exists**, created **08-04 13:36:46Z** — ~14 min *after* the issue and *after* my sweep. Draft/open, head `80da876ad`, branch **`fix/issue-12150`**, `nv-slang-bot[bot]`. My branch enumeration was correct at execution time and stale within the hour. ⭐⭐⭐ **A "nothing exists" sweep over a live repo is a TIMESTAMPED reading, not a standing fact — and the window here was minutes.** (3rd instance of the live-artifact-timestamp class: #11616, #8785, this.)
2. *"Symptom 3 needs the branch, which is not in my container"* / logged as untestable. **`git fetch origin pull/12340/head` succeeds** (rc=0, `80da876add6a…`). The refspec was always available; I inferred unavailability from the worktree's absence instead of trying the fetch. ⭐⭐ **"I don't have it" is a claim about an INSTRUMENT — run the one command that settles it** before recording a limitation.

**✅ Symptom 3 now VERIFIED as describing a real, SUPERSEDED intermediate state — at the source, not inferred.** Walking the branch history:
- `9ac664773` *"Resolve an included file's compilation unit per include occurrence"* — added code whose own comments read *"keep the **first** whose chain lands in"* / *"**First-in-view-order** is the intended answer"* ⇒ **first-occurrence binding really existed.**
- `65b81628c` *"Leave a shared header's functions on the module-global scope"* — **replaced it**, and its message is the missing citation: *"Binding the first qualifying includer **was measured against master to be a regression**: given two files including one header under different macros, the function declared by the second file was scoped to the first file's compilation unit, where the fallback had been correct."*
- `b4c4aa3b9`/`7a9833219` then moved the decision to chain **terminals**; head helper counts distinct owners and returns null unless exactly one.

⇒ Symptom 3's *"`variantFn2` … is scoped to f1's compilation unit"* is an accurate description of `9ac664773`, **not** of master or of the branch head. So my measured non-reproduction at master was *correct as a measurement* and *wrong as a verdict* — exactly the retraction above. The body's real defect is **tense/provenance**, never fabrication: it narrates a superseded commit in the present tense. The sibling's verdict says this ("describes the behaviour of that unmerged branch"); it does not cite `65b81628c`, which is the strongest available evidence *for* the issue's honesty.

**Also:** the disabled test's own header on the branch names this issue — *"Enabling this test requires `__include` to record that location the way `#include` does — see shader-slang/slang#12339"* ⇒ #12339 is the tracked blocker for re-enabling it, matching the sibling's sequencing.

## What actually survives, and at what confidence

- ✅ `slang-preprocessor.cpp:3728` — `createSourceView(sourceFile, &filePathInfo, directiveLoc)` — byte-exact at master.
- ✅ Symptom 1's mechanism (`__include` view built with no initiating loc ⇒ null parent ⇒ module-global fallback) — **verified at master**, both in code and in emitted SPIR-V.
- ✅ The root-cause argument (one `SourceFile` ⇒ one `DebugSource` ⇒ one map entry ⇒ per-expansion ownership not representable) — **consistent with everything measured**; the `!isIncludedFile()` gate is exactly that limitation.
- ✅ `findIncludingNonIncludedSourceFile` + both cited tests absent **from master** — true, and **expected** for an unlanded branch. **Not** evidence against the issue. **08-05: all present at PR #12340 head** (`git ls-tree` shows **24** `debug-function-scope-*` fixtures; helper at `:15468`) ⇒ confirmed a branch/master split, never a fabrication.
- ✅ **Symptom 3 — RESOLVED 08-05 (was "UNVERIFIED, not refuted").** Verified as an accurate description of superseded commit `9ac664773`, whose replacement `65b81628c` documents the first-occurrence regression in its own message. At master it cannot occur (no binding logic — everything falls back), so my repro could never have exhibited it; that part of the earlier note stands. **The "needs the branch, not in my container" half was wrong** — `git fetch origin pull/12340/head` works.
- ⚠️ **Untested:** the `views=27 matchFile=1 withInitLoc=0` instrumentation figure (requires an instrumented build of the branch).

**Net:** #12339 is **materially more credible than my draft claimed**. I have **no** refutation of it. The only defensible criticism left is a documentation one: the body reads as describing current master but describes an unlanded branch, and cites two tests that exist only there — which is what led me astray and could mislead a maintainer or fixer the same way.

## Routing

**Own-bot echo ⇒ no re-triage, no fixer, nothing posted.** Unlike #12337/#12338 there is **no verified additive fact to contribute** — my candidate finding was retracted, and per ⭐⭐ *over-retraction is its own failure mode* I am recording the retraction rather than publishing either the original claim or an inverted one. Posting my draft would have put a false non-reproduction on a maintainer-facing issue.

⛔ **Do NOT restate "#12339 does not reproduce" from any earlier note or index row.** That claim is withdrawn here at the top of the file, in place.

**Lessons:**
- ⛔⭐⭐⭐ **A FALLBACK'S OUTPUT IS NOT EVIDENCE THE FALLBACK DIDN'T FIRE.** I measured "has a CU" and concluded "was bound"; the CU *was* the fallback. **When a claim is "X gets no scope and falls back," the discriminator is whether X has its OWN entry — enumerate the objects that lack one** (`DebugSource` present / `CU` absent), never read the resolved end-state. Fifth instance of ⭐⭐ *match the check to the claim*.
- ⛔⭐⭐⭐ **"DOES NOT REPRODUCE" IS A CLAIM ABOUT A TREE — NAME THE TREE BEFORE PUBLISHING IT.** The issue described an unlanded branch; I measured master with a *correct positive control for master* (`merge-base --is-ancestor 0864e60e63 HEAD`=YES, `grep -c`=3) — **a well-formed control for the wrong scope reads exactly like a valid one.** Direct recurrence of ⛔⭐⭐⭐ *TICK-87: correct measurement over an UNVERIFIED SCOPE*, and of a learning the peer session on this very issue had already filed.
- ⛔⭐⭐ **RE-READ THE CLAIM CLAUSE-BY-CLAUSE BEFORE REFUTING IT.** "receives the directive location but never threads it into view creation" ≠ "creates the view here." I refuted the second. **Quote the clause you are refuting, verbatim, next to your measurement** — had I done that, the mismatch was visible without any new tool call.
- ⭐⭐ **THREE WRONG CONCLUSIONS, ZERO WRONG COMMANDS.** Every command ran clean and every number was real; the repro, the greps, the controls were all sound. The defects were *scope*, *semantics of the observable*, and *reading*. **Re-running anything would have re-confirmed the error** — cf ⭐⭐⭐ *every defect was in the MEASUREMENT; none was findable by re-reading the argument*, and its dual: **a defect in what the measurement MEANS is invisible to more measurement.**
- ⭐⭐ **A bot-authored issue that cites one byte-exact line number earns unearned trust in its other cites — and, symmetrically, one apparent miss earns unearned distrust.** `preprocessor.cpp:3728` verifying made me credulous; then a single misread made me sweep-condemn 4 symptoms. **Adjudicate PER ITEM** (cf codex's 12 real catches + 1 bogus item coexisting).

**08-05 18:17Z inbound — jhelferty-nv cmt `5195590587`: *"@pdeayton-nv is this germane to your interests?"*** — **maintainer↔maintainer coordination, NON-SUBSTANTIVE to us.** No `@nv-slang-bot` mention (the `pr_mention` webhook label is the router's, not the body's), no design point, no question to us; he had **assigned pdeayton 1 min earlier** (18:16:45Z), so it reads as a nudge attached to his own assignment. **Byte-identical shape to the 07-29 ping on #12150** (jhelferty → *"@pdeayton-nv Can you take a look at this?"*), which was correctly logged non-substantive. **No GitHub post** (triage `5194175309` already states the verdict + names the maintainer blocker; a second comment would restate it and would be a *new* comment, so it would notify — noise on a chain whose gate is a human's answer). **No fixer** (own-bot echo + explicit maintainer-decision blocker). **Not a re-open trigger** per the substantive-comment rule: soliciting the assignee's input is consistent with the posted HOLD.

**08-19 17:24Z inbound — jhelferty-nv cmt `5345645983`: *"Handing this to @zangold-nv to triage and schedule"*** — **REASSIGNMENT, still maintainer↔maintainer, NON-SUBSTANTIVE to us.** Timeline: pdeayton-nv **unassigned** + **zangold-nv assigned** 17:23:46Z (both by jhelferty), comment 22s later. No `@nv-slang-bot` mention in the body (the `pr_mention` label is the router's). **3rd ping of identical shape** (07-29, 08-05, now) — all jhelferty routing between human maintainers, none a question to us. **No GitHub post** (triage `5194175309` still states the verdict; a fresh comment would notify = noise), **no fixer** (own-bot echo + maintainer-decision blocker unchanged — now zangold's to answer, not ours to force), **not a re-open** (reassigning ownership is consistent with the posted HOLD). ⚠️ Assignee is now **zangold-nv**, "to triage and schedule" — pdeayton is off it. #12340 last checked draft/open 08-05; **not re-verified this turn** (no need — the inbound changes only the assignee, and a status re-poll would be for my own curiosity, not the routing decision).

**RESUME** = **zangold-nv** (not pdeayton) triages/schedules and answers the semantic `__include`-provenance blocker; a **substantive non-bot** comment lands; #12340 leaves draft/merges; or the disabled test's re-enable is requested. Related: [[project_12150_include_line_cu_scoping]], [[project_11983_spirv_debugfunction_wrong_cu]], [[project_12181_debug_info_include_source_flag]].

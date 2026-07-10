---
name: project_11954_simplifyir_sideeffect_memo
description: PR
metadata: 
  node_type: memory
  type: project
  originSessionId: 679b4992-2925-4753-bd5b-d242bc75445b
---

shader-slang/slang **PR #11954** "Fix quadratic callee side-effect queries in the simplifyIR fixpoint" — **external human author jvepsalainen-nv** (NOT a bot PR; no fix/issue-* branch). Fixes #11780's perf angle by memoizing `doesCalleeHaveSideEffect` via optional `Dictionary<IRInst*,bool>* calleeSideEffectCache` on `IRDeadCodeEliminationOptions`.

**Re-review (07-09 22:24Z, synchronize @ head `e21d4a34`, diff `cdba246b3815`):** author push was **comment-only** (executable code byte-identical to be142dfc — reviewer proved via non-comment line diff). Updated COMMENT-state review POSTED [4667172377](https://github.com/shader-slang/slang/pull/11954#pullrequestreview-4667172377) (supersedes 4666636067, now minimized). Verdict **🟡 APPROVE_WITH_NITS — 0 bugs, 1 open nit (down from 2).** **Gap 1 (phantom debug-check) RESOLVED** ✅ — author removed all "debug-mode check" claims (grep zero survivors), reworded addAnnotation note, consolidated ~5-way soundness restatement into `calleeSideEffectCache` field doc w/ "see…" pointers. **Gap 2 (DCE-only memo scoping) UNCHANGED** — non-blocking, author's prerogative. Correctness carries over (code identical → UAF-safe, monotone-sound). **Maintainer jkwak-work posted human review `4667097558`** — human review proceeding in parallel.

**Review 1 (07-09, slang-reviewer):** COMMENT-state review POSTED — id 4666636067 (now minimized). Verdict **🟡 APPROVE_WITH_NITS — 0 bugs, 2 gaps, 0 questions.** Reviewers A (correctness) + C (clarity) ran; B (Devin) **skipped** (Chrome browser-infra launch fail in-container, not auth/timeout). diff sha256 `1a753697bed8`, head be142df.

- **Gap 1 (High, A+C converged C001):** 3 comments incl. public header `slang-ir-insts.h` promise a "debug-mode contract check" in `doesCalleeHaveSideEffect` that impl DELIBERATELY omits → forward hazard for a maintainer adding an annotation-creating pass to a shared-cache fixpoint (silent-miscompile risk on stale cached `false`).
- **Gap 2:** memo threaded only through DCE; sibling queries `propagateFuncProperties` + `canInstHaveSideEffectAtAddress` in same fixpoint stay uncached → quadratic reduced not eliminated fixpoint-wide.
- Memoization logic itself SOUND: pointer-keyed cache UAF-safe (bump-alloc IR, never freed in fixpoint); monotonicity holds (stale answer only keeps a call conservatively alive).

**#11780 interaction: NONE** (verified vs source). #11954 = perf memoization of callee side-effect classification; #11780 = witness-table link-gating (IDifferentiable closure pin/unpin) — distinct mechanics, no data overlap; memo errs only MORE conservative so can't introduce/mask #11780. See [[project_11780_simplifyir_regression_pending]].

**Audit caveat:** Reviewer-A `INTEGRITY-FAIL` marker = FALSE POSITIVE — concurrent PR-12029 run clobbered shared `tmp/pr-files.txt`; manually re-verified A+C reviewed correct #11954 diff (11954 files 56× / 12029 0×, sha match). `reviewers_complete=true` is a deliberate manual override, noted in RESULT_JSON.

**State:** report distributed to slang-fixer + slang-pr-approver by reviewer. **Approver shadow decision (07-09 21:01Z): `ABSTAIN_POLICY`** — reason `CLAUSE_FAIL:author_trust,head_provenance` (author_association=CONTRIBUTOR outside trusted set + fork head `jvepsalainen-nv/slang`, v0-shadow forbids fork heads). Terminal clause-fail → challenger didn't run; shadow mode never posts, routes to human maintainer by policy = EXPECTED for external-fork PR. Passing clauses incl. `commit_match` + `ci_green_on_sha` vs `1a753697bed8` — confirms false-positive INTEGRITY-FAIL did NOT leak into decision; abstain is purely author-trust + fork-provenance (maintainer-waivable only). **Next-action:** external author addresses 2 comment/scoping gaps. Ready-flip/merge **operator-gated**, untouched. Canonical thread `gh-issue-shader-slang/slang-11954`. Chain terminal on ALL edges (review + shadow-approval); reopens only on author reply / synchronize webhook.

---
name: project_11977_sec_tutorial_docs_abstain
description: docs PR SEC tutorial; ABSTAIN_POLICY OPEN_GAP at d2b6269; Devin 🔴 was FP; head moved to ea4437f
metadata: 
  node_type: memory
  type: project
  originSessionId: 0a7ef904-da55-4109-937f-ac50473224fa
---

shader-slang/slang **#11977** — "docs: add Shader Execution Coverage tutorial to the user guide", author **jvepsalainen-nv** (maintainer, human-authored). Routed to `slang-pr-approver`; canonical thread `gh-issue-shader-slang/slang-11977`.

**STABLE VERDICT across revisions: ABSTAIN_POLICY — OPEN_GAP** (recorded per-SHA to ledger, critique-gated PASS, nothing posted to GitHub — approver is read-only). All 6 clauses pass; primary github-actions[bot] review = 🟡 gaps, no 🔴.
- R1 @ head `d2b62699d2b7`
- R2 @ head `7e2b01d636ac` (debounced `ea4437f→cf86979→7e2b01d`); primary review 🟡 2 gaps + 1 question, no 🔴. README:142 gap persists (grep-confirmed still in diff; code facts don't change between revisions).
- R3 @ head `65921d6cab4c` (short-circuited: R2→R3 diff touches 3 files, NOT README:142 → gap byte-unchanged; only code delta = new `--no-coverage` mode in hello-coverage-host.cpp, reviewed clean; decided from head-current Devin). README:142 unchanged → same ABSTAIN.

**Fast-churn HOLD (07-13):** head moved `65921d6→266f3cce` during R3 decision. Verdict IDENTICAL across R1/R2/R3, load-bearing gap (README:142) byte-unchanged, no 🔴, non-blocking ABSTAIN on maintainer's own docs PR. NOT chasing 266f3cce — intermediate-head ledger rows superseded seconds later have ~zero value; only the head the human actually reviews/merges matters (recorded via pr_review/pr_merged join stamping human verdict on decision rows). Re-dispatch only when branch settles. See [[feedback_debounce_pr_review_on_churn]].

**Findings:**
- ❌ Devin 🔴 "wrong Windows manifest path" at `run-tutorial.ps1:129` = **false positive**. slangc names sidecar `<-o path>.coverage-manifest.json` by literal concat (`slang-end-to-end-request.cpp:529`); line is correct. → no BLOCK.
- ⚠️ **REAL OPEN_GAP** at `tools/shader-coverage/README.md:142`: PR adds false API-ordering claim (`getEntryPointCode` before `getEntryPointMetadata` else `E_INVALIDARG`). Both getters share one order-independent `getOrCreateEntryPointResult` cache; real error is `SLANG_FAIL`. Public-docs accuracy defect → human author should fix. → not WOULD_APPROVE.
- "~140 lines" @ a1-06:146 (file is 110) → advisory, cleared.

**State:** head advanced to `ea4437f` just after decision derived → that revision needs its own per-SHA decision (re-dispatched to approver). Fast-churn PR — approver debounces to settled head internally. See [[feedback_debounce_pr_review_on_churn]].

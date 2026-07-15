---
name: project_11977_sec_tutorial_docs_abstain
description: docs PR SEC tutorial; MERGED 07-14; ABSTAIN OPEN_GAP (README:142) VALIDATED — human fixed exact claim pre-merge; chain closed
metadata: 
  node_type: memory
  type: project
  originSessionId: 0a7ef904-da55-4109-937f-ac50473224fa
---

**✅ CLOSED — MERGED 2026-07-14T07:31** by author jvepsalainen-nv (merge commit `65a98e33`, final head `e50341898f2f`, 61 commits). Human verdict (merged ⇒ APPROVED-equiv) stamped on all 3 approver decision rows (R1 `d2b62699`, R2 `7e2b01d6`, R3 `65921d6c`).

**Calibration = VALIDATED ABSTAIN.** At merged head, `README.md:142` no longer contains the false API-ordering claim (zero `E_INVALIDARG`, no `getEntryPointCode`-first requirement) — the author's "Address review round" commits removed the exact defect the approver flagged as OPEN_GAP across all 3 revisions. Not a false-safe, not human-disagreement: conservative OPEN_GAP on a code-contradicted public-docs API claim confirmed correct. Approver-side learning: provably-false API claims in reference docs are gap-worthy, not advisory, even on docs-only PRs.

Note: PR generated a very long unbroken run (~25+) of identical no-SHA `synchronize` webhooks over ~21h of live author iteration. Correct handling = dispatch-once → hard-debounce → true silence, resolving only on the terminal `pr_merged` join. Not escalation-worthy (normal maintainer live-rewrite). Historical detail below.

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

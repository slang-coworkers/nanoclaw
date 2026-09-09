---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787094122618-6wk1uf
written_at: 2026-08-19T04:12:37.529Z
---

# [approver/human-disagreement] Abstain on a pre-existing 🔴 overruled by merge-as-is (slang#12552)

**PR:** shader-slang/slang#12552 @ `5e96544fd8e2` ("Fix #12387: contain exceptions escaping Module::precompileForTarget"). My decision: **ABSTAIN_POLICY / CHALLENGER_CONCERN**. Human outcome: **MERGED AS-IS** at my exact decided head (1 commit, 0 interval commits) by maintainer `tangent-vector`, 2026-08-19T04:09:35Z — the same maintainer who had APPROVED twice.

**Disagreement (scored against the falsifiable reading).** My abstain asserted the PR was "material enough not to merge as-is" — a human should decide whether a scope-guard cleaning the transient `DownstreamModuleExportDecoration` markers on the exception failure path belongs in this PR. It merged as-is with nothing touching the guard ⇒ the "material" claim is **refuted**. The maintainer treated the stale-marker residual exactly as I had argued a BLOCK would (pre-existing / out-of-scope) — but I still abstained rather than clearing.

**Structural root — this abstain was the CEILING available to me, not a free choice.** The review doc carried a Devin 🔴, and skill Step 3 is absolute: "investigation can only add caution, never upgrade a doc's 🔴 toward approval." So once I verified the 🔴 as real (even though pre-existing + out-of-scope + on a path the PR strictly improves), WOULD_APPROVE was mechanically barred and ABSTAIN was the best reachable state. BLOCK would have been worse (a false-BLOCK on a strict-improvement, maintainer-authorized, twice-approved fix). The disagreement therefore points at the PROCEDURE, not my application of it.

**Calibration question worth surfacing (candidate `[approver/clause-gap]`).** On the **fallback (Devin-only) tier**, "any 🔴 bars WOULD_APPROVE" collides badly with a 🔴 that the challenger *verifies as pre-existing and out-of-scope*. That combination systematically produces abstains on bot-fixer PRs that are strict improvements over process-termination, which humans then merge as-is. Consider: when the challenger positively establishes a 🔴 is (a) pre-existing at merge-base AND (b) not introduced/worsened by the diff AND (c) the changed path is a strict improvement, the finding should be reclassifiable as an advisory 🟡 (clears) rather than an approve-barring 🔴 — i.e., the "pre-existing/out-of-scope" determination should be allowed to downgrade a fallback-tier 🔴 out of bar-territory. As written, it cannot, and abstain is the forced result.

**How to catch / apply next time.** This is not a "be less cautious" lesson — given the current guardrail the abstain was correct. It IS a signal to (1) expect merge-as-is on strict-improvement bot-fixer PRs whose only 🔴 is pre-existing, and (2) raise the procedure question above rather than silently re-abstaining on the next instance. Do NOT round future such cases up to WOULD_APPROVE to avoid the disagreement — the guardrail is real; escalate the calibration instead.

**No false-safe.** An abstain asserts nothing about the code, so nothing unsafe shipped on my account; the concern I raised was genuine, just not merge-blocking in the maintainer's judgment.

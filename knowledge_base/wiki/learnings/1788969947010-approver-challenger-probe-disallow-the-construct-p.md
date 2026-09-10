---
title: "[approver/challenger-probe] 'Disallow-the-construct' parser PRs — crash-fix-by-rejection is legit; leftover-in-scope decl is error-recovery; gate on missing breaking-change docs"
type: learning
topic: review-approval
source: learnings/1788969947010-approver-challenger-probe-disallow-the-construct-p.md
---

# [approver/challenger-probe] "Disallow-the-construct" parser PRs — crash-fix-by-rejection is legit; leftover-in-scope decl is error-recovery; gate on missing breaking-change docs

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788969136694-7ir373
written_at: 2026-09-09T16:05:47.010Z
---

# [approver/challenger-probe] "Disallow-the-construct" parser PRs — crash-fix-by-rejection is legit; leftover-in-scope decl is error-recovery; gate on missing breaking-change docs

Context: shader-slang/slang#12389 "Disallow declaration substatements" (parser rejects `if(c) int a;`, `defer int x;` etc. via a new `checkForValidSubstatementType`; also "fixes a crash when deferred declarations are accessed", #12266). Decision: ABSTAIN_POLICY (OPEN_GAP). Primary claude-code-action review 🟡/0-bugs, Devin clean, CI green; CodeRabbit flagged a 🟠 "Major functional correctness / crash fix incomplete".

**Symptom.** A parser PR that *rejects* a previously-crash-causing construct draws a "Major functional correctness — the fix is incomplete, the rejected decl still leaks into the enclosing scope" objection from one reviewer, while the production primary review + Devin find 0 confirmed bugs. Which is right?

**Root cause / how to reason.**
1. A `DeclNotAllowed` (error) diagnostic makes the front-end stop before IR-lowering, so the lowering-phase crash the PR targets never runs. The regression test compiling the exact crash scenario + **CI green at head** IS the proof the crash is fixed. Rejecting an invalid construct and not lowering it is a legitimate fix, NOT a mask — even though a nested-scope fix would also have worked (the author explicitly chose "disallow" because substatements have no nested scope by default).
2. The "rejected decl still in scope so later uses resolve" behavior is standard **error-recovery** (suppresses a cascade of undefined-identifier errors on code that already failed to compile). It has zero codegen impact (compilation already failed) and doesn't reproduce the crash (test+CI prove it). So a "Major functional correctness" label on it is overstated — it's a diagnostic-quality preference, not a verified 🔴 bug. Tell-tale: the regression test deliberately has NO `//diag` annotations on the later `v0..vN` uses.

**How to catch the REAL gate.** For a `pr: breaking change` that silently rejects previously-valid code, the blocking gap is usually **missing documentation**, not the code. slang has a formal language-evolution checklist (`docs/language-reference/introduction-language-evolution.md` steps 3-4 "Update User's Guide / Language Reference") and a per-version breaking-changes list (`docs/user-guide/11-language-version.md`). A breaking change applied retroactively to ALL `-std` versions with none of those docs touched = OPEN_GAP with real user-facing blast radius. Both bots independently flagged it here.

**Fix / decision rule.** No verified 🔴 ⇒ not BLOCK. Clean code + 0 bugs but breaking-change-without-docs + an unresolved design disagreement + a core maintainer requested-but-not-yet-reviewed ⇒ not WOULD_APPROVE. ABSTAIN_POLICY(OPEN_GAP): "a human must look." Standing probes that stayed clean and are worth reusing on any statement-parser PR: over-rejection (check is additive on DeclStmt only — non-decl substatements untouched), and blast-radius (CI green at head proves no other declaration-substatement site broke).

**Hook mechanics (unrelated but cost me two retries):** the `[Approval Decision]` delivery message goes through the critique gate's ABSTAIN fast-path ONLY if the text contains `ABSTAIN_POLICY`/`ABSTAIN_INFRA` and does NOT contain the whole words `BLOCK` or `WOULD_APPROVE` — so never write "not BLOCK" in the abstain message. It also requires `in_reply_to=<inbound id>` (gate-chain-routing.sh) even when posting to the dashboard.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788969947010-approver-challenger-probe-disallow-the-construct-p.md`_

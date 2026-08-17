---
title: "[approver/challenger] module-version-bump synchronize (k_maxSupportedModuleVersion): audit value/lockstep/additivity against the design docs; DISMISSED human review is not a CHANGES_REQUESTED veto — slang#12133 R3"
type: learning
topic: review-approval
source: learnings/1784343540068-approver-challenger-module-version-bump-synchroniz.md
---

# [approver/challenger] module-version-bump synchronize (k_maxSupportedModuleVersion): audit value/lockstep/additivity against the design docs; DISMISSED human review is not a CHANGES_REQUESTED veto — slang#12133 R3

**Context:** slang PR #12133 (#9382 Gather const-offset) R3 synchronize. Delta R2→R3 = a SINGLE one-line change: `slang-ir.h` `k_maxSupportedModuleVersion` 25→26, commit "Bump k_maxSupportedModuleVersion for the new imageGatherOffset IR". Decided WOULD_APPROVE (CLEAN).

**How to audit an IR-module-version-bump delta (transferable checklist).** When a slang synchronize's whole delta is bumping `k_maxSupportedModuleVersion`, don't wave it through as "just a version bump" — verify five things against the in-tree design docs:
1. **Is it prescribed?** `docs/design/ir-instruction-definition.md` (step 5: "increment k_maxSupportedModuleVersion") and `docs/design/backwards-compat-for-ir-modules.md` mandate a **minor** bump (max only) when ADDING an IR instruction. This PR added `kIROp_ImageGatherOffset` (stable-name id 898), so the bump is the required companion, not gratuitous.
2. **Correct value?** It's a plain monotonic +1 — confirm via `git log -L <line>:source/slang/slang-ir.h` that prior feature PRs bumped +1 each (here an unbroken 20→21…24→25 chain over 5 PRs). No registry assigns numbers.
3. **k_min unchanged?** Adding (not removing/changing) an op is a MINOR bump → `k_minSupportedModuleVersion` must NOT move, so backward compat with all prior versions is preserved. If min moved, that'd be a breaking change needing scrutiny.
4. **No lockstep co-edit missed?** The serializer writes the version automatically from the field initializer (`m_version = k_maxSupportedModuleVersion`, slang-ir.h:2292) — so bumping the constant is sufficient; there's no version→feature switch/table or writer that needs a paired edit (the read path in slang-serialize-ir.cpp has no per-version branching).
5. **Additive / no risk?** Op-validity is gated by the stable-name id / `kIROp_Unrecognized` mechanism (slang-serialize-ir.cpp:322-330,831-832), NOT the numeric version. So raising max cannot make the compiler accept a module it should reject. The bump is metadata/contract-correctness, not a same-compiler round-trip blocker (the read path doesn't numerically compare version to max) — but omitting it mislabels modules and trips the `extras/check-inst-version-changes.sh` CI gate that flags IR-instruction changes without a version bump.
Because it touches no emit/classifier/test logic, the prior revision's verified safety chain carries forward — the challenger's job is the bump audit, not re-deriving the fix.

**DISMISSED human review ≠ CHANGES_REQUESTED.** Between R2 and R3 the human reviewer's review flipped COMMENTED → **DISMISSED** (latestReviews shows DISMISSED). A dismissal WITHDRAWS a review — it removes a (here non-blocking) COMMENTED review, leaving NO active human review. Do NOT treat it as a standing CHANGES_REQUESTED (which WOULD cap at ABSTAIN per [[pr-11136-decided]]). It does not block WOULD_APPROVE. Keep mode=live_late as a ledger tag (a human review existed on the PR at some point); eval-clauses doesn't gate on it.

**Auditability note (codex advisory):** when your local clone is NOT staged at the PR head (common — it may sit on an unrelated branch at the old value), verify head-specific facts (the delta, the constant's new value, review state, CI) against the REMOTE via `gh api .../compare` + `gh pr view` + `gh api .../check-runs`, and SAY SO in the investigation doc. Reading mechanism/enforcement code the delta doesn't touch from the (stale) clone is fine; reading the changed line from it is not. State the verification basis so a reader can audit which claims came from remote vs clone.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784343540068-approver-challenger-module-version-bump-synchroniz.md`_

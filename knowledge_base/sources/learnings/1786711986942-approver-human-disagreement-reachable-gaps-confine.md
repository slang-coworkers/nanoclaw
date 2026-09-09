---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786701878330-s1s868
written_at: 2026-08-14T12:53:06.942Z
---

# [approver/human-disagreement] Reachable gaps confined to opt-in/nightly INFRASTRUCTURE are routinely shipped-then-followed-up by maintainers — weight blast-radius by artifact class

**Signal:** slangpy#1107 (sanitizers) — I recorded ABSTAIN_POLICY:OPEN_GAP on two real, reachable head-current gaps; the author (a MEMBER) self-merged the PR **unchanged** minutes later (merged ⇒ APPROVED-equivalent). Both gaps shipped verbatim. Not a false-safe (that would be WOULD_APPROVE vs human-CHANGES_REQUESTED, and abstains are excluded from agreement scoring), but a decision/human mismatch worth calibrating on.

**What distinguished these gaps:** both lived in **opt-in / nightly-only infrastructure**, not in the shipped library/extension:
- `ci.py:114` PYTHONPATH-overwrite only bites a *specific* config — a Windows/macOS sanitizer-host venv where the new helper sets PYTHONPATH; the normal (non-sanitizer, non-venv) test path is unaffected.
- `sanitizers.yml` unverified LLVM download only runs on the **scheduled/dispatch** sanitizer job, which is not part of PR-merge CI and ships to no user.

**Transferable lesson:** when weighing OPEN_GAP severity, classify the gap's ARTIFACT, not just its reachability:
- **Shipped artifact** (library/extension/public API code path a user hits) → a reachable gap here genuinely warrants abstain; maintainers rarely ship these knowingly.
- **Opt-in/nightly/dev-only infrastructure** (a new nightly CI workflow, a dev test-runner env path gated on a rare local config) → a reachable gap here is real but has confined blast radius, and maintainers *routinely* merge it and follow up in a later PR, especially when the author is a trusted MEMBER and the whole feature is new+off-by-default. Expect a high human-override rate on abstains of this class.

This does NOT mean auto-clear infra gaps (shadow mode is conservative by design; the human is the gate, and flagging was correct). It means: in the challenger writeup, STATE the artifact class explicitly and set confidence accordingly — an OPEN_GAP on nightly-CI hardening is a weaker "human must look" than an OPEN_GAP on a shipped code path. Helps the next reviewer of similar build/CI-tooling PRs (which are common from this team) calibrate rather than reflexively abstain at full confidence. See [[approver/critique-mustfix]] on judging reachability — this refines it: reachability establishes the gap is real; artifact class establishes how much it should move the decision.

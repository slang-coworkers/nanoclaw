---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786701878330-s1s868
written_at: 2026-08-14T12:41:25.634Z
---

# [approver/critique-mustfix] "Pre-existing line" and "no real-world trigger" are not gap clears — judge REACHABILITY on the PR's own new paths

**Symptom:** On slangpy#1107 R3 I derived WOULD_APPROVE, clearing both head-current CodeRabbit Major findings: (a) `tools/ci.py:114` `get_python_env()` overwrites `PYTHONPATH` — I cleared it as "pre-existing (identical at base main), not PR-introduced"; (b) `sanitizers.yml:85-86` LLVM installer downloaded+executed with no sha256 — I cleared it as "no real-world code trigger / nightly hardening nit." The DECISION_REVIEW critique (codex) flagged BOTH as rounding-up. On re-verification against source, both are real OPEN_GAPs.

**Root cause — two distinct clearing fallacies:**
1. **"Pre-existing line" ≠ "pre-existing gap."** A line unchanged by the diff can still become a NEWLY REACHABLE defect because the PR adds the code that depends on it. Here `get_python_env` clobbering `PYTHONPATH` was harmless until THIS PR added `tools/setup-sanitizer-env.py:181-185`, which builds `PYTHONPATH=purelib+existing` for the Windows/macOS sanitizer-host venv — which `get_python_env` then discards, breaking pytest imports under the sanitizer host. The reachability is created by the PR even though the clobbering line is old. Judge the gap in the context of the PR's new call paths, not the line's git blame.
2. **"Nightly / not merge-gating / official URL" ≠ "no trigger."** A CI job that downloads AND executes an unverified binary on EVERY scheduled run has a concrete, recurring trigger with supply-chain blast radius — especially on a self-hosted runner. "Future-proofing with no real-world trigger" (the conservative-clear carve-out) does NOT cover a step that fires on every run.

**How to catch it:** For each finding you're tempted to clear, ask the two challenger questions explicitly: (1) does the PR introduce anything that makes this newly reachable? (grep for new callers/producers of the value the finding is about — here, who writes PYTHONPATH); (2) does the trigger actually fire on a supported path/run, or is it genuinely dead? A "pre-existing" or "hardening nit" label is a hypothesis to test against the diff, not a clear.

**Fix:** conservative-lean holds — any plausible real trigger => ABSTAIN_POLICY:OPEN_GAP; uncertainty => ABSTAIN. This is the "write the role where the operation happens" failure applied to gap severity: I judged each line in isolation instead of its role in the PR's new sanitizer flow. Also: record the decision ts AFTER the review it relies on (my first ts predated the CodeRabbit review). Credit: caught by the critique gate, which is exactly its purpose on WOULD_APPROVE.

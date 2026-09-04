---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788417845007-bv4mrn
written_at: 2026-09-03T22:38:01.883Z
---

# [approver/calibration] CI-only .github/** PRs deterministically ABSTAIN under v0-shadow and are un-scoreable — merge-confirmed correct routing

**Symptom.** shader-slang/slang#12888 ("Post PR board repo writes as github-actions[bot]", MEMBER jhelferty-nv, same-repo) — a well-formed CI/identity change, all 15 files under `.github/**` (workflows, templates, one test, docs). Decision was `ABSTAIN_POLICY (CLAUSE_FAIL:no_protected_paths)` at Step 1, early-return. The human **merged it unchanged** at the exact decision commit (906a0a9bb385, no follow-up commits). So the abstain vs. merge is ABSTAIN-vs-APPROVED — but that is *correct routing* (protected-path guard handing a CI change to a human), NOT a false-safe or miss. Abstains are excluded from agreement scoring by design.

**Root cause (the transferable class, not the instance).** Under the bundled `v0-shadow` policy, an entire class of PR is deterministically un-decidable and contributes **zero** approver signal:
- `protected_paths` includes `.github/**`, `**/*.yml`, `**/*.yaml`, `**/CMakeLists.txt`, `cmake/**`, `external/**` → any PR touching only these FAILS `no_protected_paths`.
- `max_total_lines: 400` / `max_files: 30` → CI PRs that bundle templates+tests+docs often also FAIL `tier_eligible` (here 454 > 400).
- Production's claude review bot **skips CI-only PRs**, so harvest returns exit 20 (no bot review) and the Devin-only tier is moot once a Step-1 clause already fails.

**How to catch it / what it means for the next review.** When a tasking is a PR whose changed paths are entirely under a protected glob (`.github/**`, top-level `*.yml`/`*.yaml`, `cmake/**`, `external/**`, `CMakeLists.txt`), expect a deterministic Step-1 abstain under v0-shadow — no amount of challenger work changes it, and the harvest will usually be exit 20. Don't burn a Devin run or deep challenger investigation on it; confirm the clause fail and abstain fast. Record it honestly and do NOT re-escalate the mount per-PR (one standing escalation already open).

**Fix (systemic).** The class only becomes decidable if a real `policy/APPROVAL_POLICY.json` is mounted that either (a) removes/loosens `.github/**` from `protected_paths`, or (b) defines a tiered handling for CI-config changes with its own trust/size rules. Until then, `.github/**`-only PRs are shadow-mode blind spots by design — track them as expected abstains, not misses.

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787909176269-bw471q
written_at: 2026-08-28T10:13:53.500Z
---

# [approver/challenger-calibration] CI grep-guard PRs need a positive control run against a violating tree

**Symptom:** A PR adds a new textual CI guard (e.g. `git grep -wn 'CMAKE_BINARY_DIR'` over first-party CMake, slang#12793). The guard's own CI job runs green on the PR head. It is tempting to read green-on-head as evidence the guard works.

**Root cause:** Green on a clean tree carries ZERO bits about whether the guard actually CATCHES a reintroduction. A dead always-pass guard (broken pathspec, wrong exit-code handling, no-op) is byte-identical to a live one when the tree is already clean — which it is, because the migration the guard protects already happened. This is the same false-safe class as gate/flag PRs: the safety observation could not have come out otherwise, so it proves nothing.

**How to catch it:** Run the EXACT script from the diff against a tree that genuinely CONTAINS violations (the failing direction). For slang#12793 I ran `check-no-cmake-binary-dir.sh` against a pre-#12570-migration checkout with 33 first-party `CMAKE_BINARY_DIR` occurrences → it correctly exited 1 and listed every offender + the remedy. That — not the green head run — is the bit that proves the mechanism is live. Then confirm the clean direction from the guard's own head CI log (it printed the "OK: …" line, so it executed and wasn't path-skipped).

**Fix / calibration:** For a new grep/lint CI guard, the decision rests on a directly-reproduced positive control, not on green CI. A guard that also lacks a BUNDLED self-test (inserting a violation, asserting nonzero exit) is a NIT — not OPEN_GAP — WHEN (a) you verified live-ness yourself, (b) the check is non-required, and (c) its worst-case failure mode is the status-quo (no guard), which cannot regress the product. The OPEN_GAP escalation for missing positive controls is calibrated for cases where live-vs-dead is structurally UNOBSERVABLE from artifacts (compiler-pass gating); a shell guard is trivially observable, so verify it and downgrade.

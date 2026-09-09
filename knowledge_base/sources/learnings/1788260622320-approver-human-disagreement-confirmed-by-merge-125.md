---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786971225650-xnta6p
written_at: 2026-09-01T11:03:42.320Z
---

# [approver/human-disagreement] CONFIRMED by merge: #12503 shipped UNCHANGED at the exact ABSTAIN'd head — process-label-only abstains are over-conservative on code-correct PRs

**Outcome join (2026-09-01).** shader-slang/slang#12503 MERGED by jvepsalainen-nv at `2b5c25dc` — the EXACT head I decided on at R2 — with **zero follow-up commits** between my decision and merge (PR commit list ends at 2b5c25dc; merge commit 801d5156). Label stayed `pr: non-breaking`.

**What this confirms (closes the loop on two earlier predictive learnings).**
1. The R1 reachability 🔴 refutation was RIGHT. I abstained (couldn't clear a doc-🔴 to approval) but verified via source trace + build+test that `import glsl;` yields E30600 with no crash. The clean merge confirms there was no reachable crash. `internal` builtin members are genuinely inaccessible to importers — trust that mechanism.
2. The R2 breaking-change-LABEL concern was NOT material. The maintainer merged unchanged with `pr: non-breaking`. Removing a `__`-prefixed core-module intrinsic that only ever crashed if called is treated as non-breaking by slang maintainers (no working code broken, no `include/` ABI). Devin classifying that as a "Bug" was a false-positive-severity call.

**Calibration takeaway (actionable).** Both my decisions were ABSTAIN_POLICY on a PR that merged unchanged — safe (never a false-safe) but **over-conservative** on the falsifiable "material enough not to merge as-is" test. The recurring driver is a reviewer (Devin/CodeRabbit) filing a pure repo-process/label observation under "## Bugs", which the doc-🔴 guardrail then converts into a forced abstain. **Next time a code-correct PR's ONLY active finding is a process/label matter with zero code-correctness content: synthesize it as a 🟡 gap / 🔵 question (clearable via the conservative-lean severity bar: nil blast radius, no working-code trigger), NOT a 🔴 — so a verified-clean fix can reach WOULD_APPROVE instead of a reflexive abstain.** Never down-classify a real code 🔴; this applies only to findings with no code-correctness component. Data point count so far: 1 clean-merge confirmation; keep joining to see if the pattern holds before loosening.

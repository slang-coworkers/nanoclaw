---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786971225650-xnta6p
written_at: 2026-09-01T03:18:25.503Z
---

# [approver/human-disagreement] A repo-process/label finding classified as a "Bug" forces ABSTAIN even on code-correct PRs the maintainer approves

**Case.** shader-slang/slang#12503 R2 (2026-09-01). Code was verified correct (R1 build+test; Devin's own reachability 🔴 marked Resolved). The ONLY active Devin "Bug" was a repo-rule/process observation: "removing a core-module intrinsic requires the breaking-change label" (PR labeled `pr: non-breaking`). Per the doc-🔴 guardrail ("investigation can never clear a doc-🔴 to approval") this mechanically forced ABSTAIN_POLICY:CHALLENGER_CONCERN. Meanwhile a maintainer (jvepsalainen-nv) APPROVED the exact head with the label as-is.

**The tension.** Devin (and CodeRabbit) file repo-process findings under "## Bugs". A process/label finding is NOT a code-correctness defect, but if synthesized as a 🔴 it triggers the same "can't clear to approval" ratchet as a real crash bug — so the approver abstains on PRs the maintainers happily merge. Over-abstaining on process-only findings destroys agreement signal (the same reason v0-shadow was widened to v0-shadow-wide).

**Merits of the specific label question (transferable).** slang's breaking-change rule = "public API/ABI break OR a language change that errors out EXISTING Slang code, and it is RARE." Removing a `__`-prefixed core-module intrinsic that ALWAYS crashed when called (never produced a working shader) breaks no *working* code, and a builtin `.meta.slang` decl is not an `include/` ABI surface — so `non-breaking` is defensible. The only pro-breaking reading is hyper-literal ("source that used to type-check-then-crash is now rejected at check").

**Guidance for next time.** (1) When the sole active finding is a process/label observation with no code-correctness component, that is squarely a maintainer-policy call — abstain (CHALLENGER_CONCERN) is correct and safe, but recognize it as a *conservative* abstain, not a defect block; expect the human join to be APPROVED. (2) Consider, at SYNTHESIS time, classifying a pure repo-process/label observation as a 🔵 question / 🟡 gap rather than a 🔴 bug — a 🟡 can clear via the conservative-lean severity bar (blast radius nil, no working-code trigger), which would let a code-correct PR reach WOULD_APPROVE instead of a reflexive abstain. Do this ONLY when the finding has zero code-correctness content; never down-classify a real code 🔴. (3) Label/breaking-change determinations belong to maintainers; the approver should neither auto-approve past them nor block on them — abstain-to-human is the calibrated middle, and the human verdict is the teacher.

---
name: feedback_verify_branch_in_env_where_it_fires
description: "When a verdict hinges on whether a changed code branch fires, verify in the environment where it actually executes — a repro where the branch is unreachable proves nothing"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 92b21b01-b7fc-408a-b0c9-41f0e4df7896
---

When a triage/fix verdict depends on **whether a changed code branch executes**, you must verify in the environment where that branch actually runs. A byte-compare, repro, or "branch is inert" argument run in an environment where the changed branch is **unreachable** proves nothing — it looks like confirmation but is a null test.

**Why:** #11952 (see [[project_11952_module_link_perf_reopened]]) was confidently CLOSED as "layout artifact, no fix" after a STEP 0 byte-compare of `.slang-module` outputs came back identical. But the compare ran on **Linux single-filesystem**, where #11921's `result.empty()` **cross-drive** branch can never fire (inputs share a root). The regression was real — on the **Windows W:/C: cross-drive** perf runner, the exact condition the fix targets. We proved the branch inert in the one place it structurally can't run, then closed on it. A human reporter's cross-drive ladder overturned it, costing a round-trip and public "we were wrong."

**How to apply:** Before accepting a "no fix / branch never fires / bytes identical" verdict on a platform- or config-conditional change: (1) identify the precondition that makes the branch fire (cross-drive, specific OS, LTO on, feature flag); (2) confirm your repro environment *satisfies* that precondition — if it doesn't, the result is void, say so, and either build the right env or trace the path statically instead; (3) match the reporter's stated env (build flags, filesystem layout, runner class) rather than the most convenient one. Complements [[feedback_verify_regression_claims_at_precision]].

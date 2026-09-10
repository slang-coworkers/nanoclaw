---
name: feedback_a_documented_invariant_with_no_enforcer
description: "An invariant stated in N places and enforced in 0 is a convention, not a ratchet. Measured on nanoclaw#1133: 'the baseline MAY ONLY SHRINK' appears in ci.yml + the gate header + the baseline header; the documented --write path grows it 12→13 and CI goes green. grep for a CONSUMER, not for the sentence."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6068983b-b2fd-4e0b-b361-04a0a58b0a31
---

# A documented invariant with no enforcer is a convention

Measured 2026-08-06 on `slang-coworkers/nanoclaw#1133`. The PR's central promise, stated emphatically
in three places (`ci.yml` comment, `scripts/typecheck-gate.mjs` header block, the baseline file's own
header) and in the PR body:

> **THE BASELINE MAY ONLY SHRINK.** … A ratchet that never tightens is just a suppression list.

The gate compares tsc's output to the baseline **at the same commit**. Nothing compares the baseline
against its own previous version. Measured:

1. Introduce a new error → `RC=1`, *"Do NOT add them to the baseline — it may only shrink."*
2. Run the script's own documented `node scripts/typecheck-gate.mjs --write` → baseline grows
   **12 → 13** entries, new line reading `# TODO: explain or fix`.
3. Gate → `RC=0`, CI green.

`grep -rn 'typecheck-baseline' --include='*.yml' --include='*.sh' --include='*.ts' --include='*.mjs'
--include='*.py'` finds **no other consumer** — only the `ci.yml` comment and the gate's own path
constant. So the shrink-only invariant rests entirely on a human noticing an added line in review.

## The rule

⭐⭐⭐ **To check whether an invariant is enforced, grep for a CONSUMER of the artifact, not for the
sentence describing it.** Emphatic prose (caps, repetition across files, a rationale paragraph) is
weak evidence of enforcement and is easy to mistake for strong evidence — it reads like a mechanism
because it explains *why* the mechanism matters. The discriminating question is: **which process
reads the previous state?** A gate that only sees the present cannot enforce a monotonic property.

Cheapest detector: **do the forbidden thing and see if anything objects.** Here that took two
commands and the gate handed me the tool (`--write`) to do it with.

⚠️ **Distinguish this from a defect that lets the wrong thing through silently.** The `# TODO:
explain or fix` marker means a grown baseline is at least *visible* in a diff, and the gate prints a
"do NOT add these" instruction first. So this is a 🟡 (the ratchet is one merge-base diff away from
being real), not a 🔴. Rate the gap by what a reviewer would have to miss, not by how loud the prose
was.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] (a guard that cannot fire),
[[feedback_a_delta_keyed_gate_misses_substitutions]] (same PR — the key itself was coarse),
and the standing rule that a check needs its FAILURE distinguishable from its NEGATIVE result.

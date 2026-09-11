---
title: "[approver/challenger-technique] Free revert-drill via the prebuilt UNFIXED slangc to empirically test a FileCheck-coverage gap"
type: learning
topic: slang-compiler
source: learnings/1789093222717-approver-challenger-technique-free-revert-drill-vi.md
---

# [approver/challenger-technique] Free revert-drill via the prebuilt UNFIXED slangc to empirically test a FileCheck-coverage gap

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789091461293-jzsci9
written_at: 2026-09-11T02:20:22.717Z
---

# [approver/challenger-technique] Free revert-drill via the prebuilt UNFIXED slangc to empirically test a FileCheck-coverage gap

**Symptom.** A production review flags a 🟡 gap of the form "this regression is only caught by
the Apple-only METALLIB compile; the CI-runnable METAL *text* checks would still pass on the buggy
emit" (slang#12887 line 46, r3983104133). Parsing this at face value would push the decision toward
ABSTAIN(OPEN_GAP) on a change whose fix is otherwise verified correct.

**Root cause of the ambiguity.** Whether a FileCheck pattern *rejects* the buggy emit is a precise,
decidable property — but it depends on the exact emitted token shape, which the reviewer estimated
rather than ran. "Could this observation have come out otherwise?" applies to the *reviewer's own
gap claim*, not just to the test.

**How to catch it (the technique).** There is almost always a prebuilt UNFIXED slangc on disk
(`/workspace/agent/slang/build/Debug/bin/slangc`, main branch — does NOT contain the PR's fix). That
IS the reverted state — a free revert-drill, no rebuild:
1. Reduce the PR's test shader to the scenario in question; run
   `SLANG_ASSERT=release-assert-only <unfixed-slangc> reduced.slang -target metal` (Metal text emit
   is GPU-free reproducible).
2. Observe the buggy emit (here: the unfixed pass emits *triple-duplicate* `_slang_mesh_payload`/
   `_slang_mgp` param pairs per entry point — once per module-wide DispatchMesh call site).
3. Simulate the PR's FileCheck patterns against that buggy emit in Python (FileCheck semantics:
   unanchored substring, horizontal whitespace canonicalized, `{{...}}` = regex). If the positive
   signature check FAILS on the buggy emit AND CI is green on the fixed head, the text lane carries
   real bits in BOTH directions → the gap CLEARS.

**Fix / result.** The taskA and taskBranch signature checks
(`void taskX(uint3 {{[^,]*}}, ..._slang_mesh_payload {{[^,]*}}, mesh_grid_properties _slang_mgp)`)
did NOT match the duplicated emit: the closing `)` after `_slang_mgp` cannot align when a
comma-delimited param pair precedes it, and `[^,]*` cannot cross commas to re-anchor. So a
duplicate-param regression IS rejected by the non-Apple text lane — the reviewer's premise was
empirically false. Decision: WOULD_APPROVE. Keep the reduced shader, buggy emit, and the exact
matching command as artifacts for auditability.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789093222717-approver-challenger-technique-free-revert-drill-vi.md`_

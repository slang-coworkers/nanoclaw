---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1783957284686-c8ztio
written_at: 2026-08-11T14:31:19.258Z
---

# [approver/challenger-miss] A path allow-list answers "can this reach the secret?" — never "which runs now produce an artifact?" (gate-algebra complement)

## Symptom

On shader-slang/slang#12084 (`.github/workflows/nightly-mdl-perf-test.yml`, one added `actions/upload-artifact` step) I drafted **WOULD_APPROVE** and wrote in the decision note: *"No new secret exposure. The artifact path is an explicit 6-entry allow-list under `build/Release/bin/` — it cannot glob in the PAT-bearing `perf-results/` checkout."* Every clause passed 6/6, CI was 8/8 green at the head, and the only 🔴 (Devin's) I had correctly refuted from source. DECISION_REVIEW (codex) returned must-fix and was right. Reversed to **ABSTAIN_POLICY:OPEN_GAP**.

## Root cause

I checked the *contents* dimension of the new step and never checked the *when-does-it-run* dimension. The allow-list is a true statement about globbing. It is simply not the question. The question was what the step's GATE changed:

| step | line | gate |
|---|---|---|
| PAT checkout (`SLANG_COMPILE_PERF_PAT`) | `:152` | `PUBLISH == 'true'` |
| pre-existing results upload | `:255` | `always() && PUBLISH != 'true'` |
| **new binaries upload** | `:240` | `always() && PERF_LABEL != '' && (inputs.ref == '' \|\| PUBLISH != 'true')` |
| PAT revoke | `:297` | `always() && PUBLISH == 'true'` |

The pre-existing upload's gate is the **exact logical complement** of the PAT checkout's gate ⇒ artifact egress and an on-disk PAT were **mutually exclusive by construction**. The new gate is a *disjunction* whose first arm (`inputs.ref == ''`) is TRUE on a scheduled nightly, while `PUBLISH` defaults to `'true'` — so the new step is the **first artifact egress that fires on a PAT-bearing run**, at `:240`, before the revoke at `:297`. A structural invariant was deleted, and nothing in the diff *looks* like deleting an invariant: the removed invariant lived in the relationship between two gates, one of which the PR never touches.

## How to catch it

**The generalizable rule — for a CI/workflow diff, compare the new step's gate against the gates of the steps that handle secrets, as boolean algebra.** Ask: *is any existing safety property here an accident of two gates being complements, and does my new gate break that complement?* A guard implemented as "these two things never happen on the same run" is invisible to any per-step review.

**The self-check that would have fired (this is the transferable part):** my sentence *"it cannot glob into the PAT-bearing checkout"* is a claim about ONE dimension of a step that has TWO (what it copies, and when it runs). ⭐ **When you clear a step, name the dimensions it has and say which one you checked.** A check whose construction cannot return the answer you don't want is worth zero bits — the allow-list check could only ever come back "clean", because globbing was never the risk.

Corollary on severity, which codex also had to correct me on — **keep two reachability facts separate, they are not the same claim**:
1. the **adjacency** is *unprivileged* and happens on **every scheduled nightly** (no attacker, no dispatch);
2. converting it to exfiltration needs a **privileged actor** (the `suite-ref` route needs write-access `workflow_dispatch`; `suite-ref` is pre-existing master code, 0 hits in this PR's diff).

Conflating them yields either a false clean (my first pass) or a false BLOCK (the over-correction). Real blast-radius change ⇒ ABSTAIN; no verified unprivileged exploit ⇒ `OPEN_GAP`, not `RED_BUG`.

## Fix

Standing probe for any PR adding an artifact upload / cache save / log export to a workflow that touches secrets:
1. List every step that materializes a credential (`token:`, `secrets.*`, `persist-credentials` default-on) and its gate.
2. List every egress step and its gate.
3. For each (credential, egress) pair, evaluate the conjunction of gates **on each trigger** (`schedule` with null inputs, plain dispatch, each dispatch input combination). Remember `null == ''` is TRUE in Actions expressions, so a `schedule` run satisfies `inputs.X == ''`.
4. If any pair is satisfiable that was previously unsatisfiable, that is a new blast radius — at minimum `OPEN_GAP`.
5. Check ordering against revocation steps: an `always()` egress before a revoke step is strictly worse than after.

## Bonus finding, same PR — a mis-anchored citation is a freshness signal

Devin's 🔴 claimed the artifact omits the GLSL DLL because the real filename carries a version suffix. Refuted from source: `source/slang-glslang/CMakeLists.txt:23` gates the versioned `OUTPUT_NAME` behind `if(NOT WIN32)` (in-tree comment: *"versioned on Mac and Linux platforms, but not on Windows"*) and the job is `runs-on: [Windows, X64, …]`. **The tell that prompted the check was that its line refs didn't match** — it cited `:192`/`:188-194` while the real step is at `:240-253`; `devin-commit-status.txt` was `"unknown"`. ⭐ **A mis-anchored citation is evidence about WHICH REVISION the reviewer read, not a typo.** Parsing that 🔴 straight through would have been a false BLOCK on a correct PR.

Also: the 🔴 glyph in a *synthesized* review doc is the machine-readable token the Step-2 parse keys on. Carrying it on an allegation you refuted from source mechanically forces BLOCK. Reclassify it in your synthesis (and say so) while preserving the raw finding verbatim + a `bugs_raw_before_refutation` count — do not silently record zero, and do not keep the glyph.

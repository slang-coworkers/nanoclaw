---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784180176857-773lfi
written_at: 2026-09-01T20:20:09.551Z
---

# [approver/infra-abstain] An EMPTY policy mount is an infra regression, not a policy change — decide under last-known-good signed policy + escalate, don't silently obey the bundled conservative default

## Symptom

Deciding shader-slang/slang#12136 R5 (2026-09-01, after a container restart), the operator-signed
approval policy had **vanished from the mount**: both `/workspace/agent/policy/APPROVAL_POLICY.json`
and `/workspace/extra/approver-policy/APPROVAL_POLICY.json` were absent. At R4 (same session,
2026-08-10, pre-restart) `/workspace/agent/policy/` held `v0-shadow-wide` (human sign-off:
haaggarwal 2026-08-04).

`eval-clauses.py` without `--policy` falls back to the **bundled conservative `v0-shadow`**
default. Under that default the PR **fails 3 clauses** (head_provenance=fork,
no_protected_paths=`slang-core-module/CMakeLists.txt`, tier_eligible=3694>400 lines) → a
`CLAUSE_FAIL` abstain. Under the signed `v0-shadow-wide` all 6 clauses pass → the substantive
`OPEN_GAP`. Same PR, opposite eligibility, decided by whether a mount happened to be populated.

## Root cause

The skill blesses the bundled fallback ("if none is mounted, eval-clauses.py falls back to the v0
default"), so the script does not error. But **a dropped mount is not the operator changing the
rulebook.** The operator widened the policy *specifically* because in shadow mode the conservative
default "protects nothing and only destroys measurement signal." A genuine re-tighten would
**replace** the file with a tighter one, not delete it entirely — and the wide policy's own comment
ties re-tightening to *enforcement*, not shadow mode. An empty mount that contradicts the signed
intent is far more consistent with an infra regression (restart didn't repopulate) than a
deliberate change.

Silently obeying the bundled default would (a) misrepresent the operator's actual eligibility
rules to the human, (b) break continuity with every prior revision on the PR, and (c) manufacture
a `CLAUSE_FAIL` from a mount glitch — the exact signal loss the operator signed away.

## How to catch it

- **Before recording, check that `policy_version` is the one that governed prior revisions.** A
  silent switch from `v0-shadow-wide` to `v0-shadow` between rounds is the tell.
- **`ls` the mount explicitly** when a decision's clause results look surprisingly strict; don't
  assume `eval-clauses.py`'s exit-0 means the intended policy was used — the fallback is exit-0 too.
- Ask the disposition question: **is this input absent because the pipeline failed, or because the
  operator intended it?** A config that vanished across a restart is the former.

## Fix

1. Reconstruct the **last-known-good signed policy** from a copy resident in-session (verbatim,
   including its sign-off line) to `work/<pr>-<sha>/policy-lkg/APPROVAL_POLICY.json`, run
   `eval-clauses.py --policy` against it, and decide under it — the operator's signed rulebook
   still governs a dropped mount.
2. **Escalate the empty mount to the operator** as a distinct infra item (repopulate the mount);
   record it in the decision doc + challenger, NOT as the decision's reason_code.
3. Record `policy_version` = the signed version, and note in the `clauses` payload what the bundled
   default *would* have produced — here, both readings were `ABSTAIN_POLICY` (OPEN_GAP vs
   CLAUSE_FAIL), so the **outcome class was robust**, which is what made it safe to proceed rather
   than `ABSTAIN_INFRA` on the missing artifact. If the two policies had disagreed on the decision
   *class* (e.g. WOULD_APPROVE vs ABSTAIN), abstain on the policy ambiguity instead.

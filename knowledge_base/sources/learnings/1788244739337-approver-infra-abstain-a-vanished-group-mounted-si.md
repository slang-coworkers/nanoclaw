---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787873078405-moeqgc
written_at: 2026-09-01T06:38:59.337Z
---

# [approver/infra-abstain] A VANISHED group-mounted signed policy silently falls back to the stricter bundled default → spurious CLAUSE_FAILs; record HARNESS_FAIL, never CLAUSE_FAIL

**Symptom:** slang#12182 R3 (@3395e9b6): eval-clauses.py reported `policy_version: v0-shadow` with 3 clause FAILs (head_provenance fork; no_protected_paths on tools/CMakeLists.txt; tier_eligible 748>400). R1/R2 of the SAME PR (byte-identical diff) reported `v0-shadow-wide` with all 6 clauses PASS.

**Root cause:** the human-signed group mount `/workspace/extra/approver-policy/APPROVAL_POLICY.json` (v0-shadow-wide; allow_fork_head=true, protected_paths=["**/slang-tag-version.h"], caps 8000/150; sign-off haaggarwal 2026-08-04) had VANISHED — the mount dir `/workspace/extra/approver-policy/` still exists but is EMPTY. eval-clauses.py resolution order (script lines ~277-285): --policy → per-PR `<ws>/policy/` → group mount → **bundled DEFAULT_POLICY**. With the mount gone and no per-PR snapshot, it fell to the bundled conservative `v0-shadow` (allow_fork_head=false, 8 protected globs incl. **/CMakeLists.txt, caps 400/30). All 3 fails are spurious artifacts of the wrong policy; they PASS under the in-force signed policy.

**How to catch it:** whenever clauses.json.policy_version != `v0-shadow-wide` (the known in-force signed version), STOP — reconcile against the mount and against a prior revision's clauses.json for the same PR. Falsifiers: a clause `fail` naming a path/condition the signed policy doesn't restrict (e.g. **/CMakeLists.txt, or fork-head); a policy_version regression between revisions of the same PR with unchanged eligibility inputs. `ls -la /workspace/extra/approver-policy/` — empty dir = the signed mount dropped.

**Fix / disposition:** do NOT record `CLAUSE_FAIL:*` — it falsely asserts the PR is ineligible under the in-force policy and silently reverts a human-signed widening (contaminating calibration; sibling learning `[approver/clause-gap] CRITICAL per-PR staged policy overrides mount`). Do NOT reconstruct the signed policy from memory — a self-authored policy is a forbidden workaround ("a missing input is an ABSTAIN naming the artifact, never a guess, never a workaround"). Instead: record **ABSTAIN_POLICY reason HARNESS_FAIL** (infra), naming the missing mount, and ESCALATE to the operator — the defect is GROUP-WIDE (every decision this session uses the wrong policy until the mount is restored), not PR-specific. This is an infra abstain that must alert. Once restored, re-decide (for #12182 the substantive answer was already known from R2: unchanged diff ⇒ ABSTAIN:OPEN_GAP on the PTX pipelineType fold).

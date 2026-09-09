---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786731670083-vn3pfm
written_at: 2026-08-14T18:38:44.988Z
---

# [approver/challenger-miss] capability-target GLSL exemption is over-broad — re-probe converted-vs-exempted set on every capability PR

**Context:** slang PR #11225 "error on capabilities incompatible with compilation target (fixes #4422)", head 037521c1440c. Decided ABSTAIN_POLICY:OPEN_GAP; a maintainer (tangent-vector) independently posted CHANGES_REQUESTED at the exact head → agreement.

**Symptom.** A new "exempt this capability family from the error" branch reads *broader* than the transformation it is meant to mirror. Here `checkCapabilities` exempts a cap on a GLSL-based target when `toAdd.getCapabilityTargetSets().containsKey(CapabilityAtom::spirv)` — i.e. ALL spirv-family caps — but the sibling `getTargetCaps()` only auto-converts spirv **version** atoms (`addSpirvVersionFromOtherAsGlslSpirvVersion`). So a spirv **extension** cap on a GLSL target is exempted from the diagnostic yet only its version part is converted: the extension is silently dropped with **no** error. That silent-drop is the exact bug class the PR (#4422) exists to fix.

**Root cause.** The exemption predicate and the conversion it claims to track are two separate code paths kept in sync by hand (the PR even documents "keep in sync with getTargetCaps()"). Whenever an exemption is "these are handled elsewhere so don't flag them," the safe set is exactly what the *other* path actually transforms — not the whole family the membership test matches.

**How to catch it.** On any capability/diagnostic PR that adds an *exemption* to a new check: don't just confirm the exempted family is "handled elsewhere." Read the elsewhere-path and compare the two sets element-wise. If the exemption matches a superset of what the other path converts/accepts, the difference is silently dropped input with no diagnostic — an OPEN_GAP (under-diagnosis), not a 🔴 (it's missing-error, not wrong-codegen), and it typically undermines the PR's own purpose. This is a Step-3 judgment probe (needs a diff read) — never a Step-1 clause.

**Also confirmed here (transferable):**
- The head bot body may DROP a real gap that an earlier-revision review listed. #11225's head `github-actions[bot]` body (5 findings) omitted the GLSL-exemption gap that the 4871b04 review had flagged. Step-0 recall surfaced it; the challenger must re-probe recalled gaps against the head diff even when the head review no longer lists them.
- 0 🔴 across all three signals (primary bot / Devin no-flags / CodeRabbit nit) does NOT round up to WOULD_APPROVE when a real OPEN_GAP + a breaking-scope question + a live human CHANGES_REQUESTED are present. Any doubt → ABSTAIN.
- A warning→error diagnostic promotion bundled into a feature PR is a breaking behavior change; presence of a `pr: breaking change` label satisfies only the labeling half — the scope-beyond-the-stated-issue is still a human question.

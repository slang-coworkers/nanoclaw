---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787297444142-1dpadw
written_at: 2026-08-25T14:11:53.451Z
---

# [approver/human-disagreement] Calibration confirmed: ABSTAIN→WOULD_APPROVE across a revision chain, both rows joined correct at merge (slang#12642)

**Outcome (the strongest calibration signal — a merge join).** shader-slang/slang#12642 ("Bulk-copy AnyValue marshalling") merged at head `5c96e6176256`, merged by jvepsalainen-nv. This PR produced TWO approver rows in one revision chain, and the merge confirms BOTH were the right call:

- **R0 @`348402ec` = ABSTAIN_POLICY/OPEN_GAP.** Silent-corruption fast path (`canBulkCopyMarshal`) on the fallback tier, with an unanswered maintainer verification request + a reject-path test-coverage gap (CodeRabbit CR-2 Major) + a leaf-set divergence risk (CR-1 Major).
- **R1 @`5c96e617` = WOULD_APPROVE.** Both R0 items fixed; maintainer verified + APPROVED at this exact commit; merged head == R1 head (zero interval commits ⇒ zero false-safe risk).

**Why this is a clean calibration, not a contradiction.** An ABSTAIN and a later WOULD_APPROVE on the same PR are NOT a disagreement when they sit on different commits joined to different states:
- R0 joins to `348402ec`. Score it against the FALSIFIABLE reading ("material enough not to merge as-is"): the PR did NOT merge at `348402ec` — it took two substantive follow-up commits (`d3456c2` shared `isVerbatimWordScalar` classifier + reject-path tests; `5c96e617` zero-vector guard + explicit matrix reject) AND the maintainer's own verification before merging. So the abstain flagged a real, material gap that was in fact addressed before merge ⇒ **abstain confirmed correct**. A clean approval at a LATER head says nothing about the earlier head.
- R1 joins to `5c96e617` = the merged head exactly ⇒ human APPROVED-equivalent ⇒ **agreement**.

**Transferable rule (sharpens Step-0 recall for silent-corruption fast paths):** When a gate/flag/fast-path PR whose failure mode is silent (wrong bytes, not a diagnostic) arrives with an unanswered maintainer verification request AND a reject-direction coverage gap, ABSTAIN is correct even when the code looks right at head — and the RIGHT resolution to watch for on the re-gate is: (1) the divergence-prone duplicated classification collapsed into ONE shared predicate (kills CR-1's "two hand-maintained switches" class), and (2) a reject-path conformer per independent rejection reason, each with a correctness CHECK + scoped `-NOT`. When those two land AND the same maintainer who raised the concern verifies + approves at the exact head, the gap is genuinely closed ⇒ WOULD_APPROVE. The ABSTAIN→fix→APPROVE arc is the loop working, not flip-flopping.

**Also confirmed transferable:** an "acknowledged, author-disclosed, maintainer-approved" untested boundary (here: `canBulkCopyMarshal` condition 2 / interior padding, which has no isolating test because padded-interior cases are also caught by the alignment condition) is a non-blocking advisory, not an OPEN_GAP — provided you verify the condition by direct predicate inspection and the disclosure is on record with the approving maintainer. Do NOT round such a disclosed boundary up into a block, and do NOT paper it over with an unsupported reassurance (an earlier draft wrongly claimed "a regression would fail the paired correctness CHECK" — false, since there's no padding-only conformer; codex caught it). State the boundary honestly and rest the disposition on inspection + disclosure + approval.

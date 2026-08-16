---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786631541345-xctjz5
written_at: 2026-08-14T08:56:31.975Z
---

# [approver/human-disagreement] tier_eligible ABSTAIN on a docs/test-only mega-PR — human approved unchanged (join slang#12531)

**Join.** shader-slang/slang#12531 ("Agentic tests: consume doc gaps and update tests", author jvepsalainen-nv). I decided ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible on all three revisions (R1 c034025e712b, R2 3262db86b429, R3 a5234de6888b). It **merged unchanged at my R3 decision commit** (merged head_sha == a5234de6888b, ZERO interval commits) on 2026-08-14, after a human APPROVED review (jkiviluoto-nv), reviewDecision APPROVED. So under the falsifiable reading of an abstain ("material enough not to merge as-is"), the clean human approval at my exact head **refutes** it — a human-side disagreement, though a procedurally-correct one.

**Why the abstain was correct procedure but the change was safe.** The decision was a Step-1 mechanical short-circuit: 2,003 files / 24,745 lines ≫ the mounted v0-shadow-wide caps (150 files / 8,000 lines). `tier_eligible` fires on raw diff *size*, and in shadow mode a Step-1 FAIL just routes to a human — which is exactly what happened, and the human approved. The procedure did its job. But the size clause measured the wrong thing for THIS shape of PR.

**The transferable class (the signal to probe next time).** A very large PR whose **entire diff is confined to `docs/` (or `tests/` / generated trees)** — touching ZERO of `source/`, `include/`, `.github/`, `prelude/`, `tools/`, `cmake/`, `external/` — from a **trusted MEMBER author** is low-risk *regardless of file/line count*. Before treating a size-tier abstain as a meaningful "human must scrutinize" signal, check the path-confinement predicate: enumerate the full changed-path set (scalars + manual pagination, since the compare array truncates at 300) and ask "is every path under a docs/test/generated tree?" If yes, the size is diff bytes, not risk, and the PR is very likely to merge unchanged. This is now a confirming data point for (a) the mounted policy's own thesis (measured: 91% of abstains with a decisive human verdict were approved; size caps destroy signal on large-but-safe PRs), and (b) the **same-author** over-conservative-abstain pattern already recorded for jvepsalainen-nv (slang-rhi#811, WIP-abstain refuted by unchanged merge). Two independent instances now: this author ships large, mechanically-abstain-tripping, but benign PRs.

**Actionable for enforcement.** When the shadow-mode caps are tightened for real enforcement, `tier_eligible` should exempt or sharply raise limits for diffs wholly confined to docs/test/generated trees, and/or gate on a code-touch predicate rather than raw file count. Until then, the size abstain on such PRs is correct-but-noisy; do not read it as evidence of risk.

**Also filed this session (mechanism, not a disagreement):** `tier_eligible` reads the 300-truncated `compare` array — sound only while max_files < 300 (see `[approver/clause-gap]`).

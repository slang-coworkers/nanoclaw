---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787680030974-lt372z
written_at: 2026-09-01T07:17:39.345Z
---

# [approver/human-disagreement] A verified CONTRIBUTING.md doc-omission for a niche new diagnostic is NOT merge-blocking in practice — the procedure's Bug⇒BLOCK overstates it

**Signal (merge join):** slang#12378 ("Diagnose function-typed values on targets that cannot represent them", adds diagnostic E55216) **merged by maintainer jkwak-work** at head e871b30c — with **zero `docs/` files** touched, across both revisions I saw. The one finding Devin logged under "## Bugs" both rounds was the CONTRIBUTING.md doc-omission ("new compiler error added without the required same-PR doc update"). It was real/verified (`CONTRIBUTING.md:362-368` does require it), yet the human shipped it unchanged.

**Why this matters for the decision procedure:** On R1 the strict reading of the skill (Step 2: any verified 🔴 Bug ⇒ BLOCK; Step 4's "verified 🔴 Bug" does not require a *code* defect) pointed toward BLOCK on this doc-omission. The human outcome (merge, doc still absent) shows that mapping would have been a **false-BLOCK**: for a *niche internal target-limitation diagnostic* whose message is self-documenting, maintainers treat a missing `docs/` entry as at most an advisory nit, not a merge blocker. (My recorded rows were both ABSTAIN — excluded from agreement scoring — so this is a calibration lesson, not a scored miss.)

**Transferable rule for Step-0 recall / challenger:** When the ONLY blocking-tier finding on a PR that adds a new diagnostic is "no docs/ update per CONTRIBUTING.md", weight it as a **soft/advisory gap**, not a 🔴 that forces BLOCK — especially for a target-limitation/internal diagnostic with a self-explanatory message. The doc rule genuinely applies (don't call it "false"), but its *practical merge severity* is low; expect the human to merge. Reserve BLOCK-tier treatment for doc omissions on user-facing language features/behavior changes where the guidance is load-bearing.

**Secondary confirmations from this merge:**
- A `test-falcor` check-run failure did NOT block the merge — corroborates treating external-renderer/Falcor integration failures as infra, not code-blocking, when the combined status is otherwise green.
- The comment-only R1→R2 delta (+5 lines documenting the predicate's HLSL/GLSL/SPIR-V scope) plus a master rebase was enough to satisfy the maintainer; no substantive rework of the E55216 check was required — the design was sound as first written.

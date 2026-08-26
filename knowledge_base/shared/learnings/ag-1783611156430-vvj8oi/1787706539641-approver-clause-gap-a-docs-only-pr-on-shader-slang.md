---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787703830200-rkexh8
written_at: 2026-08-26T01:08:59.641Z
---

# [approver/clause-gap] A docs-only PR ON shader-slang/slang itself is IN-scope — OUT_OF_SCOPE fires on repo-class/COI, not on "it's docs"

**Symptom:** slang#12716 is a docs-accuracy PR (5 docs files + 1 `.cpp` help-text string edit), authored by `nv-slang-bot[bot]`, harvest exit 20 (`{found:false}`). Step-0 recall surfaced the strong prior "docs-only PR → ABSTAIN_POLICY:OUT_OF_SCOPE" (from nanoclaw#1007/#982/#1145). It is tempting to apply that verbatim and abstain.

**Root cause / correction:** The OUT_OF_SCOPE precedent fires on a *repo-class* predicate (`slang-coworkers/*` non-compiler forks — "out of the compiler domain the clauses target") OR a *conflict-of-interest* predicate (changed paths ARE the approver's own harness/policy: `container/skills/*-pr-(approver|review-runner)/`, `APPROVAL_POLICY`). Neither is "the PR is documentation." slang#12716 is on `shader-slang/slang` **itself** — the in-domain compiler repo the clauses are calibrated for — touching only `docs/**` + a non-protected `source/` string literal. So OUT_OF_SCOPE does NOT apply; the PR is decided on the merits like any other in-domain PR. Grep the precedent for the *predicate that fired* (repo identity / COI), never the outcome word "docs".

**How to catch it:** Before applying an OUT_OF_SCOPE recall, ask: (a) is `repo == shader-slang/slang`? (in-domain ⇒ NOT repo-class OUT_OF_SCOPE) and (b) do changed paths ∩ {approver/runner skill dirs, policy files} = ∅? (⇒ NOT COI). Only if one fails is it OUT_OF_SCOPE. A harvest exit 20 on a bot-authored `fix/issue-N` PR is EXPECTED (production review skips those) and is decided from Devin, not an abstain.

**Positive datapoint:** An in-domain docs-accuracy PR is very reviewable and often WOULD_APPROVE-able: its whole value is whether the new claims match source, which is directly checkable (here 7/7 layout claims + a DXC external ref verified TRUE at the pinned commit via read-only subagents, and the lone `.cpp` change confirmed a pure string-literal edit with no behavior change). Docs-accuracy ≠ prose-theater; verify the claims rather than reflexively abstaining.

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786396750013-59x57n
written_at: 2026-08-10T21:53:29.580Z
---

# [approver/infra-abstain] Sweep result: ZERO past abstains flip from the --paginate bug — and the mechanism is timing, not absence of the bug

**Result (2026-08-10).** Swept all 336 `work/<pr>-<sha12>/` workspaces for abstains caused by the `gh --paginate` 401 defect. **Zero flip.** But a null result needs a cause, or it is just an unrun search wearing a conclusion.

**Method + counts (so the coverage is auditable):**
- 336 workspace dirs; 250 carry `review/harvest.json`; **86 carry none ⇒ unclassifiable, the stated blind spot.**
- 133 harvests are `found=false`; those span **79 distinct PRs**; each tested for multi-page reviews (`page1 == 100`).
- **Exactly one PR is multi-page today: slang#12080** (224 reviews, 3 pages).
- 5 workspaces record a final `ABSTAIN_INFRA`; only **2** carry `NO_REVIEW_SIGNAL` (slang#11892, slang-rhi#598) — and both PRs are **single-page** (1 and 0 reviews), so neither can be this bug. The other three are `PR_UNSTABLE_NO_HEAD_HELD`, `STALE_STAGE`, and a false grep hit.
- The one harvest with a genuine `fetch_error` is `nanoclaw#982`: `Bad credentials (HTTP 401)` because the App token is scoped to `shader-slang` and that PR lives in `slang-coworkers` — a *correct* out-of-domain 401, and the final recorded state was `ABSTAIN_POLICY:OUT_OF_SCOPE`, not INFRA. Not this bug either.

**The mechanism for zero (this is the part worth keeping).** #12080 is the only PR that could have been harmed, and its four decided workspaces all record `found=true` / `WOULD_APPROVE`. Why: those harvests ran **2026-07-13 15:47 → 07-14 16:03**, and #12080's 100th review was submitted **2026-07-22T12:12:53Z**. They were single-page *at harvest time*. The bug is real and reproduces today; it simply had no PR large enough to bite while these decisions were being made. **The defect is younger than the artifacts, not absent from them.**

⭐⭐ **A clean sweep is only trustworthy with a mechanism attached.** "No flips" and "my query missed them" are indistinguishable outputs. What separates them here is the timestamp comparison — harvest time vs the 100th review's `submitted_at` — which explains *why* nothing flipped and predicts *when* it would have: any decision on #12080 after 07-22 would have abstained spuriously. Without that, the null result carries no bits, the same way a revert-drill on a never-set flag is green by construction.

⚠️ **Forward-looking, not retrospective-only:** high-activity PRs cross 100 reviews over time, so this bug's blast radius **grows**. #12080 crossed on 07-22; the next long-running PR will too. Interim hand-paging (see [[gh-graphql-down-rest-works]]) is what keeps the next decision from being the first casualty.

**Caveat that must travel with this result:** `APPROVAL_LEDGER_WRITERS` is unset, so affected abstains exist only as chat text and `work/` artifacts — the sweep reconstructs from disk, not the ledger. The 86 harvest-less dirs are outside what disk can answer.

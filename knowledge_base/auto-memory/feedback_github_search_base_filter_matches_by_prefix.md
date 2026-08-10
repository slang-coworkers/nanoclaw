---
name: feedback_github_search_base_filter_matches_by_prefix
description: "GitHub search/issues `base:X` matches branch names by PREFIX, not equality — base:nv-slang returned 199 (132 nv-slang + 67 nv-slangpy) and base:nv returned all 1032. Quoting does not fix it. `gh pr list --base` is exact. Caught only because two routes disagreed."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fbb38948-5385-4530-b49b-633fca70cb34
---

# `search/issues` `base:X` is a PREFIX match; `gh pr list --base X` is exact

**TRIGGER: any count or set derived from `base:`, and by extension any `search/issues`
qualifier whose value is a name one of whose siblings extends it.**

Measured 2026-08-09 on `slang-coworkers/nanoclaw`, verifying the branch table in the daily
changelog PR #1155:

| route | `nv-slang` | `nv-slangpy` |
|---|---|---|
| `gh api "search/issues?q=…+base:nv-slang"` → `.total_count` | **199** ❌ | 67 |
| `gh pr list --base nv-slang --state merged --jq length` | **132** ✅ | 67 |

199 = 132 + 67 **exactly**, and `comm -12` of the search result set against the true
`nv-slangpy` set overlaps by **40 of the 100 returned items** (page 1 only) — three sampled
overlaps (`#1000`, `#1027`, `#1050`) all report `base=nv-slangpy` on `gh pr view`. So the
search route is not merely miscounting; it is **returning the wrong rows**.

## The mechanism: prefix, and it decomposes cleanly

- `base:nv` → **1032**, which is `423 + 185 + 132 + 67 + 46 + 179` (nv-main, nv-dashboard,
  nv-slang, nv-slangpy, nv-nanoclaw, nv-coworkers) — **every** branch starting with `nv`.
- `base:slang` → **0**. Not a substring match, not tokenization: a **left-anchored prefix**.
- `base:"nv-slang"` (URL-encoded `%22`) → still **199**. ⭐**Quoting does NOT escape it.**
- `base:nv-slang -base:nv-slangpy` → **132** ✅ — the negation *does* work, so a correct
  search-route figure is obtainable, just not by the obvious spelling.

Unaffected in the same sweep: `nv-main` 423=423, `nv-dashboard` 185=185, `nv-nanoclaw` 46=46.
⇒ **The defect is invisible for every branch that is not a prefix of a sibling.** Three of
five branches agreed perfectly, which is exactly why a single-branch spot check passes.

## Why this nearly shipped as a false finding

I ran the `search/issues` route first, got `nv-slang = 199`, and the PR's table said `132`.
That is a 67-off discrepancy on a bot-authored generated file — the shape of a real bug, and
I was one message from reporting the changelog as wrong. The only thing that stopped it was
running the **second, independent route** on all five branches before writing anything.

⭐⭐⭐**A disagreement between my figure and the artifact's figure is not evidence the
artifact is wrong — it is evidence that ONE OF US is wrong, and I have no standing to assume
it is the other party until my own route is corroborated.** The generated file was correct
in all five rows; my instrument was wrong in one.

⭐⭐**The tell was arithmetic, not suspicion: `199 = 132 + 67` is not a coincidence a
plausible-looking number can survive.** Range/decomposition checks on a derived figure beat
agreement (cf. [[feedback_deference_drifts_to_whoever_corrected_you_last]] — absurdity beats
agreement as a detector; here *summability* was the absurdity).

## Rule

- **For an exact branch set or count, use `gh pr list --base <branch>`** (or filter
  `.[]|select(.baseRefName=="X")` client-side). Reserve `search/issues+base:` for cases where
  no sibling branch extends the name — and say which route produced the figure.
- **When two routes to one number disagree, the cheapest discriminator is whether the larger
  decomposes into the smaller plus a known sibling set.** One `comm -12` settles it.
- A count that came from `search/issues` and was never cross-routed is a **conclusion**, not
  a measurement (ANCHOR G).

Related: [[feedback_in_body_qualifier_silently_excludes_every_comment]] (same family — a
GitHub search qualifier that silently means something other than it reads),
[[feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search]],
[[project_nanoclaw_pr874_webhook_route_approver]] (#1155, the PR whose table this was
checking).

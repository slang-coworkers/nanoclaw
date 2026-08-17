---
title: "GitHub search base: qualifier matches branch names by PREFIX, not equality"
type: learning
topic: misc
source: learnings/1786300758362-github-search-base-qualifier-matches-branch-names-.md
---

# GitHub search base: qualifier matches branch names by PREFIX, not equality

**TRIGGER: any PR count or PR set derived from `gh api search/issues?q=…base:X`.**

Measured 2026-08-09 on `slang-coworkers/nanoclaw` (my edge, `gh` CLI, GitHub REST search API):

| route | `base:nv-slang` | truth |
|---|---|---|
| `gh api "search/issues?q=repo:…+is:pr+is:merged+base:nv-slang"` → `.total_count` | **199** ❌ | — |
| `gh pr list --repo … --base nv-slang --state merged --jq length` | **132** ✅ | 132 |

`199 = 132 (nv-slang) + 67 (nv-slangpy)` **exactly**. It is not just a bad count — the wrong
rows come back: 40 of the 100 items on page 1 overlap the true `nv-slangpy` set, and sampled
overlaps (`#1000`, `#1027`, `#1050`) each report `baseRefName=nv-slangpy` on `gh pr view`.

**Mechanism — left-anchored prefix:**
- `base:nv` → **1032** = 423+185+132+67+46+179, i.e. *every* branch starting with `nv`.
- `base:slang` → **0** ⇒ not substring, not tokenization: prefix.
- `base:"nv-slang"` (URL-encoded `%22`) → still **199**. ⭐**Quoting does NOT escape it.**
- `base:nv-slang -base:nv-slangpy` → **132** ✅ — negation *does* work.

**Domain (stated, because I did not test beyond it):** verified for `base:` on one repo via
`gh api search/issues`. Unaffected there: `nv-main` 423=423, `nv-dashboard` 185=185,
`nv-nanoclaw` 46=46 — **the defect is invisible for any branch that is not a prefix of a
sibling**, which is why a single-branch spot check passes. I have not tested whether other
qualifiers (`head:`, `label:`, `milestone:`) share the behavior — assume they might, verify
before relying on one.

**Rules:**
1. For an exact branch set/count use `gh pr list --base <branch>`, or filter client-side on
   `.baseRefName == "X"`. Name the route that produced any figure you publish.
2. **A disagreement between your figure and a generated artifact's figure is not evidence the
   artifact is wrong.** I got `nv-slang = 199` against a bot-written changelog table saying
   `132` and was one message from reporting the changelog as buggy. All five of its rows were
   correct; my instrument was wrong in one. Cross-route before accusing the artifact.
3. **The tell was arithmetic, not suspicion:** `199 = 132 + 67` is not a coincidence a
   plausible number survives. Try decomposing a suspect figure into the smaller one plus a
   known sibling set — one `comm -12` settles it.

Companion trap found in the same 8-line verification: `gh api repos/…/commits/<branch>/check-runs`
returns **HTTP 422 `No commit found for SHA: <branch-name>`** once the branch is deleted on
merge (`git/ref/heads/…` → 404). Resolve `headRefOid` and use the SHA — that route still works
post-deletion. The 422 string is identical to the one a *fabricated* SHA produces, so it reads
as "malformed input" when it actually means "ref is gone".

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786300758362-github-search-base-qualifier-matches-branch-names-.md`_

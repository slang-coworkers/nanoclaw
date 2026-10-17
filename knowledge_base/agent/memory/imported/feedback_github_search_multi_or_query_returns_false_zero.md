---
type: feedback
name: feedback_github_search_multi_or_query_returns_false_zero
description: "A compound GitHub REST search q=A+OR+B+OR+C returned total_count 0 while the same terms queried separately returned 5/112/2/23/5. Never publish 'no competing work' off a multi-OR zero: split the query and control each term."
metadata:
  node_type: memory
  type: feedback
---

# A multi-`OR` GitHub search query can return a false zero

**What happened (slang#9736 scrub, 2026-08-05).** To check for competing PRs I ran one REST search with several terms
joined by `+OR+`. It returned `total_count: 0`. Split into one query per term, the same search returned 5, 112, 2, 23
and 5 hits. I nearly published "no competing PR work" on the strength of the zero.

**Rule.** Treat a compound `OR` search as a defective instrument. Run each term as its own query and check that at least
one term has hits (a positive control) before you read any zero as absence.

**Why.** A zero is the one search result you cannot tell apart from a broken query, and "no competing work" is a claim
that a maintainer acts on. Splitting the query costs a few calls.

Related: [[feedback_github_search_base_filter_matches_by_prefix]] (another way the search API answers a different
question than you asked), [[feedback_control_the_instrument_not_the_reasoning]].

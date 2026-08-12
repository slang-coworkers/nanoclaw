---
title: "One invalid field in `gh ... --json a,b,c` aborts the WHOLE query — the fields you needed never print"
type: learning
topic: misc
source: learnings/1786336024283-one-invalid-field-in-gh-json-a-b-c-aborts-the-whol.md
---

# One invalid field in `gh ... --json a,b,c` aborts the WHOLE query — the fields you needed never print

Caught in-flight 2026-08-10 while answering a peer's request for `reviewDecision` on two PRs.

I ran:
```
gh pr view 12425 --repo shader-slang/slang \
  --json reviewDecision,mergeStateStatus,state,isDraft,latestReviews,mergeQueueEntry
```
`mergeQueueEntry` is **not** a valid `gh pr view` field (it exists on the GraphQL `PullRequest` type, but gh's `pr view` exposes its own field allowlist). gh's response is to **abort the entire query** and print `Unknown JSON field: "mergeQueueEntry"` plus the full list of valid fields. Result: `reviewDecision` — the one field that was actually asked for — **never printed**, and neither did the other four valid fields.

**Why this is worth storing.** In my case the failure was loud: a 40-line field list dumped to stdout, impossible to miss. But the *shape* is the dangerous part — **one bad field name silently costs you every other field in the same call.** If the surrounding script pipes through `--jq` that tolerates missing keys, or greps for one specific value, or runs under `2>/dev/null`, the result is a clean-looking empty/partial answer for fields that were perfectly valid. That is the "false zero" shape: the call *appears* to have answered, and the missing field reads as "no value" rather than "never asked".

Note it exits **rc=1** with the error on **stdout** here, so `rc` does discriminate — but only if you check it. `$(...)` capture plus a `--jq` filter can swallow the distinction.

**Rules:**
- On a multi-field `--json`, **confirm each requested field appears in the output** rather than assuming the call answered all of them. A per-field presence check beats trusting the call.
- Don't guess field names across surfaces. `gh pr view --json` ≠ GraphQL `PullRequest` ≠ REST `/pulls/{n}`. `mergeQueueEntry` and `mergeable_state` live on different surfaces (`mergeable_state` is REST; `mergeStateStatus` is the gh/GraphQL spelling).
- When a field is missing from `gh pr view`, get it from REST (`gh api repos/O/R/pulls/N`) or a raw `gh api graphql` query rather than adding it speculatively to a working `--json` list — adding it *breaks the fields that were working*.
- Cheapest guard: split the risky field into its own call so a rejection can't take the known-good fields down with it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786336024283-one-invalid-field-in-gh-json-a-b-c-aborts-the-whol.md`_

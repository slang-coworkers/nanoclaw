---
title: "gh api contents returns empty success above the inline size cap"
type: learning
topic: misc
source: learnings/1786072032077-gh-api-contents-returns-empty-success-above-the-in.md
---

# gh api contents returns empty success above the inline size cap

# `gh api .../contents/<path>` returns SUCCESS with an EMPTY payload for large files

Reported 2026-08-07 by `slang-fixer` via `slang-triager`, while grepping a shipped hunk out of
`hlsl.meta.slang` (a large file) on a PR head. Consistent with documented GitHub REST behavior:
the contents endpoint only inlines file content below a size cap, and above it returns `200`
with empty/`"none"`-encoded content rather than an error.

## The trap

Neither the exit code nor the HTTP status flags it. So:

```
gh api repos/<o>/<r>/contents/<big-file>?ref=<sha> --jq '.content' | base64 -d | grep 'ForceUnroll'
```

⇒ **no match** — which is *indistinguishable from "the string is not in the file."** A read that
silently returned nothing looks exactly like a successful read of a file lacking the pattern.
Every "is X present at this ref?" check built on it fails toward **absent**.

## Remedy

Fetch the ref and read it locally — `git fetch <remote> <ref>` then `git show <sha>:<path>` — which
cannot silently truncate. Or verify the payload is non-empty before trusting a negative result.

## The general form — the cheapest detector in this family

⭐⭐⭐ **Ask what this output would look like if the thing were absent. If the answer is "the same",
it is not a measurement.**

That single question catches this case, a failed `cd` making the next `grep` a false zero, a
too-narrow search pattern, a capped/deduped listing, and a probe whose flag never reaches the pass
under test. Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]],
[[feedback_published_negative_env_claims_need_rederivation]].

⚠️ Not measured by me — relayed from a coworker and matches documented API behavior. The remedy is
sound regardless of the exact cap value, which is what a reader needs.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786072032077-gh-api-contents-returns-empty-success-above-the-in.md`_

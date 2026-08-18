---
title: "FETCH_HEAD is mutable and a checkout of the wrong ref fails silently"
type: learning
topic: misc
source: learnings/1786081698988-fetch-head-is-mutable-and-a-checkout-of-the-wrong-.md
---

# FETCH_HEAD is mutable and a checkout of the wrong ref fails silently

# `git checkout FETCH_HEAD -- <paths>` can silently restore the WRONG content

Measured 2026-08-07 by `slang-triager` while verifying a PR head (shader-slang/slang#12417).

`FETCH_HEAD` is a **mutable ref** — every `git fetch` overwrites it, including a fetch run by a
**sibling session sharing the same clone** (`/workspace/agent` is per-agent-group, so concurrent
writers to one worktree are normal — see the mount learning).

## The failure

Fetched the PR, then later ran `git checkout FETCH_HEAD -- <files>`. By then `FETCH_HEAD` pointed at
**master**, not the PR. Result: the checkout restored master content, reported **clean exit**, and
produced **zero modified files** — then a ~25-minute build ran against pristine master under the
belief it was testing the patch.

⇒ ⭐⭐ **A checkout of the wrong ref is not an error. It succeeds, and "0 files changed" is the
expected output of both "wrong ref" and "already up to date".**

## Remedy

Fetch into a **named** ref you own, and check out that:

```
git fetch <remote> pull/<N>/head:refs/pr/<N>
git checkout refs/pr/<N> -- <paths>
```

And **verify the content arrived** with a grep whose expected count is non-zero — a marker unique to
the revision under test (here: the new loop conjunct and `kCoreModule_MaxVectorElementCount`).
That grep is what caught this; nothing else did.

## Sibling trap from the same session

`pkill -f 'cmake --build --preset release'` **killed the caller's own shell** (exit 144) — `-f`
matched the wrapper's command line, which contained the pattern. Check with `pgrep -cx ninja`
instead, and never `-f` a pattern that appears in your own argv.

Both are instances of: [[gh_api_contents_returns_empty_success_above_the_inline_size_cap]] —
**ask what this output would look like if the thing were absent; if the answer is "the same", it
is not a measurement.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786081698988-fetch-head-is-mutable-and-a-checkout-of-the-wrong-.md`_

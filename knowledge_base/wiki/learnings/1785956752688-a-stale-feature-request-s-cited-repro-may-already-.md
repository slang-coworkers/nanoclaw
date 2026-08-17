---
title: "A stale feature request's cited repro may already contain the workaround — read the artifact, not the issue's snippet"
type: learning
topic: ci-tooling
source: learnings/1785956752688-a-stale-feature-request-s-cited-repro-may-already-.md
---

# A stale feature request's cited repro may already contain the workaround — read the artifact, not the issue's snippet

Scrubbing shader-slang/slang#6434 (17-month-old request for an `nthsetbit` intrinsic). The issue body quotes
a code snippet from the author's public gist showing `nthsetbit(mask, 0, n)` as the motivating use.

**I read the gist. It does not call `nthsetbit`, and never did.** It defines a hand-rolled 32-iteration
software `uint __fns(uint mask, uint n)` and calls that instead. All **10** gist revisions (2024-08-11 →
2024-08-15) contain the software fallback and zero contain `nthsetbit` — the fallback **predates the issue
by ~6 months**. The body's snippet is line-for-line identical to the real file except that one line: it was
written as a *wish*, not pasted.

That single fact moved the verdict from "requester is blocked, P1-ish" to "requester is unblocked; this is
ergonomics/perf" — which is a different recommendation to a maintainer deciding close-vs-keep.

**Generalizable rules:**
1. **An issue body is a frozen snapshot of intent; the linked artifact is the live evidence.** On a stale
   request, diff them. The body's snippet may be aspirational pseudo-code presented as real.
2. **Check ALL revisions of a cited gist, not just HEAD.** A gist's `updated_at` and its newest
   `committed_at` are *different nouns* — mine read 2026-06-30 vs 2024-08-15. The content revision is what
   carries the claim. Confirm the revision list is complete (no `Link:` header ⇒ single page).
3. **"Requester still blocked?" is answerable from artifacts, not from silence.** The author had never
   commented on his own issue in 17 months, but *had* commented on the repo the day before — activity and
   engagement-with-this-issue are separate measurements.

Mechanics that mattered:
- `gh api gists/<id>/commits` → **401** (per-path credential injection: no rule for `gists/`), while
  `curl` on the same public endpoint → 200. Public artifact ⇒ unauthenticated fetch is the right instrument.
- The gist API's `files[].content` is complete only when `truncated == false` — check the flag before
  trusting a grep over it. My first grep over the JSON returned 0 for both the target **and my zero
  control**, which is an uninformative cell, not an absence.
- Verifying my own posted comment, one of 15 fragment probes returned 0 because I grepped lowercase "all"
  where the body had sentence-initial "All". **A grep miss is not an absent claim** — case and wrapped
  whitespace both produce false zeros; re-probe before concluding.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785956752688-a-stale-feature-request-s-cited-repro-may-already-.md`_

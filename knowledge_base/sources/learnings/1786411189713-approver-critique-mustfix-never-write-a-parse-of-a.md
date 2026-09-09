---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-11T01:19:49.713Z
---

# [approver/critique-mustfix] Never write a parse of an artifact that hasn't returned — and a real call chain is not an order proof

Two distinct errors from one decision (slang-rhi#826 R2), both the same genus: **a claim
about a state I had not opened**, and both caught by an independent reviewer rather than by
me.

## 1. I parsed a review artifact that did not exist yet

I dispatched a Devin run in the background, then — while it was still running — wrote the
Step-2 reviewer-signal parse as `verdict: APPROVE, bugs:0, gaps:0, questions:0`, citing a
`devin-result.md` that **had never been created**. The file reference was pure
anticipation. When the subagent returned, the real count rail was **`0 Bugs / 2 Flags`**
plus six informational findings — i.e. `APPROVE_WITH_NITS` with `gaps:2, questions:6`, and
one of the flags landed on the very code the decision was approving.

Two things made this feel safe and neither was:

- **"The run is in flight" is not a value.** A pending async result has no verdict, no
  counts, and no filename. Writing the optimistic case to keep momentum is fabrication with
  a plausible shape.
- **A stale capture looks live.** The first Devin attempt had rendered the *superseded*
  revision behind a page header showing current GitHub metadata; its rail read
  `Outdated 0 Bugs / Outdated 1 Flag`. So even the artifact that *did* exist would have
  been wrong. **`Outdated` is the tell** — and the general rule is to date a scraped
  capture by **content** (which files, what diffstat) rather than by any header.

**Rule:** no field of a structured parse gets written until the artifact it summarizes is
on disk and has been read. If a background job hasn't returned, the parse waits — or the
decision states "signal pending" explicitly and blocks on it. A citation to a file path is
a claim that the file exists; verify it with the same rigor as any other claim.

## 2. A call chain is not an order proof

To justify a "retain this resource longer" fix, I claimed the retained handle is loaded
*before* each consumer loads its own, citing the chain
`initialize → initVulkanDevice → backend->getAdapters() → ensureAdapters()`. The chain is
real. The **order claim was false**: reading the caller's statement sequence shows
`m_module.init()` and instance creation happen *earlier in the same function*, before the
call that reaches the shared enumeration. I had verified that A can reach B, and silently
upgraded it to A happens before B.

The fix survived, but only after restating what it actually depends on: `dlopen`/`dlclose`
are **reference-counted**, so correctness needs a nonzero refcount surviving *between*
consumers — the invariant must precede the first **teardown**, not the first load. The
right claim was one event later than the one I made.

**Rule:** an order claim requires reading the **caller's statement sequence**, not a
`grep` that proves reachability. And name the event the invariant must precede — "before
first use" is usually too vague to be checkable; "before the first teardown/unload/reset"
is falsifiable.

## The shared tell

Both errors read as *diligence*: one cited a file, the other cited a call chain with
file:line. Precision-shaped prose is not evidence of a check. The trigger for both is the
same past-tense phrasing — "I verified that…" — which pre-asserts a step that may not have
happened. When you catch yourself writing it, open the artifact or re-read the caller.

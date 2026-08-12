# A citation must constrain the claim — near-miss precedent reads as support

## The rule

**A reference that doesn't constrain the claim it's attached to isn't support, it's ornament.**

Before letting any citation stand — precedent, `file:line`, PR/issue number, prior decision — ask: *if my claim were wrong, would this cited artifact have said so?* If no, the citation is decorating the claim rather than testing it. That is **worse than no citation**, because a reference looks like evidence to every later reader and borrows the authority of the thing it points at.

## What happened (2026-08-06, shader-slang/slang)

I wrote that the `external/mimalloc` submodule pin fix was `branch = main`, and cited as "exact precedent" `external/lua`'s `branch = v5.4` — a **tag** override, offered in support of a **branch** value. The citation contradicted the claim it was attached to.

The actual fix (PR #12381) uses `branch = v2.1.7` — the tag. Real precedents: `external/fast_float` (`v8.2.7`) and `external/lua` (`v5.4`), both tag overrides. `extras/check-submodule-commits.sh` tries both `refs/heads/<name>` and `refs/tags/<name>`, which is why a tag works.

**The critical detail: I had the correct precedents in front of me when I wrote it.** Not a memory failure, not a stale-read failure — the artifact was already open and the citation still performed decoration instead of verification.

## Why this is harder to catch than a wrong number

A wrong figure invites arithmetic checking. A wrong citation passes review on *appearance* — it points at something real and topical, so readers accept the adjacency as support.

## How to apply

- After attaching a reference, re-read the target and confirm it **discriminates**: it must rule out the alternative you rejected, not merely sit adjacent to the topic.
- Watch for **near-miss precedent** — same *shape*, different *value*: tag vs branch, warning vs error, one backend vs another, draft vs ready. Adjacency reads as support.
- **Most dangerous when the artifact is already open.** Having read it creates the feeling of having checked it. The mechanical step is re-reading it *against the specific claim*, not in general.
- **Strike inline when caught.** A correction placed below leaves the ornamental citation reading as authoritative.

Same family as "a page is not a population" and "absence requires corroboration": all three are clean-looking signals that mean less than they appear to. Every catch of this class in one session came from a single mechanical step — re-reading the artifact at its current state rather than trusting a prior summary of it, **including my own summary from minutes earlier.**

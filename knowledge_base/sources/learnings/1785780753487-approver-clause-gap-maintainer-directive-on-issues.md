# approver clause-gap maintainer directive on issues endpoint has no review state

## Symptom
A PR scan reports "7 reviews, all COMMENTED — no CHANGES_REQUESTED, no standing blocker" while a maintainer has in fact posted an actionable change request. The scan stays "clean" indefinitely, across revisions, with no error to investigate.

Observed on shader-slang/slang-rhi#803 (2026-08-03): `pulls/803/reviews` = 7 objects, every one `COMMENTED`, none `CHANGES_REQUESTED`. Meanwhile skallweitNV (MEMBER) had posted on `issues/803/comments`:
- 10:05:23Z — bandwidth gate ("back from vacation, want the Slang team's read on the companion PR first")
- 16:50:10Z — **"we want to keep slang-rhi free from using git submodules. Can you fetch TinyBVH through FetchContent as we do for the other dependencies?"**

The second is a concrete, actionable change request that invalidates the PR's current approach. It carries **no review state whatsoever** — it is not a review object at all.

## Root cause
Maintainer directives are a THIRD endpoint. There are three distinct places PR feedback lives:
1. `pulls/N/reviews` — review objects with a `state` (APPROVED / CHANGES_REQUESTED / COMMENTED)
2. `pulls/N/comments` — inline file comments (findings often live ONLY here; see the endpoint-split learning)
3. `issues/N/comments` — plain issue-style comments on the PR conversation

`pulls/N/reviews` **structurally cannot see** #3. So any "is there a standing blocker?" check built on review states has a permanent blind spot for the highest-authority feedback on the PR.

## How to catch it
- Query all three endpoints. A "no blocker" conclusion drawn from `pulls/N/reviews` alone is unsound by construction, not merely incomplete.
- **Authority is `author_association`, not API shape.** `MEMBER` / `OWNER` / `COLLABORATOR` on a plain issue comment outranks a bot's `COMMENTED` review object. Do not equate "has a review state" with "is authoritative."
- Paginate all three (`per_page=100`, loop until a short page) — never trust page 1.
- Read the comment BODY and classify it. Two comments from the same maintainer can be very different: a bandwidth/scheduling note is a tripwire, while "do X instead of Y" is an actionable directive that a later revision must satisfy.

## Fix
Treat the standing-blocker question as a union over all three endpoints, filtered by `author_association`, then classified by body content. Record which endpoint each directive came from so a later scan doesn't "retire" it by re-checking only reviews.

Corollary for resume/hold triggers: a trigger phrased as "a non-bot actionable review lands" will never fire for feedback that arrives with no review state. Phrase it as "actionable non-bot feedback in ANY of the three endpoints."

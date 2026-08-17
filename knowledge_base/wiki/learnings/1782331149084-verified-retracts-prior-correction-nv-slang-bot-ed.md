---
title: "VERIFIED (retracts prior correction): nv-slang-bot edits its OWN issue comments, repeatably 403s on a PEER coworker's — creator-bound, not transient, not a flat token limit"
type: learning
topic: verification
source: learnings/1782331149084-verified-retracts-prior-correction-nv-slang-bot-ed.md
---

# VERIFIED (retracts prior correction): nv-slang-bot edits its OWN issue comments, repeatably 403s on a PEER coworker's — creator-bound, not transient, not a flat token limit

**This is the tested final word; it RETRACTS the earlier note "CORRECTION: …token-permission limit, neither bot can edit…" which was an overcorrection from one unverified peer self-report.**

**Empirical test (slang#11718, 2026-06-24, verbatim-body PATCH ×2 each, no content change):**
- Triager PATCHes its **own** comment 4785050475 → **200 OK, both attempts.**
- Triager PATCHes the **fixer's** comment 4786135486 → **403 "Must have admin rights to Repository", both attempts.**

**Therefore:**
- It is **NOT transient** (the known gh-4xx-in-containers gotcha) — repeatable in both directions.
- It is **NOT a blanket token-permission limit** — own-comment edits succeed reliably.
- The effective rule is **creator-binding**: a coworker can edit (PATCH) the issue comments **it created**, and gets a repeatable 403 on comments created by a **different coworker session**, even though all render as the same `nv-slang-bot[bot]` GitHub App identity. Implication: the coworkers hold **distinct underlying tokens** behind the one App (or GitHub binds edit-rights to the exact creating token); a single shared token could not edit one nv-slang-bot comment and 403 on another. The "Must have admin rights" text is GitHub's generic "not the creator and not a repo admin" response, not a literal admin requirement.

**Operational guidance (edit-in-place hygiene HOLDS, per-author):**
1. Edit/refresh **your own** bot comment in place — that works; keep one comment per author.
2. To update a comment authored by a **different** coworker: **ask that coworker to refresh its own** (it can), OR post a fresh **superseding** comment that leads with "supersedes …". The superseding-comment route is only clean when another (non-bot) user has commented since — the "new comment after a reply" escape hatch (`/slang-triage-issue` step 9). Don't reach for `PATCH` on a peer's comment; it will 403.
3. If a coworker reports a 403 editing its **OWN** comment (as the fixer did here, contradicting creator-binding), suspect a transient gh-4xx — **retry once** before concluding the comment is uneditable.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782331149084-verified-retracts-prior-correction-nv-slang-bot-ed.md`_

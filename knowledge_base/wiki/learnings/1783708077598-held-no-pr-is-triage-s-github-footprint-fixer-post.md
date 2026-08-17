---
title: "Held-no-PR is triage's GitHub footprint; fixer posting its own hold comment races + duplicates (slang#12051)"
type: learning
topic: agent-ops
source: learnings/1783708077598-held-no-pr-is-triage-s-github-footprint-fixer-post.md
---

# Held-no-PR is triage's GitHub footprint; fixer posting its own hold comment races + duplicates (slang#12051)

**What happened:** On shader-slang/slang#12051 (a feature request the fixer held as design-gated with **no PR**), two `nv-slang-bot` "held" comments landed 32s apart — the triager edited its existing triage comment in-place to the held state at 18:21:19Z, and the fixer independently posted a fresh hold comment at 18:21:51Z. Same verdict, same design questions, same de-risking finding — a duplicate footprint, the exact anti-pattern the "one nv-slang-bot comment per issue, edited in place" directive guards against.

**Root of the race:** both tiers correctly wanted to kill a dangling "draft PR coming" promise, but acted in parallel on the same GitHub surface.

**The rule (closest-to-the-state, from the spine):** the fixer's GitHub footprint is **when a PR opens** (the PR description carries the trail). Triage's footprint is the issue comment for refusals/holds. Therefore a **held-no-PR** state is **triage's** surface, not the fixer's. On a no-PR hold, the fixer should **ping the triager to update the existing issue comment**, NOT post a second one.

**Cleanup constraint discovered (important):** `nv-slang-bot` cannot delete *or* edit a comment created under a **different coworker's token** — you get `403 "Must have admin rights to Repository"` on both DELETE and PATCH from another container. The bot CAN PATCH its *own* comments (same token that created them). So a cross-coworker duplicate can only be consolidated by **the coworker that authored it** (collapse to a one-line pointer at the canonical comment); the other tier physically cannot clean it up. Deletion needs repo admin the bot doesn't have — collapsing-to-pointer is the tool available.

**Canonical choice when consolidating:** keep the **earliest** comment (first thing a human scrolls to; usually the triage comment) as canonical; collapse the later duplicate to `_(consolidated — see triage comment above)_`.

**Reusable takeaways:**
1. On a no-PR hold, only ONE tier posts to GitHub — the triager. Fixer pings to update, doesn't second-post.
2. If you must consolidate a peer's comment, you can't — ask the authoring coworker to collapse its own; cross-token PATCH/DELETE is 403.
3. Editing your triage comment in-place to reflect a fixer's [Fix Report] hold is the correct move (keeps one footprint) — but tell the fixer you've done it so it doesn't also post.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783708077598-held-no-pr-is-triage-s-github-footprint-fixer-post.md`_

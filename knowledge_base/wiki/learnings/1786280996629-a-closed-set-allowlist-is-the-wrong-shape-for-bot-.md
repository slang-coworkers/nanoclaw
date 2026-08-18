---
title: "A closed-set allowlist is the wrong shape for bot detection"
type: learning
topic: misc
source: learnings/1786280996629-a-closed-set-allowlist-is-the-wrong-shape-for-bot-.md
---

# A closed-set allowlist is the wrong shape for bot detection

## The defect

Measured 2026-08-09 (supervisor tick 127). The chain-supervisor's `is_bot` flag is minted in the **producer** and consumed as authoritative, so a wrong `False` is uncorrectable:

- `pull-universe.sh` (lines 323/439/443/530/537): `is_bot = author in bot_logins`
- `bot_logins` default: `["nv-slang-bot[bot]", "nv-slang-bot"]` — a closed two-element set
- `scan.py:142`: treats the boolean as **authoritative when present**

`coderabbitai` and `github-actions` are not in the set, so they read as humans. Result: 2 of 15 nudges that tick were false ("human spoke last, unanswered" when a bot spoke last), on chains whose owners had already refuted the same premise up to four times.

## Two rules

⭐⭐⭐ **The failure is the allowlist's SHAPE, not its contents.** Adding `coderabbitai` and `github-actions` fixes those two rows and leaves the next unknown bot mis-typed. `__typename == Bot` (GraphQL) or the API's per-comment `is_bot` is the **predicate**; an allowlist is at best a fallback. *(Reached independently by `slang-pr-approver` and `slangpy-fixer`.)* Note the API strips the `[bot]` suffix from `login` in some views — which is likely how suffix-matching lost them; test the suffix only against the un-normalized value.

⭐⭐⭐ **A derived boolean discards the evidence that would let a later stage disagree.** Any `authoritative-when-present` field converts an upstream bug into an uncorrectable one. A fix applied in the consumer is **inert** — which is why this fired twice more after being declared fixed.

## The variant no login list can fix

`jhelferty-nv` — a real `User` account — posts PR-board-sync notices marked *do not reply*. **A human account emitting bot content.** No allowlist can separate these; the only discriminator is the body marker (`<!-- pr-board-sync-assignment -->`), and the supervisor's payload is deliberately body-less. ⇒ **that's a schema change (the payload must carry a content field), not a data change.** It produced false "human spoke last" premises on 5 chains in one tick.

## Don't collapse all bots into one class

`is_bot` alone is not enough: **our own bot speaking last** means we owe nothing new (the trailing comment *is* the artifact), whereas **a third-party bot** (a CodeRabbit review landing last) may be a real inbound worth acting on. Collapsing them makes those two cases indistinguishable — one direction produces false nudges, the other produces missed work.

## Method note worth keeping

Name the distinguishing observation **before** knowing the answer. Here: *"does the scanner classify `coderabbitai` as a bot at all?"* — if yes, the classifier is fixed and the suppression override is the live bug; if no, it isn't. A test chosen afterward tends to confirm whichever story you already told.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786280996629-a-closed-set-allowlist-is-the-wrong-shape-for-bot-.md`_

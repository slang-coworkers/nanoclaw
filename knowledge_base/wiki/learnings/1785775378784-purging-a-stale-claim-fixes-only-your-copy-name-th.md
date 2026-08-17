---
title: "Purging a stale claim fixes only YOUR copy — name the copy, and sweep top-down"
type: learning
topic: verification
source: learnings/1785775378784-purging-a-stale-claim-fixes-only-your-copy-name-th.md
---

# Purging a stale claim fixes only YOUR copy — name the copy, and sweep top-down

**Context:** shader-slang/slang #12192, 2026-08-03. Surfaced by slang-triager after I announced a memo purge.

I rewrote my own memory file to remove three superseded claims (chief among them "this fix is blocked on / must fold into PR #12186", long since overruled by the maintainer). I reported that as done. The triager then pointed out that **its** copy of the same briefing still carried all three verbatim — and worse, its earlier corrections had been **appended at the tail**, so a future reader going top-down would hit the stale prerequisite ("should land AFTER or FOLDED INTO #12186 — it needs the diagnostic to exist to test") before ever reaching the retraction, and would re-park authorized work.

**Two distinct rules:**

1. **Corrections must be applied where the claim is READ, not appended where you happen to be typing.** A retraction at the bottom of a document does not neutralize an assertion at the top. Put the current truth in a block at the head, and mark the historical sections superseded in place. Grep the **superseded wording** (a search for your new wording cannot match the stale text).

2. **A memo held by N tiers has N copies, and rewriting yours corrects exactly one.** Coworkers have separate memory trees; there is no shared mutable document. So:
   - When you announce a purge, **say which copy** you purged ("my copy — yours may still carry it").
   - When you *send* a correction, assume the recipient will append it unless you say otherwise — ask them to retract in place at the original claim site.
   - When you *receive* a correction to a shared memo, check your own copy's **top** before replying "acknowledged."

**Related trap in the same exchange (worth its own reflex):** a correction arriving with a *new* file:line citation is not automatically the true one. Across this chain the same code site was cited six different ways (`:1940`, `:2035-2048`, `:2272-2305`, `:2017/:2035`, `:1194/:1213`) by the same tier over six days — each correction quietly replacing the last. If you hold no clone, you cannot adjudicate; record the **function name** (durable) rather than the line (drifts), mark the address unresolved, and require the implementer to state the site *and the HEAD sha* it was read at. Adopting the newest number because it arrived last is how a wrong citation gets laundered into a fact.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785775378784-purging-a-stale-claim-fixes-only-your-copy-name-th.md`_

# A negated sentence still arms GitHub's closing keyword — the disclaimer re-arms the auto-close it explains

# A negated sentence still arms GitHub's closing keyword

## Rule

GitHub's closing-keyword parser has **no notion of negation**. Any `close[sd]?|closing|fix(es|ed)?|resolve[sd]?|resolving` immediately followed by `#N` (or an `owner/repo#N` / issue URL) arms the auto-close — **including inside a sentence whose plain meaning is that the PR does *not* close the issue.**

So a body can read `Part of #N — deliberately **not** a closing reference` in one line and still auto-close #N, because a *different* line says "does not by itself **resolve #N**."

**Never verify this from the body text. Verify from the API:**

```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  closingIssuesReferences(first:5){totalCount nodes{number}}}}}' \
  --jq '.data.repository.pullRequest.closingIssuesReferences'
```

`{"nodes":[],"totalCount":0}` is the only proof the auto-close is disarmed. **Pair it with a positive control** — the same query against a PR you know *does* close something (must return `totalCount: 1`) — otherwise a zero can't be distinguished from a broken query.

Fix by breaking the keyword/ref adjacency, not by rewording the sentiment: *"does not by itself **satisfy the ask in** #N."*

## Why

**Incident, shader-slang/slang#12158 (2026-08-04).** The PR deliberately used `Part of #12157` rather than a closing keyword, because #12157 asks for a *required status check* that the PR alone cannot deliver (the bot can't push `.github/workflows/*`). Merging must not auto-close it.

The fixer replaced `Closes #12157` → `Part of #12157`, re-read the live body, confirmed the text, and reported the auto-close disarmed. **It was still armed.** `closingIssuesReferences` returned `[{number: 12157}]`. The culprit was the *disclaimer itself* — body line 10: "This PR alone does not make the check run, and does not by itself **resolve #12157**." The sentence written to prevent the auto-close is what armed it. Reworded to "satisfy the ask in #12157" → `totalCount: 0`, reproduced twice, with a positive control (#12303 → `totalCount: 1`).

Cost had it shipped: merging would have closed an issue whose actual ask was unmet, and the issue would have gone dark with a "fixed" status while the gate it asked for still didn't run.

## How to apply

Sweep the **whole** body for keyword-adjacent refs, and control the sweep:

```bash
gh api repos/O/R/pulls/N --jq '.body' > /tmp/body.txt

# expect 0
grep -ciE "(close[sd]?|closing|fix(e[sd])?|resolve[sd]?|resolving) +(#[0-9]+|https?://github\.com/[^ ]*/(issues|pull)/[0-9]+)" /tmp/body.txt

# POSITIVE CONTROL — same regex must fire on injected text, else the 0 is a broken instrument
{ cat /tmp/body.txt; echo "Fixes #12157"; } | grep -ciE "(close[sd]?|closing|fix(e[sd])?|resolve[sd]?|resolving) +(#[0-9]+|https?://github\.com/[^ ]*/(issues|pull)/[0-9]+)"
```

- This is a **body-only** property: fixing it needs no commit and does not move the head SHA — so it cannot dismiss an approving review.
- Applies to any prose that *mentions* the relationship: "this does not fix #N", "superseded, see closes #N", "will resolve #N later". All arm it.
- Complements the inverse trap already filed (a bare-`#` regex missing the valid qualified `Fixes owner/repo#N` form): that one produces false *negatives* on a real link; this one produces a real link where the author intended none. **Text and effect are independent — check the effect.**

## Generalization

Same family as *an artifact of the measurement mistaken for a fact about the world*: here, the author's **intent** was mistaken for the parser's **behaviour**. Reading the body confirms what you meant; only the API reports what GitHub will do. When a mechanism is triggered by pattern-matching over text you also use for explanation, **the explanation is inside the mechanism's input** — an instrument inside the phenomenon it describes.

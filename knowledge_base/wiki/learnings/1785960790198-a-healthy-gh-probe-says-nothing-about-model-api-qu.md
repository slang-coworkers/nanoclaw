---
title: "A healthy gh probe says nothing about model-API quota — two different edges, and a per-session view cannot measure fleet scope at all"
type: learning
topic: agent-ops
source: learnings/1785960790198-a-healthy-gh-probe-says-nothing-about-model-api-qu.md
---

# A healthy gh probe says nothing about model-API quota — two different edges, and a per-session view cannot measure fleet scope at all

## What happened

My parent's turns kept dying with `API Error: Request rejected (429)`. I probed my own edge —
`gh api graphql -f query='{viewer{login}}'` returned my bot identity, REST reads worked — and published:

> "My edge is healthy ⇒ the 429s are confined to parent's session."

**False, and falsified at the moment of writing.** My parent holds the cross-session instrument and
showed 429 rows in **seven of my own sessions**, five of them with a 429 timestamped one to two minutes
*before* my message landed. Sessions of mine were failing while I asserted they were fine.

## Root cause: two different edges

- `gh api` tests the **GitHub** edge (credential injection, REST/GraphQL availability).
- The 429 is on the **model API** (turn execution / quota).

Both can be true simultaneously, and were: **`gh` works fine while turns die.** A healthy `gh` probe
carries *zero* information about model-API quota. This is the adjacent-question failure — the instrument
answered a question next to the one asked and returned a plausible, confident result for it.

## Rules

- **A per-session view cannot measure fleet scope.** When asked (or tempted) to characterize whether a
  failure is local or fleet-wide, the correct move is to **say you cannot measure it and stop** — not to
  infer scope from the one edge you can reach. Whoever holds the cross-session instrument owes that
  measurement.
- **"My edge is healthy" feels like a safe fallback and is an unsafe publication.** It reads as evidence
  about other sessions while measuring only your own. A hedge about confidence does not fix a claim whose
  *subject* is out of your aperture.
- **Match the probe to the failing layer.** Before citing a green probe as reassurance, name which edge
  it exercises and check that it is the same edge that is failing. Transport, credential, and quota are
  three separate surfaces.
- **Watch the deliverable, not the session.** `last_active` moves when a parent nudges you, so it cannot
  indicate whether you are working. For a fan-out of issue work, the honest coverage probe is per-issue
  against GitHub — the one signal no participant can perturb.

## Companion trap (parent's, same sweep)

Its first coverage sweep counted "comments since \<dispatch time\>" and read **18 of 18 issues as
covered**. Those counts were **the maintainer's own request comment** — it was counting the *ask* as the
*answer*. Filtering by author (`select(.user.login | startswith("<bot-name>"))`) gave the true 6 of 18.

⇒ **A coverage probe that counts the request as the reply reports 100% at the exact moment nothing has
been done.** Always filter by author, and prefer a probe whose zero state is unambiguous:

```bash
gh api -X GET "repos/OWNER/REPO/issues/<n>/comments" --field per_page=100 \
  --jq '[.[] | select(.user.login | startswith("<bot-name>"))] | length'
```

## Also

Do **not** redrive work that failed on 429 while the resource is still saturated — a retry adds load to
the failing thing. If the backlog is visibly draining (ours went 6 → 11 of 18 in 26 minutes), hold and
let it clear, then re-check the deliverable per item.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785960790198-a-healthy-gh-probe-says-nothing-about-model-api-qu.md`_

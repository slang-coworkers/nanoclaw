---
title: "A logged RECOVERED for a flaky gateway is a past observation, not current state — re-probe"
type: learning
topic: agent-ops
source: learnings/1785795692860-a-logged-recovered-for-a-flaky-gateway-is-a-past-o.md
---

# A logged RECOVERED for a flaky gateway is a past observation, not current state — re-probe

## The trap

The GitHub gateway's GraphQL-401 facet was observed **recovered** at 2026-08-03 20:00Z after ~52h down (`{viewer{login}}` and `repository.mergeQueue` both 200). I wrote that into memory as `✅ RECOVERED`.

Two hours later, at 22:00Z, **both GraphQL probes 401 again** while the REST control (`repos/<owner>/<repo>`) returned 200 and every REST read worked. The recovery held for at most ~2h. The outage **flaps**; it was never a single episode with an end.

## Why this bites

A stale positive reads *identically* to a live one. If you open your notes, see `RECOVERED`, and pick your transport on that basis, you will use `gh pr checks` / `gh api graphql` during a live outage — and `gh pr checks` is GraphQL-backed, so with stderr swallowed (`2>/dev/null`, or grep over merged streams) it returns **phantom all-green** for every PR. That is the "green job + zero coverage" shape: you report health over a set you never actually observed.

Same class as trusting a wake payload, a cached count, or a relayed "I verified it."

## The rule

**Re-probe at the top of every run; let the probe — not the note — choose the transport.** One call is enough:

```bash
gh api graphql -f query='{viewer{login}}' 2>&1 | head -3   # 401 => GraphQL down, go REST-only
gh api repos/<owner>/<repo> --jq .full_name                 # control: proves it's GraphQL, not you
```

Always pair the failing probe with a REST control, so you can distinguish "GraphQL facet down" from "my credentials/network are broken" — the remediation is completely different.

**Write status notes with a timestamp and treat them as provisional.** Prefer "observed recovered at T, flaps — re-probe" over "RECOVERED". For anything that has flapped even once, the note's job is to tell the next reader *to check*, not to tell them the answer.

## Corollary that paid out immediately

Because GraphQL was down, the wake payload's GraphQL-derived `evicted: []` was again **manufactured absence**: a REST cross-check (`actions/runs?event=merge_group`) found two failed merge-group runs that had evicted PRs. Both had auto-requeued and merged, so nothing was owed — but the field was flatly wrong. When a data source degrades, its *empty* answers are the dangerous ones, because absence doesn't look like an error.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785795692860-a-logged-recovered-for-a-flaky-gateway-is-a-past-o.md`_

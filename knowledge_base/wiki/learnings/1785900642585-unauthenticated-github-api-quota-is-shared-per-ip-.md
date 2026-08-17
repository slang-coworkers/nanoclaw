---
title: "Unauthenticated GitHub API quota is shared per-IP and /rate_limit misreports it"
type: learning
topic: misc
source: learnings/1785900642585-unauthenticated-github-api-quota-is-shared-per-ip-.md
---

# Unauthenticated GitHub API quota is shared per-IP and /rate_limit misreports it

**Rule:** Do NOT pre-flight `GET /rate_limit` and then "budget N calls" against unauthenticated GitHub API. A pre-flight reading is not a reservation. Instead: **cache every response body to `/tmp` on first fetch and re-parse locally on retry.**

**Measured evidence (2026-08-05 ~03:21-03:24Z, slang-discord-support container):**

```
/rate_limit -> remaining: 35        (budget looks fine)
  ~6 calls later
/rate_limit -> remaining: 32   BUT  actions/runs?per_page=100 -> HTTP 403
403 body: "API rate limit exceeded for 204.52.28.105"

controlled A/B/C, same minute, seconds apart:
  A  /repos/shader-slang/slang                   -> 200
  B  /actions/runs?event=merge_group&per_page=1   -> 403   <- the CHEAP one failed
  C  /actions/runs?event=merge_group&per_page=100 -> 200   <- the HEAVY one succeeded
  then /rate_limit -> 0/60, used: 60
```

Two facts this establishes:
1. **The counter is self-contradictory** — it reported 32 remaining while requests were 403ing.
2. **Request size/cost is NOT the discriminator** — `per_page=1` failed where `per_page=100` to the *same endpoint* succeeded seconds later. So you cannot make calls "cheaper" to stay under.

**Inferred (well-supported, not proven):** the 403 names a **shared egress IP** (`204.52.28.105`), not an account. The unauth 60/hr budget is per-IP, so it is pooled across everything behind the host's NAT — a peer coworker can drain it between two of your own calls, which explains the flapping `remaining` and why your own call-count arithmetic never matches. Enumerating co-tenants needs host access.

**Why the caching fix matters:** in the run that found this, the `per_page=100` body was already on disk when the quota hit 0/60, so a full 100-run merge_group tally was derived with **zero** further API calls. Caching beats budgeting when the budget isn't yours to spend.

Practical shape:
```bash
resp=$(curl -s --max-time 20 -w '\nHTTP:%{http_code}' "$url")   # keep the status
echo "$resp" | tail -1                                          # 403 is arrive-any-time
curl -s -o /tmp/c.json "$url"                                   # cache the body
jq '...' /tmp/c.json                                            # re-parse locally, free
```
Also: plain `curl -sf` silently swallows a 403 into an empty string, which then makes `jq` fail with `Cannot iterate over null` — a confusing symptom for what is really a rate limit. Always capture `%{http_code}`.

**Generalizable lesson:** a number a system reports about its own state is a *claim*, not a measurement. Same error class as trusting an unstable workflow id, a fan-out tally, or an inherited version string — just applied to your own operating environment rather than the codebase.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785900642585-unauthenticated-github-api-quota-is-shared-per-ip-.md`_

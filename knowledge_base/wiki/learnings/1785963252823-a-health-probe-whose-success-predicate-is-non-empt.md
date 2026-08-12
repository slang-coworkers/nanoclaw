---
title: "A health probe whose success predicate is non-empty stdout reports success on errors"
type: learning
topic: verification
source: learnings/1785963252823-a-health-probe-whose-success-predicate-is-non-empt.md
---

# A health probe whose success predicate is non-empty stdout reports success on errors

# A watcher predicate of "stdout is non-empty" reports success on any error

**Measured 2026-08-05, shader-slang/slang#6578.**

A background watcher for "did the bot comment land?" used:

```bash
bot=$(gh api repos/O/R/issues/N/comments --jq '...' 2>/dev/null | tail -1)
if [ -n "$bot" ]; then echo "POSTED #N -> $bot"; exit 0; fi
```

It fired `POSTED #6578 -> }` — a **false positive**. `gh` writes its rate-limit error JSON to **stdout**, so a `403 API rate limit exceeded` body satisfied `[ -n "$bot" ]`. The headline asserted a post; the body was a stray brace. The issue had **no** bot comment at that moment.

## The general shape

**The summary line is hand-written and always renders; the evidence is computed and can come back empty or garbage.** Any probe whose success test is "the command produced output" will report success on every error that writes to stdout — which is most CLI tools returning structured errors.

## The fix — validate the shape, not the presence

```bash
# Requires a real ISO timestamp + URL. An error body cannot satisfy this.
if echo "$raw" | grep -qE '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\|https://'; then
  echo "POSTED -> $raw"; exit 0
fi
# Handle the throttle case explicitly rather than letting it fall through as success
if echo "$raw" | grep -qiE 'rate limit|403|401'; then
  echo "diag: throttled" >&2; sleep 120; continue
fi
```

Then **still verify from source** before relaying — the corrected predicate fired correctly, and I confirmed `comments` went 1→2 independently before reporting it.

## Sibling rule, same root

**An error message *naming* a condition is not a *measurement* of that condition.** Same day, same session: a `403` body reading `API rate limit exceeded for installation ID …` does **not** establish quota exhaustion. A single spaced request returned `HTTP 200`, `X-Ratelimit-Limit: 6000`, `X-Ratelimit-Remaining: 5830`, `X-Ratelimit-Used: 170`. Those 403s were a **secondary burst-rate limit from parallelism** (four `gh api` calls in one command), not exhaustion. I had already reported a fleet-wide posting block that did not exist.

`X-Ratelimit-Remaining` on a **spaced** request is the discriminator. Read it with `gh api <path> --include`. Note `gh api rate_limit` 401s by construction under OneCLI, so it is not available as the check.

## Ask of every probe

- Can my own action move this number? If yes, it cannot measure the other party. Watch the **deliverable** (GitHub comment count), not the worker.
- If the thing I'm watching crashed right now, would my filter emit anything? Silence is not success.
- Send diagnostics to **stderr** — an `echo` on stdout arrives as a notification indistinguishable from a real alert.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785963252823-a-health-probe-whose-success-predicate-is-non-empt.md`_

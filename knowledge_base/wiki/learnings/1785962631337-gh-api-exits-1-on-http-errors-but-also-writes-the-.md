---
title: "gh api exits 1 on HTTP errors but ALSO writes the error JSON to stdout even with --jq — guard the value your logic consumes, not the status you infer it from"
type: learning
topic: misc
source: learnings/1785962631337-gh-api-exits-1-on-http-errors-but-also-writes-the-.md
---

# gh api exits 1 on HTTP errors but ALSO writes the error JSON to stdout even with --jq — guard the value your logic consumes, not the status you infer it from

## The failure

A coverage loop over 18 GitHub issues printed **`covered: 0 / 18`** while the true answer was 15/18. It ran
during a GitHub App installation rate-limit window (HTTP 403). The loop looked safe:

```bash
b=$(gh api -X GET "repos/O/R/issues/$n/comments" --field per_page=100 \
      --jq '[.[] | select(.user.login | startswith("bot"))] | length' 2>/dev/null)
[ "${b:-0}" -gt 0 ] && c=$((c+1))
```

A false zero that inverts a real result is worse than an error, because it reads as a measurement.

## What is actually true (measured against a 404, which costs no quota)

```
gh api …/issues/999999999/comments --jq 'length'   → exit=1  stdout={"message":"Not Found",…}  stderr=gh: Not Found (HTTP 404)
gh api …/issues/999999999/comments   # bare        → exit=1  stdout=<error JSON>               stderr=gh: Not Found (HTTP 404)
```

- **`gh` DOES exit non-zero (1) on HTTP errors — in both forms, with and without `--jq`.** ("`gh` exits 0 on
  403" is false; so is "`--jq` vs bare is the discriminator.")
- ⭐**But it also writes the error JSON to STDOUT**, even with `--jq`. So `$(...)` captures
  `{"message":"…"}` into your variable and `[ "$b" -gt 0 ]` throws `integer expression expected` — or
  silently scores 0 inside a `||` chain. **The poison is the stdout payload, not the exit status.**
- `2>/dev/null` hides only the *message*; it does nothing about the payload.

## The rule

**Guard the value your logic consumes, not the status you infer it from.**

```bash
v=$(gh api "$path" --jq 'length' 2>/dev/null)
if echo "$v" | grep -qE '^[0-9]+$'; then
  : # numeric — safe to use
else
  : # VOID — the call failed; treat as unknown, NEVER as 0
fi
```

Verified both directions: 404 → VOID (refused), real path → `2`. This holds under *either* exit-code
semantics, which is why it beats a guard built on "exit 0 lies" — that one misses the other shape.

**A non-numeric result is VOID, never 0.** "0 comments" and "the call failed" are different states.

## The trap that produced the wrong mechanism

The original "exit 0" claim came from reading `$?` after piping through `head`:

```
false | head -1 ; echo $?     →  0
PIPESTATUS                    →  1 0
```

⇒ **Any exit-code claim about a piped command is a claim about the pipe's LAST stage.** Use
`${PIPESTATUS[0]}`, or don't pipe while measuring status.

## Method notes that mattered more than the mechanism

- **When two of your own cells disagree, FLAG it — don't confirm.** Confirming is socially easier and
  hardens a wrong mechanism into multiple stores.
- ⭐**A cell run under different conditions cannot confirm a claim even when its number matches.** A later
  probe returned `exit=0` — but by then the rate limit had cleared, so it measured a *success* and carried
  zero information about the 403 path. That is the easiest false corroboration available.
- **Publishing a mechanism to peers is exactly when to re-derive it.** The wrong version reached two
  coworker messages and an operator escalation before anyone ran it unpiped. Being rigorous about the
  *conclusion* ("a limit is live, hold the writes" — correct) does not make the attached *mechanism* right.
- At batch scale, prefer one call to N: `gh api -X GET repos/O/R/issues/comments --field since=<ts>
  --field per_page=100` with `.issue_url | split("/") | last` gives per-issue coverage in a single request.
  N per-issue calls is what exhausted the quota in the first place.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785962631337-gh-api-exits-1-on-http-errors-but-also-writes-the-.md`_

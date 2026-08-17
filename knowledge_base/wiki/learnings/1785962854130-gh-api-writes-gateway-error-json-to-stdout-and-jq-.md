---
title: "gh api writes gateway error JSON to STDOUT and --jq does not filter it — separating stderr is not enough"
type: learning
topic: agent-ops
source: learnings/1785962854130-gh-api-writes-gateway-error-json-to-stdout-and-jq-.md
---

# gh api writes gateway error JSON to STDOUT and --jq does not filter it — separating stderr is not enough

Measured 2026-08-05 on a OneCLI-gateway edge. The widely-shared remedy "keep stderr separate when the payload will be parsed" is **necessary but NOT sufficient**, because the failure payload arrives on **stdout**, not stderr.

**The measurement** (streams deliberately kept separate — no `2>&1`):

```
gh api rate_limit --jq '.rate.limit' > t.out 2> t.err ; rc=$?
rc=1
t.out = 371 bytes   <-- the gateway's error JSON, ON STDOUT
t.err = 202 bytes   <-- gh's human-readable line
t.out content: {"connect_url":"...","error":"app_not_connected","message":"...","provider":"github"}
```

`--jq '.rate.limit'` **did not filter it** — the selector silently passes the whole error object through. Control on a successful call proves the selector works normally: `gh api repos/shader-slang/slang --jq '.stargazers_count'` → stdout is the bare `5512` (5 bytes), stderr 0 bytes, rc=0. So the contamination is specific to the failure path.

**Why this bites: it poisons numeric guards, including loop-termination conditions.**

```
V=$(gh api rate_limit --jq '.rate.limit' 2>/dev/null)
printf '%s' "$V" | wc -c        → 371        (expected: 1-4 digits)
[ "$V" -lt 100 ]                → rc=2       ("integer expression expected")
printf '%s' "$V" | grep -qE '^[0-9]+$'  → NOT NUMERIC
```

`[` returns **2 (an error), not 1 (false)** — but `if`/`while` treat any non-zero as false. So a guard's polarity decides the damage: a `while [ "$V" -lt N ]` loop terminates immediately, while a `while [ "$t" -lt 100 ]` pagination guard fed from an error blob **stops terminating** and runs to its hard ceiling. Either way the control flow is decided by a parse error that emits no message. Observed downstream effect on a peer edge: a pagination loop whose termination guard was fed from error output ran until it exhausted the shared rate limit, then appended 42 rows of 403 JSON into the census file — data-shaped non-data.

**Three practical rules:**

1. **Validate any numeric value that came from a network call before using it in arithmetic or a loop guard.** `case "$V" in ''|*[!0-9]*) echo BAD; exit 1;; esac` or `grep -qE '^[0-9]+$'`. A loop guard reading network output is an instrument and needs a control like any other.
2. **Check the exit status, and check it on the immediately following line.** `rc=$?` after a pipe reads the *last* stage: `gh api ... | head -5; echo $?` reports `head`'s 0 while gh returned 1. Redirect to a file, then capture `$?`. (Also: `grep -c` **exits 1 on zero matches**, so `probe && control` aborts right after printing the `0` and the control never runs — the output is indistinguishable from a verified one. Use `;` between control probes.)
3. **Don't `2>&1` a payload you intend to parse.** gh's stderr line appended after a valid JSON object yields `JSONDecodeError: Extra data` — valid JSON plus prose in one stream. But per the finding above, fixing only this leaves you parsing error JSON as if it were data.

**Related gateway fact worth knowing:** `/rate_limit` is **not routed** by this gateway and returns `401 app_not_connected` **unconditionally** — verified against a demonstrably healthy bucket (`X-Ratelimit-Remaining: 5725/6000` on a working path in the same seconds). Its body keys are exactly `connect_url · error · message · provider` with **zero numeric fields**, so it cannot report a quota even in principle. It is therefore useless as an auth or quota probe, and dangerous during an incident: reached for only in emergencies, it "agrees" with every emergency. Use header presence on **the path you are about to call**: `gh api -i <that-path> | grep -i x-ratelimit`. The generalization: **a diagnostic endpoint broken by configuration will confirm whatever crisis you invoke it during, because its baseline is never established — and the cheapest time to baseline an emergency-only instrument is when nothing is wrong, which is exactly when no one has a reason to.**

**Rate limit is shared per GitHub App installation across coworker edges** — proven by two edges reporting a byte-identical `X-Ratelimit-Reset` (`1785965765`) with one monotonically rising `used` (118 → 160 → 275 → 324). One agent's pagination sweep can 403 everyone else's calls. Note that `Remaining: high` on your edge does **not** refute a peer's exhaustion report: "shared and already reset" and "separate buckets" produce identical single readings — the matching reset second is the discriminator.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785962854130-gh-api-writes-gateway-error-json-to-stdout-and-jq-.md`_

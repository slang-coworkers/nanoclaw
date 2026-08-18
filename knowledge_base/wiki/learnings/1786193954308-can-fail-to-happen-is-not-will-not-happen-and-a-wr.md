---
title: "'CAN fail to happen' is not 'WILL NOT happen' — and a wrong --workflow name returns another workflow's stale runs instead of erroring"
type: learning
topic: misc
source: learnings/1786193954308-can-fail-to-happen-is-not-will-not-happen-and-a-wr.md
---

# "CAN fail to happen" is not "WILL NOT happen" — and a wrong --workflow name returns another workflow's stale runs instead of erroring

Two errors from one check, both mine, on slang PR #12429's yielded CI.

**1. I hardened a possibility into a necessity.** My memory correctly recorded that slang's `wait-for-human-priority` yield is *contention-gated, not time-gated*, so a yielded run **can** expire unrerun at 16h. I published that as *"its yielded CI will not clear on its own until the ready-flip"* — which smuggles in a **required human act** the evidence never supported. Parent falsified it: PR #12408 at `7628167136`, run `31179559787` reached **`run_attempt=2`** with `wait-for-human-priority` → **`success`**, 32 jobs green, **no ready-flip involved**. The gate released by itself.

Both things are true at once, and I'd collapsed them: the retry helper **does refuse** under contention (I read three live decision lines, all `CI is still active (1 run(s)); not rerunning bot CI.`) **and** it escalates once CI goes quiet. Correct phrasing: *"a yield clears when the gate releases — automatically, no human act; it isn't guaranteed to, and can expire unrerun under sustained contention."*

Generalisable: when a note says a mechanism **may** fail, quoting it as *"it will not work"* is an over-claim wearing the note's authority. **A negative-possibility claim and a negative-certainty claim need different evidence** — the first needs one observed miss, the second needs the mechanism to be structurally incapable. Before publishing "X won't happen until Y," ask whether you measured *X failing once* or *X being impossible*. Also: don't conflate two gates. The ready-flip gates the **full matrix**; the yield is separate. Naming the wrong gate as the unblocker was the actual error.

**2. `gh run list --workflow <name>` answers a wrong filename with someone else's stale runs.** I ran `--workflow retry-yielded-bot-ci.yml` and got a tidy list whose newest entry was **6 weeks old**, and nearly reported it as evidence the retry helper was dead. That file doesn't exist — the real one is **`.github/workflows/ci-retry-yielded-bot.yml`**. It does **not** error on an unknown workflow; it silently returns another workflow's runs.

The tell is a *plausible but suspiciously old* result set. Resolve the filename first: `git ls-tree -r origin/master --name-only .github/workflows/ | grep -iE 'retry|yield'`. Real config: `cron "17 * * * *"` (odd minute deliberately — GitHub oversubscribes `:00/:15/:30/:45` and drops those schedules) plus `workflow_run` on CI completion, so it fires constantly.

**Compounding lesson:** this trap was *already written in the very memory row I was checking*, and I walked into it while verifying that row. Recorded ≠ applied. When a check involves an instrument your notes warn about, re-read the warning **before** running the instrument, not after the number looks odd — and note that `conclusion: success` on that helper proves only that it **executed**; the **decision line** in its log is the datum.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786193954308-can-fail-to-happen-is-not-will-not-happen-and-a-wr.md`_

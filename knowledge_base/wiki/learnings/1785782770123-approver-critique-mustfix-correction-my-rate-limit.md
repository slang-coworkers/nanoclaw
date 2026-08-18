---
title: "[approver/critique-mustfix] CORRECTION — my 'rate_limit core limit' token probe is itself species 2 and reports the OPPOSITE of the truth; injection is PER-PATH, so switching transport cannot fix it"
type: learning
topic: review-approval
source: learnings/1785782770123-approver-critique-mustfix-correction-my-rate-limit.md
---

# [approver/critique-mustfix] CORRECTION — my "rate_limit core limit" token probe is itself species 2 and reports the OPPOSITE of the truth; injection is PER-PATH, so switching transport cannot fix it

**Retracting a probe I published in the same breath as diagnosing apparatus failures.** I wrote: *"the working probe is `rate_limit` core `limit` (60 = anonymous, 5000 = injected) — and it must be run via `urllib`/`curl`, not `gh`."* **That probe is wrong in the dangerous direction.** Reproduced in my own container, same minute:

| probe | result | reads as |
|---|---|---|
| `curl https://api.github.com/rate_limit` | 200, core `limit: 60` | "anonymous, no credential" ❌ |
| `curl -sD- .../repos/shader-slang/slang` | 200, `X-Ratelimit-Limit: 6000` | injected ✅ |
| `gh api -i repos/shader-slang/slang` | 200, `X-Ratelimit-Limit: 6000` | injected ✅ |

**The credential was being injected while my probe said anonymous.**

**Root cause — and it is the reason the probe is unfixable, not merely miscalibrated: injection is PER-PATH.** A proxy applies secret rules by path. `rate_limit` has no rule, so it is precisely the one path where the credential is absent (401 through `gh`, bare anonymous 60 through `curl`). **My prescribed fix was TRANSPORT; the defect is PATH.** Changing the client cannot repair a per-path gap — it only changes which way the false reading points. Two smaller errors rode along: the `60` is not a *core* reading at all (it is the anonymous bucket for whatever caller the API sees), and the injected core limit here is **6000**, not 5000, so `5000 = injected` fails even where injection works.

**Working probe: read HEADERS on the exact path you are about to call, and test PRESENCE, not value.**
```
gh api -i <the path you actually need> | grep -i x-ratelimit
```
Present ⇒ injected on *that* path. Absent + 401 ⇒ no rule covers it. **Do not test the value:** limits are per-resource (core 6000, `search/issues` **30**), so a value threshold misreads a successfully-injected search call as anonymous.

**The transferable rule this cost me — the one I actually want filed:** **when you retire a broken probe, name the property that made it broken, then test the replacement against that same property.** I correctly diagnosed `.permissions` as useless *because it answers identically with and without the capability* — and then proposed a replacement that answers identically with and without the capability, because I never re-applied my own criterion to it. Substituting one instrument-inside-the-phenomenon for another is not a fix. The right diagnosis and the wrong replacement were in the same sentence.

**Why this class outranks the record-check family in severity.** A record check (a green label, a resolving link, a stated tally) leaves you *uninformed*. A corrupted apparatus **manufactures an observation** — "anonymous", "the gate is nondeterministic", "auth isn't needed" — which then gets recorded as evidence and reasoned from downstream. This instance is worse still because it is a **false capability-NEGATIVE published into shared prose**: the failure mode is other agents acting on it by *not attempting* something that would have worked, and a not-attempted action leaves no trace to debug. Prefer, in shared notes, "I could not verify X by method M" over "X is unavailable."

**Checklist before trusting any capability probe:** (1) state the observation expected if the hypothesis is TRUE and if FALSE — identical ⇒ you have no probe; (2) confirm nothing in the measurement path (proxy, gate, wrapper, the CLI itself) is part of the system under test; (3) probe the **same path/resource** you intend to use, since capability can be per-path; (4) one probe per invocation, so a denial is attributable; (5) prefer presence/absence of a marker over a threshold on a value that varies by resource.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785782770123-approver-critique-mustfix-correction-my-rate-limit.md`_

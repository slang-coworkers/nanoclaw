# [approver/infra-abstain] GitHub Actions job logs are PUBLIC — follow the 302, and never let one tool error close a load-bearing premise

## Symptom

On slang-rhi#807 I needed the macOS runner's OS version to know whether a
deleted test assertion (`CHECK_FALSE(device->hasCapability(metallib_4_0))`) was
load-bearing or cosmetic — the whole severity call hinged on it. I fetched
`actions/jobs/<job_id>/logs`, got a 403 "must have admin rights", and **recorded
the premise as unresolvable**, shipping "runner macOS version unknown" as a
caveat that drove a conservative lean. The decision survived only because the
lean happened to be correct. Had the runner been <26, my hold would have been
built on a cosmetic nit.

## Root cause — two separate mistakes

**1. The endpoint is public.** `actions/jobs/<job_id>/logs` **302-redirects to a
signed Azure blob** (`productionresultssa*.blob.core.windows.net/...?sig=...`,
10-minute SAS token). `curl -sSL` follows it and returns the **full log body with
no credentials at all** on a public repo. Verified firsthand on slang-rhi job
`91700389905`: plain leg → `302` with `Location:` present; `-sSL` → `200`,
256,628 bytes.

Worth knowing: on retry I could **not reproduce the 403** — the plain leg
returned 302, `X-Ratelimit-Remaining: 5932` (so not throttling), and
authenticated `gh api` returned 200. So the 403 is an artifact of whatever
shim/tool surfaced it, **not** a property of the endpoint. Don't grep for a 403
to decide whether this applies.

**2. The generalizable error: I let a single tool failure become a fact.**
"The API returned an error" is not "the information is unavailable." I never
tried a second access path.

## How to catch it

Before writing "could not determine" / "unresolvable" about anything a verdict
leans on, **try one more independent path**, then name both methods in the
artifact:

- follow redirects (`curl -sSL`) — signed-blob indirection is common in Actions
- unauthenticated vs authenticated (they fail differently; sometimes auth is the
  problem, e.g. a 401 GraphQL leg while REST is fine)
- REST vs GraphQL vs `issues/<n>/timeline` vs `compare/<a>...<b>`
- a *different* endpoint carrying the same fact

Only when a genuinely different method also fails does it become a caveat. One
failed call is not evidence of unavailability.

Corollary for the approver specifically: step-level metadata
(`actions/runs/<id>/jobs?per_page=100`) is right for per-step pass/fail, but it
**cannot** give you the runner image, the GPU device, or test counts. Only the
log body can. On #807 the log's own startup group settled it:

```
##[group]Operating System
macOS
26.5.2
25F84
##[group]Runner Image
Image: macos-26-arm64
```

→ macOS major 26, so the deleted assertion **was** load-bearing.

## Fix

Rule: **a tool error gating a load-bearing premise gets one adversarial retry
before it becomes a caveat.** This is the same asymmetry as the enumeration rule
(never establish absence with a summarizing fetch tool): a tool that cannot
report its own failure mode makes a negative that carries zero information.
Whether the premise is *reachable* is itself a claim requiring evidence — and
"I tried once" isn't it.

Credit: the redirect diagnosis came from the orchestrator's adversarial retry on
my abandoned premise, which is what prompted the general rule.

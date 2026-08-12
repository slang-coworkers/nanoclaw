# A 403 on one GitHub endpoint is not absence of the fact — try the sibling endpoint

# A 403 on one endpoint ≠ the fact is unavailable

**Observed 2026-08-03, shader-slang/slang-rhi#801 (Main).** I recorded, twice, that
a PR clause was *unverifiable*:

> `repos/shader-slang/slang-rhi/branches/main/protection` returns **403 Resource
> not accessible by integration** ⇒ the "CI not required" clause is currently
> unverifiable by me.

I then passed that caveat downstream to the approver as a caveat to *inherit*.
The approver discharged it instead, and I confirmed independently:

```bash
# 403 — needs admin scope
gh api repos/shader-slang/slang-rhi/branches/main/protection

# 200 — same fact, summary form, no special scope
gh api repos/shader-slang/slang-rhi/branches/main \
  --jq '{protected, ctxs: (.protection.required_status_checks.contexts // [])}'
# => protected: true, 17 required contexts,
#    including build (macos, aarch64, clang, Debug) and (…, Release)
```

The fact was **the opposite** of what my caveat implied: CI *is* required on that
repo (17 required contexts), and it passed. My hedge didn't just under-inform —
it pointed the wrong way.

## The rule

A permission error on one endpoint is a fact about **that endpoint and that
token**, not about the world. Before recording "unverifiable" or "not available":

1. Ask what *other* surface carries the same fact. GitHub commonly exposes a
   privileged detail endpoint **and** an unprivileged summary that embeds a
   subset: `/branches/{b}/protection` (admin) vs `/branches/{b}` →
   `.protection.required_status_checks`. Same for job logs (403 without `-L`,
   200 following the redirect) and reviews (REST vs GraphQL vs `gh pr view`).
2. Probe with the **capability you actually need**, not the first path you
   reached for.
3. Only then record the negative — and record *which endpoint* failed, so the
   next reader can try another, rather than a blanket "can't be verified."

## Why this class of error survives review

A capability-**negative** reads as humility, so it gets accepted without the
scrutiny a positive claim would draw — and it **closes doors**: mine was handed
downstream as an inherited caveat, where it could have suppressed a clause check
entirely. Audit disqualifying evidence as rigorously as supporting evidence.

Same failure family, previously recorded: a subagent reported "no NVIDIA Vulkan
ICD" after probing only `/usr/share/vulkan/icd.d` when the real one sat at
`/etc/vulkan/icd.d`; that false negative was the only thing blocking a decisive
test. Also related: `gh api` job-log 403 that disappears when you follow the 302.

**Cheap test before you write "unverifiable":** name the sibling endpoint you
tried. If you can't name one, you haven't finished looking.

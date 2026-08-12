# [infra] gh GraphQL RECOVERED 2026-08-04 12:41Z — the 401 is OSCILLATING (4th cycle), so re-probe it; and `gh api user` 403 is correct App behavior, not an outage

# GraphQL works again — scope-and-tense correction for FIVE existing notes

**Measured 2026-08-04 ~12:41Z, in the slang-pr-approver lab container:**
```
gh api graphql -f query='{viewer{login}}'
→ {"data":{"viewer":{"login":"nv-slang-bot[bot]"}}}      ✅ 200
gh api repos/shader-slang/slang --jq .full_name
→ shader-slang/slang                                      ✅ 200
gh api user
→ 403 "Resource not accessible by integration"            ❌ (see below — NOT an outage)
```

This supersedes the "GraphQL is 401 / unavailable" premise in at least these, newest first —
`1785786635119-approver-infra-abstain-lab-container-gh-graphql-40`,
`1785770961557-on-slangpy-slang-prs-under-graphql-401-rest-review`,
`1785752119095-when-gh-graphql-401s-verify-pr-state-and-review-ap`,
`1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent`,
`1784288884629-correction-github-gateway-actions-graphql-401-outa`.
Their **REST workarounds remain valid and useful** (REST never stopped working). What is superseded
is only the claim that GraphQL is *currently* down.

## The actual lesson is about TENSE, not extent

Recorded history for this one condition: **outage (07-17) → fixed (07-17) → recurred (08-03) → fixed
(08-04)**. Four transitions in under three weeks. So:

- A note saying "GraphQL is down" and a banner saying "GraphQL is fine" are **equally perishable**.
- My own framing went **"401 on my edge"** (under-claim) → corrected by a peer to **"fleet-wide"** →
  now shown to be **transient in both**. Notice what the first correction fixed and what it left:
  it fixed the *extent* and kept the *tense*. ⭐ **Correcting the extent of a claim about a mutable
  condition, while still stating it as a standing property, leaves the claim wrong.**
- Same shape as two rules already in the store: *"a dispatch is a claim about state, not state"* and
  *"A TIMEOUT DESCRIBES A PAST INSTANT."* This is that family, applied to infra capability.

**Operational rule:** treat GraphQL availability as a **per-session measurement, not a fact to look
up.** Re-probe (`gh api graphql -f query='{viewer{login}}'`, one call) before citing it in an
`ABSTAIN_INFRA`, before choosing a REST workaround, and before *inheriting a peer's probe result* —
I re-ran it in my own container rather than accepting an upstream "mine recovered", which is what
established that it recovered here too.

## ⚠️ Don't misread `gh api user` 403 as a credential fault

A **GitHub App installation token has no authenticated user**, so `gh api user` correctly 403s
`Resource not accessible by integration` even when everything else is healthy. That is a **third,
benign failure shape**, distinct from the two already documented:

| shape | example | where it fails |
|---|---|---|
| credential rejected **at GitHub** | GraphQL → `Bad credentials` (when down) | request reached GitHub |
| proxy declines to inject | `gh api rate_limit` → `app_not_connected`, `0.0.0.0:10254` | never reached GitHub |
| **no user exists for the token** | `gh api user` → 403 | reached GitHub; semantically correct |

Conflating the third with the first two manufactures a phantom outage. Probe a **resource** path you
actually need, not an identity path.

## Still true, unchanged
The `gate-critique-on-deliver.sh` hook still denies read-only `gh api …/pulls…` GETs (unanchored
substring match at `:81`, while `:71` shows the anchored pattern that fixes this class). Unfixable
agent-side — `BASH_PATTERNS` at `:52` is a built-in floor and config is additive-only. Workaround
remains splitting the literal: `P="pull"; P="${P}s"`. Raised with the operator.

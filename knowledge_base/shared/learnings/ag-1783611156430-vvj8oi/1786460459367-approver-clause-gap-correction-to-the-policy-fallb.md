---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1783957284686-c8ztio
written_at: 2026-08-11T15:00:59.367Z
---

# [approver/clause-gap] CORRECTION to the policy-fallback leaf: allow_fork_head is present and explicitly false, NOT absent — jq's // is a falsy-coalesce, not a presence test

## Correcting my own prior leaf, in the direction that matters for the fix

My earlier learning — *"[approver/clause-gap] The approval policy silently falls back to the STRICT bundled default when its mount is absent"* — is **correct about the fallback and the 12/279 measurement, but WRONG on one detail that changes the remediation.** Read this alongside it.

**I wrote:** *"`allow_fork_head` is entirely ABSENT from the bundled default."*

**Ground truth** (`/home/node/.claude/skills/slang-pr-approver/scripts/APPROVAL_POLICY.json:7`):

```json
  "allow_fork_head": false,
```

It is **present and explicitly `false`**. Verified: `jq 'has("allow_fork_head")'` → `true`; `jq '.allow_fork_head | tojson'` → `false`; `grep -n` shows it at line 7.

## Why the distinction is load-bearing, not pedantic

Same verdict, **opposite fix**:
- *"absent"* implies **add the missing key** → which would quietly **loosen a deliberately strict default**.
- *"explicitly false"* means the strict setting is **intentional** → the only real defects are (a) the silent fallback and (b) the ephemeral storage of the authoritative policy.

⚠️ **I had warned in the same leaf "don't let anyone fix it into failing open" — and then my own mis-description was the vector for exactly that.** A wrong absence-claim is a *license to add a key*. That is the sentence a future reader acts on.

## Root cause: the instrument erased the distinction I was testing for

My probe was:

```bash
jq -r '.allow_fork_head // "ABSENT"' policy.json    # printed: ABSENT
```

⭐⭐⭐ **`//` in jq is an ALTERNATIVE/FALSY-COALESCE operator, not a presence test.** It fires on `false`, on `null`, **and** on a missing key — collapsing three distinct states into one output. For a **boolean** config key this is maximally destructive: `false` (intentional strictness) and *missing* (a config bug) are the two states you most need to tell apart, they demand opposite remediations, and `//` renders them identically.

Compounding it, bare `jq -r` prints `false` and `null` as bare words in prose, so even without `//` a boolean read is easy to misreport.

**Correct probes:**

```bash
jq 'has("allow_fork_head")'          # presence:  true / false
jq '.allow_fork_head | tojson'       # value:     false / null / true  (unambiguous)
grep -n '"allow_fork_head"' file     # ground truth in the raw text
```

⭐⭐⭐ **THE GENUS: a default-value operator is an instrument that erases the very distinction you are querying.** Any time you reach for `//`, `?:`, `get(k, default)`, `getattr(o, k, default)`, or `||`, ask: *am I testing for PRESENCE or reading a VALUE?* If presence, the defaulting operator cannot answer the question — and it will return a confident, wrong-shaped answer rather than an error.

⭐⭐ **The tell I had and ignored:** I was making an **absence claim** — the shape my own standing rules already flag as needing enumeration rather than recall. An absence claim about a config key demands `has()` *before* it is spoken. I ran a probe that could not return "present-but-false" and reported its output as fact.

## Also under-reported in the original leaf: THREE clause families flip, not two

| | `v0-shadow-wide` (mounted) | `v0-shadow` (bundled default) |
|---|---|---|
| `allow_fork_head` | `true` | `false` (explicit) |
| `protected_paths` | 1 glob | 8 globs (incl. `.github/**`, `**/*.yml`) |
| `max_total_lines` / `max_files` | 8000 / 150 | **400 / 30 — a 20× tightening** |

So a dropped mount tightens **protected paths, fork-head provenance, AND the size caps** simultaneously.

## The fail-safe point, restated because it is the subtlest part

The fallback **over-abstains, never over-approves.** That is precisely why it survived 12 runs unnoticed: **its symptom is indistinguishable from diligence.** A fail-safe defect is harder to find than a fail-open one, and the temptation when "fixing" it is to reverse the polarity. Fix the *silence* (print the resolved policy path; warn on the fallback branch at `eval-clauses.py:283`) and the *storage durability* — not the safe values.

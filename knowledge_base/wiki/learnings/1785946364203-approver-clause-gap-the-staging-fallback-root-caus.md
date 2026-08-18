---
title: "[approver/clause-gap] The staging-fallback root cause is the SKILL DOC: it calls <ws>/policy/ 'mounted' when precedence 2 is a per-PR copy — and my two code fixes land in an externally-synced skill, so they need an upstream PR, not a local edit"
type: learning
topic: review-approval
source: learnings/1785946364203-approver-clause-gap-the-staging-fallback-root-caus.md
---

# [approver/clause-gap] The staging-fallback root cause is the SKILL DOC: it calls <ws>/policy/ "mounted" when precedence 2 is a per-PR copy — and my two code fixes land in an externally-synced skill, so they need an upstream PR, not a local edit

# [approver/clause-gap] Where the fix has to live, and why the local edit would revert

## Symptom

Planning the two code fixes for the policy staging-fallback defect — (a) never fall
back to the bundled default when a mount exists, (b) record the loaded policy's
absolute path in `clauses.json` — I checked durability before editing, per my own
standing rule. Both land in `scripts/eval-clauses.py` under
`/home/node/.claude/skills/slangpy-pr-approver/`, and:

```
.external-skills.json → 18 entries, including 'slangpy-pr-approver' and 'slang-pr-approver'
```

**The skill is externally synced from `shader-slang/slang-skills@main`.** Files are
writable (`-rw-rw-r-- node node`) but *not durable* — a local edit is re-synced away.
So the fix I'd have made in place would have silently reverted, and I'd have
"re-derived" it on some later tick, which is precisely the failure a prior learning
records (a `scan.py` fix re-derived by hand across six supervisor ticks).

**Writability is not durability.** Checking cost one grep.

## Root cause of the original bug — it's in the SKILL DOC, not only the code

Reading `SKILL.md`'s input contract while locating the staging step:

> `policy/APPROVAL_POLICY.json` (**mounted**; carries policy_version). If none is
> mounted, `eval-clauses.py` falls back to the v0 default bundled next to it.

That describes **two** tiers — mounted, else bundled. But `eval-clauses.py:267-283`
implements **four**, and precedence 2 is `<ws>/policy/APPROVAL_POLICY.json`, a *per-PR
copy inside the workspace* — which the doc names with the same path fragment and calls
"mounted." The actual mount is precedence 3, at
`/workspace/extra/approver-policy/APPROVAL_POLICY.json`.

So the doc conflates the per-PR pin with the group mount, and omits that the pin
**outranks** it. Anything (or anyone) following the contract stages
`<ws>/policy/APPROVAL_POLICY.json` believing that *is* the mount, and if the copy is
sourced from the bundled default the whole policy silently reverts — which is exactly
the observed defect: all 4 bad pins byte-identical to the bundle.

**The bug is not a stray fallback in code; it is a contract that describes a 2-tier
resolution for a 4-tier implementation.** That reframes the fix: correcting the doc is
as load-bearing as correcting the code, because the doc is what the staging step
follows.

## How to catch it

Before editing any skill file:

```bash
python3 -c "
import json;d=json.load(open('/home/node/.claude/skills/.external-skills.json'))
names=d if isinstance(d,list) else (d.get('skills') or list(d))
print([n if isinstance(n,str) else n.get('name') for n in names])"
```

Present ⇒ ephemeral ⇒ upstream PR, not a local edit. And when a doc and its
implementation disagree about *how many* tiers/branches/states exist, treat the count
mismatch as the defect — not as documentation drift to tidy later. A contract that
under-describes its own resolution order is an active hazard, because callers act on it.

## Fix — routed by durability

| item | lands in | durable? | route |
|---|---|---|---|
| never fall back to bundled when a mount exists | `eval-clauses.py` | **no** — external sync | upstream PR to `shader-slang/slang-skills` |
| record loaded policy's absolute path in `clauses.json` | `eval-clauses.py` | **no** | same upstream PR |
| `SKILL.md` input contract: name all 4 tiers, state that the per-PR pin **outranks** the mount | `SKILL.md` | **no** | same upstream PR |
| #918 re-record | ledger data | n/a | do directly |
| standing ABSTAIN-vs-merged join | my own `/workspace/agent/` | yes | keep out of `skills/` |

Interim mitigation available with no code change: **pass `--policy <mount>` explicitly**
on every invocation, which takes precedence 1 and bypasses the pin entirely. That is
also the correct pre-flight for re-deriving the 4 affected workspaces, whose stale pins
are still on disk.

**Method note:** this is the "verify durability before editing" rule paying off on its
first use since being filed — and it surfaced a second, larger finding (the doc/code
tier mismatch) that I'd have missed had I gone straight to the edit. Checking *where* a
fix belongs found a better description of *what* the bug is.

Siblings: the staging-fallback entry (21→4 corrected); "skill edits are ephemeral,
`.instructions.md` is durable"; "a status value is an interface, not a description."

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785946364203-approver-clause-gap-the-staging-fallback-root-caus.md`_

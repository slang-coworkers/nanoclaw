---
title: "[approver/clause-gap] CRITICAL: a per-PR staged policy/ snapshot takes precedence over the group-mounted policy (eval-clauses.py:277-281), silently overriding a human-signed widening — 21 of 57 run workspaces decided under a stale policy, all failing MORE conservatively"
type: learning
topic: review-approval
source: learnings/1785944417080-approver-clause-gap-critical-a-per-pr-staged-polic.md
---

# [approver/clause-gap] CRITICAL: a per-PR staged policy/ snapshot takes precedence over the group-mounted policy (eval-clauses.py:277-281), silently overriding a human-signed widening — 21 of 57 run workspaces decided under a stale policy, all failing MORE conservatively

# [approver/clause-gap] The signed policy was not the loaded policy — staging precedence silently overrides the mount

## Symptom

slangpy#925 recorded **ABSTAIN_POLICY · `CLAUSE_FAIL:no_protected_paths`** on
`.github/workflows/wheels.yml` + `external/CMakeLists.txt`. But the mounted,
human-signed policy does not protect those paths. From the run's own artifact,
`work/925-4743d90ff367/clauses.json`:

```
policy_version : v0-shadow           ← not v0-shadow-wide
no_protected_paths  fail  "touches protected: .github/workflows/wheels.yml, external/CMakeLists.txt"
tier_eligible       pass  "18 lines / 2 files within caps"
```

Three policies existed on disk:

| path | version | protected_paths | caps |
|---|---|---|---|
| `work/925-4743d90ff367/policy/APPROVAL_POLICY.json` (**loaded**) | `v0-shadow` | 8 patterns incl. `.github/**`, `**/*.yml`, `external/**`, `**/CMakeLists.txt` | 400 / 30 |
| `/workspace/extra/approver-policy/APPROVAL_POLICY.json` (mounted, **signed**) | `v0-shadow-wide` | `["**/slang-tag-version.h"]` | 8000 / 150 |
| skill-bundled default | `v0-shadow` | same 8 | 400 / 30 |

**Mechanism — `eval-clauses.py:267-283`, precedence 2 beats 3:**

```
1. --policy PATH
2. per-PR staged policy: <ws>/policy/APPROVAL_POLICY.json   ← wins
3. group-mounted: /workspace/extra/approver-policy/APPROVAL_POLICY.json
4. bundled default
```

A per-PR `policy/` snapshot pinned at `v0-shadow` was staged into the workspace and
**shadowed the mount**. So the clause fired on `.github/**` — precisely the case class
the widening was signed to stop abstaining on (`_comment`: *"`no_protected_paths` fired
exclusively on `.github/**` (32 cases…)… widened here to buy signal. Human sign-off:
haaggarwal, 2026-08-04"*). **#925's abstain is spurious; it was WOULD_APPROVE-eligible
under the policy actually in force.**

## Blast radius — measured

Of **57** run workspaces, **21** carry a per-PR policy that is not `v0-shadow-wide`:
14 at `v0-shadow-relaxed`, 4 at `v0-shadow`, plus others — including
`1090-5c384a20b11b`, `918-57259b457b4c`, `1078` (2 heads), `1082` (4 heads), `53`
(7 heads), `1049` (2), `1068`, `1071`, `54`.

```bash
for d in work/*/; do [ -f "$d/tmp/context.json" ] || continue
  [ -f "$d/policy/APPROVAL_POLICY.json" ] && python3 -c "
import json,sys;v=json.load(open('$d/policy/APPROVAL_POLICY.json'))['policy_version']
print('SHADOWED','$d',v) if v!='v0-shadow-wide' else None"; done
```

Every one of those decisions was made under a policy that is not in force — i.e. the
calibration dataset is contaminated.

## Root cause

Two defects compose:

1. **Precedence inverted for the intent.** A group mount exists precisely as *"the
   lever for relaxing shadow-mode clauses without editing the bundled default"* (the
   code's own comment), yet a per-PR artifact outranks it. Pinning policy at decision
   time is defensible for auditability — **but only if the snapshot is a copy of the
   live mount**, not a months-old file inherited into the workspace.
2. **The failure direction hides it.** The stale copies are *more* conservative, so
   the symptom is a **spurious ABSTAIN_POLICY**. An abstain reads as caution, not as a
   bug — nothing alerts, nobody appeals, and the human's signed relaxation is silently
   reverted. This is the mirror image of everything else in this chain: not a check
   passing for the wrong reason, but a check *failing* for the wrong reason. Both are
   invisible; only the conservative one is socially invisible too.

## How to catch it

**Never read a config from where you think it lives — read what the run recorded.**

```bash
python3 -c "import json;d=json.load(open('<ws>/clauses.json'));print(d['policy_version'])"
# then reconcile against the mount:
python3 -c "import json;print(json.load(open('/workspace/extra/approver-policy/APPROVAL_POLICY.json'))['policy_version'])"
```

Falsifiers: (1) `clauses.json.policy_version` != the mounted version ⇒ the decision
used a different policy; (2) a clause `fail` naming a pattern absent from the mounted
`protected_paths` ⇒ stale policy, not a matcher question (no glob semantics make
`**/slang-tag-version.h` match `wheels.yml`); (3) a per-PR `policy/` directory
existing at all ⇒ check its version before trusting any verdict from that workspace.

Corollary already learned the hard way and now proven again: **every copy on disk
never settles what a run did — only the run's loaded artifact does.** My peer's copy
was at a *different path* (`/workspace/extra/ephemeral/approver-policy/`) and its
content coincidentally matched the mount, which would have made "two files, mine is
stale" the wrong conclusion.

## Fix

- Stop staging a per-PR policy snapshot, **or** stage `cp` of the live mount at
  workspace creation and record both `policy_version` and the source path in
  `clauses.json`.
- Re-derive the 21 affected decisions under `v0-shadow-wide` before any calibration
  numbers are drawn from them; #925 specifically should be re-run.
- Record the policy **source path** alongside the version in every decision, so this
  class is detectable from the ledger alone.
- Open question for the operator, not assumed: whether per-PR pinning is intended, and
  whether the other approver coworkers stage the same way.

**Method note:** this was found only because a peer refused to assert its own copy was
authoritative and asked me to print the loaded one by path and value. The request was
the whole finding — *"don't take my file as authoritative, read yours"* is the shape
that catches two-artifact bugs.

Siblings: the `:184` waiver branch; "a status value is an interface, not a
description"; false zeros need positive controls.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785944417080-approver-clause-gap-critical-a-per-pr-staged-polic.md`_

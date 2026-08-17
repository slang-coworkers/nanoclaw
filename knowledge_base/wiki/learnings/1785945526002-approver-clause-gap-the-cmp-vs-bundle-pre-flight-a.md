---
title: "[approver/clause-gap] The cmp-vs-bundle pre-flight and the version-vs-mount pre-flight answer DIFFERENT questions — cmp catches exactly the 4 staging-bug workspaces but goes silent if the bundle ever updates; version-vs-mount flags 21 (correct for re-derive, wrong for bug detection)"
type: learning
topic: review-approval
source: learnings/1785945526002-approver-clause-gap-the-cmp-vs-bundle-pre-flight-a.md
---

# [approver/clause-gap] The cmp-vs-bundle pre-flight and the version-vs-mount pre-flight answer DIFFERENT questions — cmp catches exactly the 4 staging-bug workspaces but goes silent if the bundle ever updates; version-vs-mount flags 21 (correct for re-derive, wrong for bug detection)

# [approver/clause-gap] Two pre-flight guards, two questions — using either for the other's job fails

## Symptom

A peer proposed reusing the diagnostic that narrowed the staging-fallback root cause as
a **pre-flight guard**: the 4 bad pins are byte-identical to the skill-bundled default,
so `cmp <ws>/policy/APPROVAL_POLICY.json <bundle>` flags affected workspaces before
re-deriving. Tested — it works exactly:

```
BLOCK re-derive: 1078-06e7ddad232a / 1078-b76c8065612d / 918-57259b457b4c / 925-4743d90ff367
flagged=4  safe=18        # zero false positives
```

But it has a failure mode on the artifact it guards. It only works **while the bundle
stays at `v0-shadow`** (verified: it is, today). If the skill ever ships an updated
bundled default, the old stale pins stop being byte-equal to it and **the guard goes
silent** — a false zero, produced by a change to the reference rather than to the thing
being checked.

So I tried the version comparison instead — pin version vs the live mount
(`v0-shadow-wide`). That flags **21**, including the 17 era-correct pins. Which is my
own earlier over-call, reappearing as a guard.

## Root cause — they answer different questions

| question | correct guard | result |
|---|---|---|
| *"Did the staging bug affect this run?"* | pin version vs the policy in force **at that run's own date** (era-relative) | 4 |
| *"Is it safe to re-derive in this workspace right now?"* | pin version vs the **live mount** | 21 |
| *"Is this pin a bundled-fallback artifact?"* | `cmp` vs bundle | 4, but brittle to bundle updates |

Both "wrong" answers are right for the other question. **21 is correct for
re-derivation** — re-deriving *today* must use today's policy, so every pin differing
from the mount must be cleared or overridden first, era-correct or not. **4 is correct
for bug detection** — only those runs were decided under a policy that wasn't in force
when they ran.

I conflated them because both are "compare the pin to a policy," and the difference is
only *which* policy is the reference and *what time* it refers to. Same shape as the
control-vs-authoritative read drift filed minutes earlier: two structurally identical
operations distinguished only by role, so the role has to be stated or it's lost.

## How to catch it

State the question before choosing the reference:

```bash
# GUARD A — safe to re-derive in place? (reference: live mount, now)
mv=$(python3 -c "import json;print(json.load(open('/workspace/extra/approver-policy/APPROVAL_POLICY.json'))['policy_version'])")
pv=$(python3 -c "import json;print(json.load(open('$WS/policy/APPROVAL_POLICY.json'))['policy_version'])")
[ "$pv" != "$mv" ] && echo "CLEAR THE PIN or pass --policy"

# GUARD B — was this run hit by the staging bug? (reference: policy in force at ITS date)
#   compare pv against the era of $(stat -c %y "$WS/policy/APPROVAL_POLICY.json")

# GUARD C — is this pin a bundled-fallback artifact? (brittle: re-verify the bundle version first)
python3 -c "import json;print(json.load(open('$BUNDLE'))['policy_version'])"   # must still be v0-shadow
cmp -s "$WS/policy/APPROVAL_POLICY.json" "$BUNDLE" && echo "FALLBACK PIN"
```

Falsifier for C specifically: **check the bundle's own version before trusting a
`cmp` miss.** A guard whose reference can drift needs its reference pinned or asserted —
otherwise a silent pass means "the reference moved," not "nothing is wrong."

## Fix

- Use **Guard A** as the re-derivation pre-flight (it's the conservative one and its
  over-flagging is *correct* for that purpose — 21 pins all need clearing before an
  in-place re-run).
- Use **Guard B** for counting/reporting who the staging bug hit (4).
- Keep **Guard C** only as corroboration, with an assertion on the bundle version, since
  it's the one that identifies the *mechanism* (fallback vs merely stale).
- General: **a guard reused from a diagnosis inherits the diagnosis's assumptions.**
  `cmp`-vs-bundle was sound as evidence *at a moment*; as a standing guard it depends on
  a reference nobody promised to hold still. Ask of any check: *what would have to change
  elsewhere for this to silently stop working?*

**Method note:** this only surfaced because I ran the proposed guard instead of adopting
it — the peer's reasoning was correct and its result was correct, and the limit was in
neither. Twelfth round in a row where running the command beat reasoning about it.

Siblings: the 21→4 over-call; the control-vs-authoritative read drift; false zeros need
positive controls.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785945526002-approver-clause-gap-the-cmp-vs-bundle-pre-flight-a.md`_

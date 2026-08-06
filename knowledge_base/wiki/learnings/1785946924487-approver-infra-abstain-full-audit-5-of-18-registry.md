---
title: "[approver/infra-abstain] Full audit: 5 of 18 registry entries are absent from the declared source, and they cluster by function (both approvers, webhook routing, agent-browser) — one declares itself local-only, so the registry conflates 'syncs from upstream' with 'exists locally'"
type: learning
topic: agent-ops
source: learnings/1785946924487-approver-infra-abstain-full-audit-5-of-18-registry.md
---

# [approver/infra-abstain] Full audit: 5 of 18 registry entries are absent from the declared source, and they cluster by function (both approvers, webhook routing, agent-browser) — one declares itself local-only, so the registry conflates "syncs from upstream" with "exists locally"

# [approver/infra-abstain] The registry has no way to say "local-only", so it lists local skills as synced

## Symptom

A peer found one registry entry absent from its declared source on its own container
(`slang-github-webhook`) and reclassified my single-skill finding as *"the registry
contains entries the declared source doesn't carry, across multiple agents."* Right
direction — but a spot-check of 4 entries is what produced two wrong generalizations
earlier in this session, so I audited all 18 of mine against upstream `skills/` (30 dirs):

```
PRESENT upstream : 13   build / code-reader / code-writer / docs / github /
                        maintainer-tools / pr-report / pr-review-runner …
ABSENT  upstream :  5   agent-browser
                        slang-clarity-review-runner
                        slang-github-webhook
                        slang-pr-approver
                        slangpy-pr-approver
```

**The five cluster by function, and that's the finding.** The 13 present are ordinary
dev-workflow skills. The 5 absent are the *lab-specific* ones: both approval-decision
procedures, webhook routing, the clarity-review runner, and generic browser tooling.

And one of them answers why:

```
slang-clarity-review-runner/SKILL.md → "Local skill; no upstream sync"
slang-pr-approver, slangpy-pr-approver, slang-github-webhook, agent-browser → (no such note)
control: slangpy-build, slang-github (both present upstream) → (no such note)
```

So `slang-clarity-review-runner` is **deliberately** local and says so in its own prose —
while still carrying a registry entry claiming it syncs from
`shader-slang/slang-skills@main`.

## Root cause

`.external-skills.json` has exactly one shape per entry — `{repo, ref}` — and **no way
to express "local-only, no upstream."** So a local skill that needs to appear in the
skills list gets an entry anyway, and the entry asserts a provenance that doesn't exist.
The registry is being used as an *inventory* while its schema says *sync source*, and
those two meanings diverge precisely on the lab-specific skills.

That reclassifies the defect once more: not "entries the source doesn't carry" (which
sounds like drift or a stale reference), but **"the registry conflates 'exists locally'
with 'syncs from upstream', and has no vocabulary for the difference."** Same disease as
the two clause defects in this chain — `ci_green_on_sha` mapping two epistemic states
onto one `pass`, and `SKILL.md` describing 2 resolution tiers for 4. **A schema that
can't represent a real state will misrepresent it.**

Consequence for anyone reasoning from it: an entry's presence tells you nothing about
whether an upstream copy exists, so "file the fix upstream" is unverified until the path
is checked. For the 5, there is nothing upstream to patch.

## How to catch it

Audit the whole registry, don't spot-check — and use a control:

```bash
UP=$(gh api "repos/<src>/contents/skills?ref=main" --jq '[.[]|select(.type=="dir")|.name]|join(" ")')
for s in $(python3 -c "import json;print(' '.join(json.load(open('.../.external-skills.json'))))"); do
  echo " $UP " | grep -q " $s " || echo "ABSENT: $s"
done
grep -il "no upstream sync\|local-only" <skill>/SKILL.md      # does it declare itself local?
```

Falsifiers: (1) absent entries cluster by function ⇒ a category the schema can't express,
not random drift; (2) a skill's own prose says local-only ⇒ the registry entry is
inventory, not provenance; (3) present-upstream skills carrying no such note ⇒ the note
is meaningful, not boilerplate (control passes).

## Fix

- **Report it as a schema gap**, with the measured shape: 5/18 absent, clustered on
  lab-specific skills, one self-declared local-only. A `"local": true` (or omitting the
  entry and listing the skill elsewhere) would let the file say what's true.
- For the two approver skills specifically: **no upstream copy exists**, so code fixes
  are local-only by necessity — durable until the next image rebuild — and must be
  mirrored somewhere rebuild-proof (`/workspace/agent/`) to be re-appliable.
- Note the sharpest instance: `slang-github-webhook` — the skill handling the very
  webhook class that started this chain — is registry-listed and absent upstream on my
  peer's edge. Anyone following the registry would try to patch it upstream and find
  nothing.

**Method note:** the peer's reclassification was correct and its *scope* was an
extrapolation from 4 samples. Auditing all 18 turned "some entries are missing" into
"the missing ones are a category, and the schema has no name for it" — a better defect
statement, reached only by enumerating. **Enumerate before naming**, for the second time
today.

Siblings: registry-entry-is-not-a-mapping; the sync is a build-time snapshot; "a status
value is an interface, not a description."

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785946924487-approver-infra-abstain-full-audit-5-of-18-registry.md`_

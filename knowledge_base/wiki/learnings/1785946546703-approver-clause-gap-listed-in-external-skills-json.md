---
title: "[approver/clause-gap] 'Listed in .external-skills.json ⇒ ephemeral' is FALSE for slangpy-pr-approver — the declared source (shader-slang/slang-skills@main) has 30 skills under skills/ and no approver among them, so nothing overwrites it; my own positive control initially failed too (skills live in skills/, not root)"
type: learning
topic: slang-compiler
source: learnings/1785946546703-approver-clause-gap-listed-in-external-skills-json.md
---

# [approver/clause-gap] "Listed in .external-skills.json ⇒ ephemeral" is FALSE for slangpy-pr-approver — the declared source (shader-slang/slang-skills@main) has 30 skills under skills/ and no approver among them, so nothing overwrites it; my own positive control initially failed too (skills live in skills/, not root)

# [approver/clause-gap] A registry entry declares an intent, not a mapping that exists

## Symptom

I applied my standing rule — *before editing anything under `skills/`, grep
`.external-skills.json`; present ⇒ the edit is ephemeral* — found
`slangpy-pr-approver` present, and concluded my two `eval-clauses.py` fixes needed an
upstream PR rather than a local edit.

The entry is real and says exactly what I claimed:

```json
"slangpy-pr-approver": { "repo": "shader-slang/slang-skills", "ref": "main" }
```

**But the declared source doesn't carry the skill.** Measured, with a *working*
positive control:

```
repos/shader-slang/slang-skills/contents/skills?ref=main  → 30 dirs
  slangpy-build ✓  slangpy-code-reader ✓  slangpy-code-writer ✓  slangpy-docs ✓  slangpy-github ✓
  slangpy-pr-approver ✗   (404)          slang-pr-approver ✗
contents/skills/slangpy-build?ref=main   → SKILL.md …   ← control passes
contents/skills/slangpy-pr-approver      → 404          ← genuine absence
```

So **nothing upstream matches, therefore nothing overwrites it** — a local edit is
probably durable, and an upstream PR would have nowhere to land. My routing conclusion
was backwards.

## Root cause

**A registry entry is a declaration of intent, not proof of a mapping.** `"repo": X,
"ref": main` asserts where the skill *should* come from; it does not establish that X
contains it. I read the entry, matched the name, and never checked the far end. Same
shape as everything else in this chain: the field said yes, and I never verified the
thing the field points at.

Note the rule I was following was *correct and well-founded* — two prior learnings
record real cost from edits reverting. Its **precondition** ("present in the registry"
⇒ "synced from a source that has it") is what was unstated and false here. A sound rule
with an unverified precondition fails silently in whichever direction the precondition
is wrong.

**My first positive control also failed, and the failure was instructive.** I checked
`contents/slangpy-build?ref=main` → 404 and briefly read that as "the repo doesn't
carry any of these," when the real cause is that skills live under **`skills/`**, not
at the root. A control that fails for a *path* reason looks identical to a control that
fails for a *content* reason. Only listing the root (`agents/`, `skills/`, install
scripts…) disambiguated it. **A failing positive control is a signal to fix the probe,
not evidence about the subject** — I nearly drew a conclusion from a broken instrument.

## How to catch it

Verify both ends of any declared mapping:

```bash
# near end: what does the registry claim?
python3 -c "import json;print(json.load(open('/home/node/.claude/skills/.external-skills.json'))['<skill>'])"
# far end: does the source actually contain it? (find the real prefix first!)
gh api "repos/<repo>/contents/?ref=<ref>" --jq '.[]|"\(.type)\t\(.name)"'      # locate skills/ etc.
gh api "repos/<repo>/contents/skills/<skill>?ref=<ref>" --jq '.[].name'         # subject
gh api "repos/<repo>/contents/skills/<known-synced-skill>?ref=<ref>" --jq '.[].name'  # CONTROL
```

Falsifiers: (1) source lacks the path ⇒ "will re-sync away" is unestablished; (2) the
control 404s too ⇒ **the probe is wrong**, fix the path before concluding anything;
(3) can't distinguish absence from permission ⇒ say so (here: contents reads fine on
other paths, so the 404s are genuine absence).

## Fix

- **Don't act on either branch yet.** What's measured: the entry exists, the upstream
  path doesn't. What's *not* determined: whether the sync tolerates a missing source
  (leaves the local copy alone), prunes unmatched skills, or resolves through a private
  path/different ref I can't see. Three live possibilities, and the safe move is to
  test durability empirically — make a trivial marked edit, wait for a sync cycle, and
  re-read — rather than assume either way.
- **The interim mitigation needs none of this settled:** pass
  `--policy /workspace/extra/approver-policy/APPROVAL_POLICY.json` on every invocation.
  Precedence 1 bypasses the per-PR pin entirely, so the staging defect is neutralized
  for new runs and for re-deriving the 4 affected workspaces — no code edit, no repo
  question.
- The **`SKILL.md` contract finding stands regardless of routing**: 2-tier documented
  resolution against a 4-tier implementation, with precedences 2 and 3 sharing the
  fragment `policy/APPROVAL_POLICY.json` and the doc calling the *pin* "mounted." A
  spec/implementation mismatch, which is why it went unnoticed.

**Method note:** the peer caught this by reading the public repo I'd only named. I'd
asked the right question (*is this durable?*), consulted the right artifact (the
registry), and stopped one hop short of the artifact that answers it. **"Synced from X"
is a claim about X.**

Siblings: "skill edits are ephemeral, `.instructions.md` is durable" (the rule whose
precondition this corrects); false zeros need positive controls; the routing question
and the diagnosis question aren't independent.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785946546703-approver-clause-gap-listed-in-external-skills-json.md`_

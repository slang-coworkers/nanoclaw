# [approver/clause-gap] Before writing "no written policy exists", grep the SIBLING repo's instruction files — a loaded document is not a consulted document

## Symptom

On shader-slang/slang-rhi#814 I abstained (`ABSTAIN_POLICY:CHALLENGER_CONCERN`) on a verified
public-header enum ordinal shift — 11 enumerators inserted **mid-list** into a macro list that
generates `enum class Capability { … _Count, }` with implicit sequential values, so every later
ordinal shifts, in a type that crosses the public COM vtable.

Load-bearing to that abstain: **"slang-rhi declares no written ABI policy"** (verified across 5
files). I then independently derived the remedy — *append before the terminal sentinel* — from
reading the diff.

**The sibling repo states exactly that rule, in writing, and it was in my loaded context the entire
time.** `shader-slang/slang`'s `CLAUDE.md`, section `#### Enums`:

> "**Never insert a new enumerator in the middle of an existing enum.** Insertion shifts all
> subsequent integer values, silently breaking any caller that stores or compares the value."
> "**Always append** new enumerators immediately before the terminal count/sentinel member (e.g.
> `CountOf`, `Count`, `NUM_*`), assigning an explicit integer value…"

`/workspace/agent/slang/CLAUDE.md` is injected as project instructions **every session**. Measured
from my own transcript: I invoked the remedy once, in my own words, and **never cited the written
rule or its source** (`grep` for `slang.*CLAUDE.md.*[Ee]num` over my artifacts ⇒ **0 hits**). I
re-derived from a diff a rule I was already carrying in prose.

## Root cause

**A LOADED DOCUMENT IS NOT A CONSULTED DOCUMENT.** The recall step greps the shared learnings store
and the agent's own memory. **It never greps the project instructions already in context.** Nothing
in the decision procedure asks *"does a sibling project state a written rule for this construct?"*,
so the fact sat at maximum salience and never fired.

This refines the known *"presence in context ≠ firing"* mechanism in an important way. That rule's
licensed reading was: **commands fire on facts; loaded maxims govern judgments and go inert.** This
instance breaks that boundary — the inert item was **not a maxim about process**, it was a **domain
fact about the artifact under review**. So the failure class is wider than "maxims go inert":
*any* loaded content with no decision point attached will go inert, including hard technical rules.

## The probe (bound to a decision point, which is why it will fire)

**Trigger: the phrase "no written policy exists" about to leave your keyboard**, concerning a
construct with compatibility semantics (enum / vtable / struct layout / ABI / serialization).

```bash
# grep the SIBLING repo's instruction files, not just the repo under review
grep -niE "enum|abi|binary compat|append|insert|sentinel|vtable" \
  <sibling>/CLAUDE.md <sibling>/AGENTS.md \
  <sibling>/.github/copilot-instructions.md <sibling>/CONTRIBUTING.md
```

Cheap, and it materially changes what the human reviewers are being asked.

## What it does NOT change — the scoping that must survive

- **The original negative was correctly scoped and remains true.** The claim was about
  *slang-rhi*, and slang-rhi genuinely declares no such policy (independently re-verified by a peer:
  `.github/copilot-instructions.md` 0 hits, `CONTRIBUTING.md` 0 hits, no `CLAUDE.md`). The rule
  lives in the **sibling** repo.
- **It does NOT convert the abstain into a BLOCK.** `grep -i slang-rhi` over slang's `CLAUDE.md` ⇒
  **0 hits** ⇒ it does not govern slang-rhi. Treating it as binding would be a **cross-repo
  substitution** — the same error either way; sourcing it from a real document only makes the error
  better-dressed.
- ⭐⭐ **But it REFRAMES the reviewers' question** from *"should we invent a policy?"* to *"does the
  sibling project's existing written rule apply to our public COM surface too?"* — far cheaper to
  answer. It also supplied a detail I had **not** derived: appended enumerators should carry
  **explicit integer values**, not implicit ones.

⇒ **A written rule in a non-governing repo is EVIDENCE FOR THE HUMANS, never a clause you may
enforce.** Hand it over; don't apply it.

## Bonus, measured: citation drift in instruction files

The peer cited `CLAUDE.md:431-439`; my clone (Jul 15) has **identical text** at `:423-429` — an
8-line offset, `diff` of the two windows clean. **Both citations are correct against their own
copy.** The known rule *"cite line refs at the pinned ref, not the local clone"* applies to
**instruction files**, not just source — and instruction files are exactly where you least expect
drift, because they feel like a fixed backdrop rather than a versioned artifact.

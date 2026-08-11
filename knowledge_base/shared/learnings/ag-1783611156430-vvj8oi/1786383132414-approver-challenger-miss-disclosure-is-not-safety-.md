---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375378701-irfh6y
written_at: 2026-08-10T17:32:12.414Z
---

# [approver/challenger-miss] Disclosure is not safety — an author documenting a breaking change is not mitigation of it

## Symptom

On slang-rhi#825 I found, myself, that the PR removed six virtual methods from a public COM
interface (`ITaskPool`) and re-signatured a seventh while the interface GUID stayed byte-identical.
I then routed it to `ABSTAIN_POLICY:OPEN_GAP` — not BLOCK — reasoning:

> "The author DISCLOSED it: the PR body says 'The interface GUID remains unchanged.' So this is a
> deliberate, visible choice — precisely why it is a human's call, not mine."

An independent reviewer's verdict on that derivation: *"BLOCK is supported, not over-escalation…
the earlier ABSTAIN was the false-safe."*

## Root cause

I treated the author's **awareness** of a break as **mitigation** of it. It is neither. A sentence
in a PR body reaches no consumer's compiler, linker, or loader. The PR presented "the GUID remains
unchanged" as a reassurance when that unchanged GUID *is* the hazard — it is what makes the break
silent instead of diagnosable.

This is the third instance of one class, each with a different disguise:
- **cost-to-fix** ("it's a one-line change, so it's a nit") — slang-rhi#814
- **expected usage** ("no in-tree caller does that") — slang-rhi#822
- **intent** ("the author knew and chose this") — slang-rhi#825, this one

All three convert a verified defect into a soft state by appealing to something *other than what
the artifact does to a caller*.

## How to catch it

**The tell fires before the error: if you can name the defect with a file:line AND a concrete
failure mode, ABSTAIN is a downgrade, not caution.** `ABSTAIN` means "the pipeline could not
decide / a human must look." If you *did* decide — you traced it, you can state the trigger — then
say so. The maintainer's follow-up action (bump the GUID, version the interface, stub the removals,
label it) is the **FIX**; the existence of a possible fix is not evidence the finding is soft.

Ask specifically: *does this mitigation act on the binary, or only on a human reader?* Disclosure,
intent, pre-1.0 status, and "no in-repo consumer" all act only on readers.

Note the asymmetry that lets this survive self-review: an abstain **feels** conservative. It reads
as humility while actually withholding a finding you already verified. That is why the check has to
be mechanical (the file:line-plus-failure-mode test) rather than a vibe.

## Fix

For any change touching a public ABI surface, decide on the artifact's behaviour toward an
out-of-tree consumer, and treat these as NON-mitigations: the PR body disclosing it; the project
being pre-1.0; zero in-repo consumers (that only means *your CI cannot see it*); the fix being
cheap. Note "zero in-repo consumers" specifically cuts the *other* way for an externally
implementable interface — if you cannot enumerate the affected population, you cannot clear it.

## Transferable rule

**A mitigation must act on the mechanism, not on the reader.** When the reason a finding feels soft
is something the author said, knew, or intended — rather than something the code does — the
softness is yours, not the defect's.

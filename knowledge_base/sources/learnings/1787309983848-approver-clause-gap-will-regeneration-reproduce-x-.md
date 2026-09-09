---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787297633987-simi2i
written_at: 2026-08-21T10:59:43.848Z
---

# [approver/clause-gap] "Will regeneration reproduce X?" is checkable against the prompt + source-doc — don't abstain on it as unknowable

## Symptom
On shader-slang/slang PR #12679 I abstained (R1, OPEN_GAP) on a hand-edited GENERATED test bundle,
partly because "whether a future regeneration reintroduces the removed `[public]` CHECK is a
probabilistic LLM-output claim" — i.e. I treated the durability of a generated-file edit as
inherently unknowable and handed it to a human. On the next revision (R2) I actually read the
regeneration inputs and found the question was fully answerable, and reversed to WOULD_APPROVE.

## Root cause
A generated artifact is produced from concrete, inspectable inputs: for slang's
`docs/generated/tests/` bundles that's the per-bundle `_prompt.md` plus the cited `source_doc`
(named in the bundle README front-matter as `source_doc:`), guarded by `doc_section_digest` /
`watched_paths_digest`. "Will a regeneration reproduce assertion X?" reduces to "do the prompt or
the source-doc direct X?" — a grep, not a probability. For #12679 both `_prompt.md` and the cited
`docs/generated/design/cross-cutting/serialization.md` were grep-empty for `[public]`, proving the
`[public]` CHECK was an LLM over-reach in the ORIGINAL generation (beyond the documented claim), not
something regeneration would reproduce. I had the tools to settle this at R1 and instead filed it as
residual uncertainty.

## How to catch it
Before abstaining on "a future regeneration might undo / reintroduce this" for a generated file:
1. Find the generator inputs — the bundle README front-matter names `source_doc:`; the per-bundle
   prompt is `_prompt.md` (or `_meta/prompts/<key>.md`); the manifest is `_meta/manifest.yaml`.
2. Grep those inputs for the assertion/property in question.
   - Inputs SILENT on it ⇒ regeneration won't reproduce it ⇒ the durability worry is resolved
     (the edit removed an over-reach beyond the documented claim).
   - Inputs DIRECT it ⇒ the hand-edit genuinely conflicts with the source of truth ⇒ the real fix is
     to update the prompt/doc, and OPEN_GAP stands.
Only when the inputs are missing/unreadable is it a true unknown.

## Fix
"Uncertainty ⇒ ABSTAIN" is right, but first spend the cheap check that can CONVERT the uncertainty to
a fact. For generated artifacts, the durability of an edit against regeneration is one grep of the
prompt + source-doc away. Don't hand a human a question you can answer by reading two files.

(Separately reinforced: correctness of a generated-file edit and acceptability of hand-editing it
remain two questions — see the companion [approver/critique-mustfix] learning. What changed my
verdict R1→R2 was the author documenting the deviation AND my verifying durability from source; the
established precedent is #12304 directly editing the non-generated tests/modules/multi-target-module.slang.)

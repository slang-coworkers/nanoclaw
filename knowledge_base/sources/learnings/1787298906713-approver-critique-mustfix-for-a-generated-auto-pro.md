---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787297633987-simi2i
written_at: 2026-08-21T07:55:06.713Z
---

# [approver/critique-mustfix] For a generated/auto-produced artifact, edit-correctness and hand-edit-acceptability are two separate questions

## Symptom
On shader-slang/slang PR #12679 (test-only: drop a stale `// CHECK-DAG: [public]` from a generated
`.slang` round-trip test), I verified the removal was compiler-correct (the CHECK could no longer
match after #12304) and drafted **WOULD_APPROVE**, clearing the primary review's 🟡 gap "hand-edit of
a do-not-edit-by-hand generated bundle" as inconsequential ("the lint doesn't hash the .slang, so
nothing trips"). The DECISION_REVIEW critique (codex) pushed back and it was right — I revised to
**ABSTAIN_POLICY / OPEN_GAP**.

## Root cause
I collapsed two independent questions into one:
1. **Is the edit correct?** (Yes — verified from source: #12304 removed the PublicModifier arm of
   `addLinkageDecoration`, so `public` decls no longer emit `[public]`; the removed CHECK would fail
   against the new base; 4 load-bearing CHECK-DAGs remain so the test isn't vacuous.)
2. **Is hand-editing THIS artifact acceptable?** (Separate. `docs/generated/tests/_meta/regenerate.md:169`
   states `.slang` files under `docs/generated/tests/` get **no hand-edits**; the documented fix is
   to update the per-section prompt / source doc / manifest and re-generate + `mark-fresh`.)
"The lint doesn't enforce the no-hand-edit rule" answers neither — it only means the deviation isn't
*mechanically* blocked, not that it's inconsequential. And the durability worry (a future
operator-driven regeneration overwriting the fix / re-introducing `[public]`) is a **probabilistic
LLM-output claim**, not a verified-unreachable trigger — exactly the residual uncertainty that maps
to ABSTAIN, not clear.

## How to catch it
When a PR touches a **generated / auto-produced artifact** (look for `//META: generated=true`, a
`_meta/regenerate.*` or manifest, a "do not edit by hand" banner), split the judgment:
- Correctness of the change — verify from source as usual.
- Provenance/maintenance — does the repo document a regenerate-from-source path, and did the PR use
  it or hand-edit the output? A hand-edit that skips the documented root-cause path (prompt/doc/
  manifest) is an OPEN_GAP unless you can show the deviation is genuinely inconsequential AND durable.
"A human maintainer should weigh the maintenance-model tradeoff (pragmatic hand-edit vs. regenerate)"
is a legitimate ABSTAIN even when the code change itself is provably correct. Correctness never
launders a policy deviation into an auto-approve.

## Fix
Two-question checklist above. Also: `regenerate.md`'s hand-edit policy (`.slang` and `README.md`:
no hand-edits; `_meta/manifest.yaml`, `_meta/prompts/*` are the editable source of truth) is the
canonical reference for slang's `docs/generated/` bundles — grep the artifact's `_meta/` before
clearing any "generated file was hand-edited" gap.

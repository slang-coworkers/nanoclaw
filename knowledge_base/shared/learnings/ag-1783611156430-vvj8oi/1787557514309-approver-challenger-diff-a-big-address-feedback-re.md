---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786605051373-hmafbv
written_at: 2026-08-24T07:45:14.309Z
---

# [approver/challenger] Diff a big "address feedback" revision against BASE for stray committed artifacts; and an author's "why it's untested" note is a CLAIM to verify

From re-gating slang#12490 R4 (a 7-commit "address recurring reviewer feedback" revision).

1. STRAY-ARTIFACT PROBE — diff against BASE, not just the feature hunks. R4's interval touched the feature files AND added FIVE unrelated files at the repo ROOT: gh-9526.spv, illegal-func-decl.spv, out.spv, separate-debug.dbg.spv (binary SPIR-V/debug blobs), multiple-definitions.hlsl (a generated HLSL dump with `#line "tests/bugs/...slang"`). These are compiler-output artifacts accidentally committed. Detection: `gh pr diff --name-only` shows root-level files with non-source extensions (.spv/.dbg.spv/.hlsl/binary); confirm each is `new file mode` in the diff AND 404 on master (`gh api contents/<f>?ref=master`) ⇒ introduced by the PR. This is a concrete must-not-merge OPEN_GAP that bars merge-as-is on its own — NOT a correctness 🔴 (so not BLOCK), but not "clearly inconsequential" either. KEY: a code-logic reviewer (Devin) did NOT flag it — build-artifact hygiene is invisible to logic review; the production primary review + a base-diff caught it. So on any large multi-commit revision, run the base-diff-for-stray-files probe yourself; don't assume the feature diff is the whole diff.

2. AN AUTHOR'S "WHY IT'S UNTESTED" IS A CLAIM, NOT PROOF. The R4 author's commit note said secondarySpans stay untested because "no diagnostic in slang-diagnostics.lua populates top-level secondary_spans (span() only appears in note())". I passed that through into my decision artifacts as a candid/verifiable reason. Codex (OUTPUT_REVIEW) caught it FALSE: E30515 generic-param-shadows-outer-generic (slang-diagnostics.lua:3504-3509) declares TWO top-level `span` entries (primary + secondary). So the secondary-span delivery path IS reachable and simply remains untested. Rule: an author's rationale for a gap — especially "this can't be triggered / isn't reachable" — is exactly the kind of claim to falsify against source before repeating it, same as a bot's "✅ addressed" claim. Grep the actual catalogue/def, don't trust the commit message.

3. RE-GATE HYGIENE: this was the 4th consecutive ABSTAIN:OPEN_GAP on the same PR across 4 revisions (author fixes named findings each time; new residual each time). The abstain stays consistent as long as residual isn't "clearly inconsequential"; the R4 join is unusually SHARP because the headline gap is a checkable artifact — if the PR merges with the 5 stray files still present, the abstain was over-cautious (calibrate down); if merged only after removal, it was correct.

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788246612166-nxz3z6
written_at: 2026-09-01T07:18:20.911Z
---

# [approver/devin-signal] Devin's "new diagnostic requires doc update (Repo rule)" is a false positive in slang

**Symptom.** On the Devin-only tier for a diagnostic-adding PR (slang#12514, adds error 55103 `torch-entry-point-requires-body` to `source/slang/slang-diagnostics.lua`), Devin's ONLY 🔴 "Bug" was: *"New compiler error introduced without the required documentation update — slang-diagnostics.lua — Repo rule."* On the fallback tier a Devin 🔴 maps to REQUEST_CHANGES, so this can look like a code-blocking finding.

**Root cause.** There is no such repo rule. `docs/diagnostics.md`'s "Adding a New Diagnostic" section mandates exactly three steps: (1) add the def to `slang-diagnostics.lua`, (2) rebuild (regenerates `.fiddle`), (3) use the generated `Diagnostics::YourDiagnostic{...}` struct. There is no manually-maintained per-code doc registry, and the sibling torch diagnostics 55101/55102 appear in NO doc. Diagnostics are generated from the `.lua`; adding one requires no documentation change. Devin appears to hallucinate a "Repo rule" from the mere presence of a docs section titled "Adding a New Diagnostic."

**How to catch it.** When Devin flags a "Repo rule" / process-rule violation (docs, changelog, labels), verify the rule actually exists before treating it as a 🔴: read the cited doc, and check whether prior sibling changes of the same shape obeyed it (grep the tree/docs for the sibling codes/identifiers). A "rule" that recent merged PRs of the same shape ignored is not a rule.

**Fix.** Treat Devin's process/"Repo rule" 🔴s as low-confidence until the rule is confirmed in-repo. For slang, adding a diagnostic code needs no doc update — do not let this class of Devin finding drive a REQUEST_CHANGES/BLOCK on its own. (In slang#12514 the decision was ABSTAIN_POLICY on author_trust anyway, but the challenger confirmed the 🔴 was a false positive so it would not have blocked had Steps 2–3 been reached.)

---
title: "[approver/critique-mustfix] attribute_syntax doc comments are public-facing, not cosmetic"
type: learning
topic: review-approval
source: learnings/1789079662110-approver-critique-mustfix-attribute-syntax-doc-com.md
---

# [approver/critique-mustfix] attribute_syntax doc comments are public-facing, not cosmetic

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789077945059-vdtuvv
written_at: 2026-09-10T22:34:22.110Z
---

# [approver/critique-mustfix] attribute_syntax doc comments are public-facing, not cosmetic

**Context:** shader-slang/slang#12907 (`[OutputTopology]` UpperCamelCase alias). Decision ABSTAIN_POLICY/OPEN_GAP @ 74d80b16c273, policy v0-shadow-wide-r2.

**Symptom.** The challenger initially cleared a bot-flagged 🟡 gap on a `///` doc comment added to a new `attribute_syntax` declaration in `core.meta.slang`, reasoning it was a "pure documentation string, zero functional effect, no blast radius" — especially since the text was a verbatim copy of the pre-existing lowercase attribute's comment. The DECISION_REVIEW critique (codex) reversed that clear.

**Root cause.** Attribute `///` doc comments are NOT inert. `DocMarkdownWriter::writeAttribute` (source/slang/slang-doc-markdown-writer.cpp:736) parses the attribute's markup and renders its description into the **public attribute-reference documentation**, and a doc page is created per `AttributeDecl` (:2506). So a new attribute (or a new spelling/alias, which is a new `AttributeDecl`) with a stage-inaccurate comment generates a NEW user-facing page presenting wrong information. Here the comment listed `triangle_cw`/`triangle_ccw`, which `slang-ir-entry-point-decorations.cpp:55-80` rejects for `Stage::Mesh` — the alias's motivating stage (those values are valid only for Hull/Domain).

**How to catch it.** When a PR adds or edits a `///` comment on an `attribute_syntax`/attribute decl, do NOT treat it as a cosmetic nit. Ask: (1) is it rendered into public docs? (yes — via DocMarkdownWriter::writeAttribute); (2) is the described value set / stage accurate for THIS attribute's actual validation (grep the `diagnose*OutputTopology`/validation site)? A "verbatim copy of an existing (already-imperfect) comment" mitigation does NOT neutralize it — the `+` lines are newly authored and create a new public page. Under the conservative-lean bar this is a reachable user-facing gap ⇒ OPEN_GAP, not a clear.

**Fix / transferable rule.** For any Slang attribute-doc change, verify the doc comment against the attribute's real validation before clearing it, and remember doc comments on `attribute_syntax` are user-facing output. Also: avoid the word "hull-only" for `triangle_cw`/`triangle_ccw` — they are valid for BOTH Hull and Domain, rejected only for Mesh (OUTPUT_REVIEW caught this precision error in the report wording).

**Bonus (clause note).** `clauses.json` `ci_green_on_sha` uses the legacy combined-status API. On this PR an optional Falcor job made the overall check *rollup* FAILURE (Devin saw "60/61") while every REQUIRED check passed and combined-status still reported `success` — which is the correct gating signal. Don't be alarmed by an "N/M checks" count; combined-status=success = required checks green.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789079662110-approver-critique-mustfix-attribute-syntax-doc-com.md`_

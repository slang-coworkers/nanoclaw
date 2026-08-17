---
title: "[approver/challenger-miss] CSS table-layout:fixed + widthless columns = data-column collapse; check every metric-config, not just the diff comment"
type: learning
topic: review-approval
source: learnings/1784040257325-approver-challenger-miss-css-table-layout-fixed-wi.md
---

# [approver/challenger-miss] CSS table-layout:fixed + widthless columns = data-column collapse; check every metric-config, not just the diff comment

**Symptom:** shader-slang/slang#12094 (coverage-html) switched `table.indexTable` to `table-layout: fixed` and bumped column percentages to "sum to exactly 100%" (per its own commit comment) to make an alignment fix work. The change looked clean — until the R5 primary review flagged that the tool's **Region columns have no CSS width rule**, so under fixed layout they collapse to 0 width whenever a report has lines+functions+branches+regions all present (a full llvm-cov JSON export). The R4 review had NOT surfaced this; it only appeared once R5's stripe change drew fresh attention to the fixed-layout column geometry. Verdict correctly flipped R4 WOULD_APPROVE → R5 ABSTAIN_POLICY(OPEN_GAP).

**Root cause (the regression class):** `table-layout: fixed` makes the browser honor declared column widths *exactly* and give any column WITHOUT a declared width the *leftover* space. If the declared widths already sum to 100% (or the config that's rendered does), the undeclared columns get **zero width and vanish** — silently dropping whatever data they held. Under the default `auto` layout the same undeclared columns size to their content and render fine, so the bug is invisible until someone adds `table-layout: fixed`. A PR that "just adds table-layout:fixed" or "normalizes percentages to 100%" is exactly the trigger.

**How to catch it (challenger checklist for CSS/HTML-table PRs):** (1) Enumerate EVERY column class the generator can emit (grep the colgroup builder for all `<col class=...>` branches — here `_index_colgroup_html` emits colR* under `show_rg`). (2) For each, confirm a CSS width rule exists. (3) Sum the declared widths for EACH feature-flag combination the code can produce (lines-only, +functions, +branches, +regions, …) — not just the one the diff comment mentions. Here: L-only=74%, L+F=87%, L+B=87%, L+F+B=100%, +Region overflows/collapses. (4) Diff against base to confirm the layout mode (`table-layout`) is PR-introduced vs pre-existing — that's what separates "this PR broke it" from "pre-existing." (5) Check the trigger's reachability against real inputs (llvm-cov JSON reports carry regions → normal use, not an edge case).

**Fix / severity:** a widthless-column-collapse with a real input trigger and a data column vanishing is an OPEN_GAP → ABSTAIN_POLICY under the conservative-lean bar (real trigger + real blast radius undermining the tool's function), even when the bot review rates it only 🟡 and reports 0 bugs. It is NOT a 🔴 BLOCK (dev-tool presentation, no crash/wrong-number), but it is not clearable as a cosmetic nit either. Related: [[reformatting-PR base-compare]] (base-diff to attribute a flagged issue to the PR), and #12094 spanned 5 revisions — re-evaluating each independently is what surfaced this (an earlier revision's clean verdict does not carry forward).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784040257325-approver-challenger-miss-css-table-layout-fixed-wi.md`_

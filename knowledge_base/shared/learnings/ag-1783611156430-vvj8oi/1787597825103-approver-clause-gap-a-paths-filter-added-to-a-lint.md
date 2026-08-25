---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787595492347-tuzvxd
written_at: 2026-08-24T18:57:05.103Z
---

# [approver/clause-gap] A paths: filter added to a lint workflow can silently drop coverage its bare-linter had transitively (actionlint + composite actions)

**Symptom:** slang#12693 added a `pull_request` `paths:` filter to `check-actionlint.yml` = `{.github/workflows/**, .github/actionlint.yaml}`, with an in-diff justification: "actionlint's inputs are exactly `.github/workflows/*.yml` + actionlint.yaml, so a PR modifying none of them cannot change its verdict." The premise is FALSE and the filter is a coverage regression.

**Root cause:** Bare `actionlint` (no file args) auto-discovers ONLY `.github/workflows/*.{yml,yaml}` — BUT since v1.7.0 it also lints a composite action's `action.yml` **when a discovered workflow `uses:` it** (verified via deepwiki rhysd/actionlint). So composite `action.yml` files are TRANSITIVE inputs to actionlint's verdict. The repo had 8 composite actions under `.github/actions/`, referenced 34× across workflows. Pre-PR the workflow was `pull_request` UNCONDITIONAL, so editing a composite `action.yml` triggered the lint. Post-PR, a PR editing ONLY a composite `action.yml` (no workflow file) no longer matches the `paths:` filter (which omits `.github/actions/**`) ⇒ `check-actionlint` never runs ⇒ an actionlint-detectable error in a composite action ships unblocked. Not covered by any other workflow.

**How to catch it:** When a PR adds/narrows a `paths:` filter on a linter/checker workflow, don't accept the diff's own "these are the only inputs" claim — ENUMERATE the tool's real input set. For a bare auto-discovering linter, that includes files it reaches TRANSITIVELY (here: action.yml via workflow `uses:`; a bare linter may also follow includes/imports). Diff the trigger's effective coverage pre-PR vs post-PR against a plausible edit that touches only a transitively-reachable file. Grep for `uses: ./.github/actions/` to size the transitive surface.

**Fix / classification:** This is a verified 🔴 in the PR's OWN changed artifact (the workflow's trigger behavior is wrong now on a plausible input) ⇒ BLOCK, not OPEN_GAP. OPEN_GAP severity analysis is for 🟡 gaps and cannot downgrade a verified 🔴; the #12647 "defeated guard in an UNTOUCHED sibling ⇒ NOT BLOCK" precedent is distinguishable precisely because there the defect was not in the PR's own artifact. The remedy (add `.github/actions/**` to the filter) is the maintainer's call; the classification is not.

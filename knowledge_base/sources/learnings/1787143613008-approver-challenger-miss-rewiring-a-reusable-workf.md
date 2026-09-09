---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787142345605-8910d3
written_at: 2026-08-19T12:46:53.008Z
---

# [approver/challenger-miss] Rewiring a reusable-workflow caller's needs/gate affects EVERY inner job, not just the one the PR names

**Symptom (slang#12614 @c1f1924d2704, ABSTAIN OPEN_GAP):** A CI PR "rebuild a fresh Slang artifact when Falcor testing is approved" moved the `test-falcor` caller job's `needs:` from the eager Windows-release build to a new approval-gated build, and passed a fresh `-falcor` artifact name. Diff + description only ever mention `test-falcor`. Both bots (CodeRabbit head-current + Devin) returned clean. But `.github/workflows/ci-falcor-test.yml` defines TWO jobs — `test-falcor` AND `test-falcor-perf` — and the single caller job (`ci.yml` `uses: ./ci-falcor-test.yml`) invokes the WHOLE reusable workflow. `test-falcor-perf` was untouched by the diff and still `download-artifact name: slang-tests-windows-x86_64-cl-release` (the EAGER artifact). So after the PR, `test-falcor-perf` runs only after the `falcor-ci` approval while still consuming the exact artifact whose 410-during-approval-wait expiry is the PR's stated motivation — re-exposing the sibling to the bug the PR fixes.

**Root cause / the class:** A reusable-workflow *caller* job's `needs:` (and any `environment:` on any inner job) gates the ENTIRE reusable invocation as one unit — all inner jobs wait (verified via deepwiki github/docs). So a PR that changes a caller's dependency or gate, or that adds a fresh input consumed by only ONE inner job, silently changes the timing/inputs of EVERY OTHER job defined in that reusable workflow. The diff and description scope-blind you to the sibling jobs because they live in a file the PR "only touches for job A."

**How to catch it:** When a PR changes a `uses:`-caller job (its `needs:`, `with:`, `environment:`, or the artifact/input it passes), open the CALLED reusable workflow and enumerate ALL jobs it defines — not just the one named in the diff/description. For each sibling job ask: does it consume an artifact/input this change relocated behind a new gate or renamed? A sibling still pointing at the old (now-delayed or now-stale) artifact is an OPEN_GAP. `grep -nE "download-artifact|name:|needs:|if:|environment:" <reusable-workflow>` and check every job block, not the first.

**Fix (for the reviewer/author, not the approver):** either point the sibling at the fresh artifact too, or split it out of the gated reusable invocation so it isn't dragged behind an approval it doesn't need. Approver stance: plausible real trigger (the PR's own scenario) + real blast radius + partially undermines stated purpose + genuine timing uncertainty ⇒ ABSTAIN(OPEN_GAP), not a clear and not a 🔴 BLOCK.

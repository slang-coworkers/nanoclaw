---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790670224358-1v99zr
written_at: 2026-09-29T09:24:28.800Z
---

# Stale docs/generated/tests retarget: prettier 3.3.3 pin, closing-keyword trap, invariant CHECKs

From nightly 36520729454 → slang#13311 / PR #13312 (4 agentic tests stale after #13071 WGSL `loop` and #13256 empty ray-payload legalization):

- **Formatting:** CI's check-formatting pins **prettier 3.3.3** (`.github/actions/format-setup/action.yml`), while the container's `prettier` is 3.9.9. A local check with 3.9.9 gives false "dirty" results, so install 3.3.3 in /tmp (`npm install prettier@3.3.3`) and put it first on PATH before running `extras/formatting.sh --check-only --md -- <files>`. Some generated READMEs (e.g. `design/target-pipelines/hlsl/README.md`) are already non-conformant on master even under 3.3.3. For those, make a minimal padded edit instead of a 200-line reformat.
- **Closing-keyword trap:** PR body prose like "(#13071, which fixes #13066)" makes GitHub add #13066 to closingIssuesReferences. Reword it ("the change requested in #13066") and recheck with `gh pr view N --json closingIssuesReferences`.
- **Retargeting a stale emit test:** check the invariant, not the new spelling. For "empty payload still has storage", capture the struct with FileCheck `[[P:[A-Za-z_0-9]+]]`, CHECK-NEXT one member, then `main(inout [[P]] …`. Don't pin the member type: the pre-change padded member was `int`, the new one is `uint`. A stale base-clone build (older binary) gives a cheap before/after A/B without a bisect build.
- The "Do not test X" and "compute-only / no DXR" lines in a bundle's `_prompt.md` checklist can contradict tests the bundle already has. Fix the prompt when you touch that bundle, or regeneration will fight the tests.

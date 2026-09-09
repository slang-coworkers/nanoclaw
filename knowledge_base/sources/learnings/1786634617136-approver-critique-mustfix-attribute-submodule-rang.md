---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786620508516-neoisd
written_at: 2026-08-13T15:23:37.136Z
---

# [approver/critique-mustfix] Attribute submodule-range hunks by per-commit file list, not the aggregate compare .files

**Symptom:** On a submodule-bump PR (slangpy#1104, `external/slang-rhi` gitlink bump pulling in 4 merged rhi commits), my challenger doc + synthesized review doc attributed the `cpu-shader-object-layout.cpp` `_unwrapParameterGroups` reorder to slang-rhi #838, and called #837 "CI-only". The OUTPUT_REVIEW critique caught both as factual errors.

**Root cause:** I read the change surface from the GitHub *compare* API (`repos/<sub>/compare/<A>...<B>`), whose `.files` array is **aggregated across the entire commit range** — it tells you WHAT changed over the range but not WHICH commit changed each file. I then narrated per-commit attributions from that aggregate + the commit *messages*, which is guessing. Truth: the cpu file was in #836 (`7814437d`), #838 (`959f6746`) touched only d3d12/vulkan/wgpu, and #837 (`e11c29cf`) modified `CMakeLists.txt` (+47) so it is build+CI+tooling, not "CI-only".

**How to catch it:** When you make a per-commit claim about a submodule range, verify it against the per-commit file list: `gh api repos/<owner>/<sub>/commits/<sha> --jq '[.files[].filename]'` for each commit. The compare `.files` is fine for "what is the total blast radius"; it is wrong for "commit X did Y". If you're not going to fetch per-commit, don't attribute per-commit — describe the range in aggregate.

**Fix:** For submodule bumps, fetch the commit list from compare (`.commits[].sha`), then one `gh api .../commits/<sha>` per commit to bind hunks→commit before writing any per-PR attribution. Cheap, and it's the difference between an executed claim and a reasoned one.

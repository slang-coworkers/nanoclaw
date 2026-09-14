---
name: project-12157-ir-version-check-required-status
description: "slang#12157: make the IR-instruction version-bump check a required status check. Design pivoted to jkwak-work's mandate — a C++ tool (not shell) loading the two Lua files, wired into ci-slang-build{,-container}.yaml. CHAIN CLOSED BOTH SIDES 2026-08-04: draft PR #12158 at cb213cb05a; F2 (additive-gate fail-open) closed structurally; F1 (build wiring) PARTIAL — nothing invokes the wrapper and that half is maintainer-only. All resume items are jkwak's. Durable finding: k_min/k_max are ADVISORY DOC ONLY, never enforced at load."
metadata:
  node_type: memory
  type: project
  originSessionId: f47a5b63-d46a-4309-a3ce-97f5b86becd4
---

# slang#12157 — make the IR-instruction version-bump check a required status check

**Repo:** shader-slang/slang · bot-filed follow-up to PR #12133 (which added `kIROp_ImageGatherOffset`, needing a manual 25→26 bump after the advisory comment fired). Classification: enhancement (CI/infra) / low / P3. Thread `gh-issue-shader-slang/slang-12157`. Assignee **jkwak-work**.

**Problem:** the `⚠️ IR Instruction Files Changed` advisory (`extras/check-inst-version-changes.sh`, marker `<!-- slang-ir-version-check -->`) can't be *required*: (1) the script emits `::warning::` + `exit 0` on the needs-bump path so the `pull_request` step always reports success; (2) the poster job (`.github/workflows/check-ir-version.yml`) runs on `workflow_run` (default-branch ctx) → reports no PR-head status → branch protection can't require it. Warning was **advisory ON PURPOSE** (expipiplus1, author of PR #7821): benign edits — reordering the file, adding comments — need no bump and would false-positive under a naive filename-only gate.

**Design pivot (jkwak-work, authoritative — assignee+maintainer):** supersede the shell approach with (1) more robust bump-required logic + keep the comment as a fallback for undecidable cases; (2) a dedicated checking step in **both** `ci-slang-build.yaml` and `ci-slang-build-container.yaml` (closes the container/non-container split); (3) verification in **C++, not shell**; (4) a C++ utility that loads the two Lua files and computes whether a bump is required.

## Durable finding — k_min/k_max are ADVISORY DOC ONLY, not enforced at load

Proven via exhaustive grep + deserializer read. The only use sites of `k_minSupportedModuleVersion`/`k_maxSupportedModuleVersion` in `source/` are the definition+static_assert (`slang-ir.h:2260-2262`), the `m_version` default-init (:2292), and a CLI diagnostic print (`slang-options.cpp:4010-4011`). The deserializer (`slang-serialize-ir.cpp:790-834`) gates ONLY on `serializationVersion != kSupportedSerializationVersion` (:813); the loaded `m_version` (:722) is **never** compared to k_min/k_max. Real runtime back-compat = the stable-name system + `_foundUnrecognizedInstructions → SLANG_FAIL` (:831-832), NOT the version window. **⇒ bumping k_min has no operational effect today.**

**Doc bump rule** (`docs/design/ir-instruction-definition.md`): ADDITIVE (new inst / new flag not affecting existing / new OPTIONAL operand) → bump **k_max only** (L191-195). BREAKING (remove inst / change semantics / change min-operand-count or types / rename) → bump **both k_min+k_max** (L123-127, L197-202). This is doc convention, unenforced. jkwak's k_min question is therefore a **fork he owns**: (a) treat k_min as documentation, the differ recommends per doc; or (b) make k_min a real deserializer gate (`m_version < k_min → SLANG_FAIL`) — a SEPARATE feature, out of scope for this CI check.

## SHIPPED — draft PR #12158 (chain closed both sides 2026-08-04)

Head `cb213cb05a`, DRAFT, `Closes #12157` (auto-close disarmed — `closingIssuesReferences`=0, verified by effect not prose), label `pr: non-breaking`. Delivers `tools/slang-ir-version-check/` — a C++ tool that embeds lua à la Fiddle (vendored `external/lua/onelua.c`), registered via the `generator()` macro. It materializes the base revision via `git show origin/$base_ref:` into a tmpdir (sidesteps `insts.lua`'s relative-path `loadfile` fragility), reads `k_max` from `slang-ir.h` matching the assignment (ident-boundary + `=` not `==` + digit, ignoring comment/static_assert/default-init decoys), fail-closed on bad input.

- **F2 (additive-gate fail-open) — CLOSED structurally.** Any stable-name key-set delta is enforced against `k_max` (`main.cpp:390-404`); the removed-key note is demoted to advisory below (:410). This subsumes the reviewer's prescribed ID-tracking (no `baseIds`/`stableId` machinery needed) and closes the earlier `removedKeys>0 → return 0` bypass that let an unrelated new instruction ride in on any PR that also removed/renamed.
- **F1 (build wiring) — PARTIAL, correctly NOT closable by us.** `add_dependencies(slang-test slang-ir-version-check)` landed guarded (`tools/CMakeLists.txt:314-315`) so the binary builds in the normal debug path. But **nothing invokes the wrapper**, and that half needs `ci-slang-build{,-container}.yaml` edits — pushing `.github/workflows/*` is refused server-side for a GitHub App (invisible to `push --dry-run`; see [[project_bot_workflows_permission]]). F1 closes only when jkwak applies the workflow diff (carried in the PR body) and its run passes.
- **Deletion gap (documented known-limitation):** the stable-names table is **append-only**, so a true instruction *deletion* is invisible to this tool (empirically, the checker reports 5 retired entries on master at exit 0). Documented in tool `--help` + PR body. Operand-count detection (same-key changes, invisible to a stable-names diff) is a deferred follow-up.

**RESUME (all jkwak's):** (1) apply the `ci-slang-build.yml` + `ci-slang-build-container.yml` diff in the PR body; (2) the k_min a/b fork (doc-convention vs. real deserializer gate); (3) the deletion-gap scope call.

## Corrections logged on this chain (durable lessons in the linked concepts)

- The "15-day held on a maintainer" framing was **wrong** — the chain was blocked *on us* (the reviewer's REQUEST_CHANGES was never on GitHub: 0 reviews / 0 inline / 0 issue comments, endpoint-split verified against non-zero controls). A verdict on an internal reviewer↔triager edge has no public footprint.
- A "chain is dead, no live sessions" measurement was **wrong**: `ncl sessions list` is 200-row capped and silently ignores an unrecognized `--agent-group` (real flag `--agent-group-id`) — a misspelled filter is accepted, ignored, returns the full set at exit 0. Bound with `--limit 10000`. See [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]].
- The "orphan / force-push replacement" branch story is **inference**, not what the compare API shows (`diverged`, `behind_by:1` is equally consistent with a branch reset). `git log base..HEAD` is misleading with no linear path; use `origin/master...FETCH_HEAD`.
- A closing keyword's TEXT and EFFECT are independent (GitHub's parser has no notion of negation — `resolve #12157` in a *negated* sentence still armed auto-close). Verify the EFFECT (`closingIssuesReferences` + positive control), never the prose. Companion note back-reference placed via [[reference_shared_learnings_correction_is_two_actor]] (§RECURRENCE) since `/workspace/shared/` is write-only to Main.

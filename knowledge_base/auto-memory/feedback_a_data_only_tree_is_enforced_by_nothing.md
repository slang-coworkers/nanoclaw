---
name: feedback_a_data_only_tree_is_enforced_by_nothing
description: "TRIGGER: about to conclude 'data-only' about a tree by auditing tonight's diff. Re-derivation is not enforcement — the kb_sync tree already carries 6 mode-100755 executables. Ship a staged-mode gate (EXEC + GITLINK arms, both control-proven) into the JOB, not another audit."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9ae939cf-12ae-4cd1-b4d6-7c86dee84fe5
---

PR #1156 (2026-08-10, `slang-coworkers/nanoclaw`, nightly `knowledge_base` sync) audited clean on
every measurable axis: census 160/160/160, both content assertions exact to the line, 0 paths outside
`knowledge_base/`, 0 gitlinks across six merged trees, 0 non-bot real emails, 16/16 PII controls
armed, 0 CI references.

⛔**And "data-only" was still a property enforced by nothing.** The snapshot carries an executable
shell script (`auto-memory/bin/check-integrity.sh`, mode `100755`); the tree holds **6** such
executables under `knowledge_base/`. Each night's verdict was re-derived by hand — no path filter, no
mode assertion, no allowlist anywhere in the merge path. Measured inert *today* (print-only: 0 write
calls, 0 CI references ⇒ nothing can run it), which is exactly why six of them accumulated without
anyone objecting.

⇒ ⭐⭐⭐**A conclusion you re-derive nightly is not a guarantee; it is a habit with a good record.**
The audit answers "is tonight's tree clean?" — it cannot answer "will tomorrow's be?", and a passing
audit reads like the latter. **Six executables is what "clean every night" looks like when the
predicate is applied to the diff instead of to the invariant.**

⭐⭐**The right question shifts once scripts appear: not "is this code?" but "can anything RUN it?"**
Provenance (extension/shebang census) is the weaker check; exposure (does any workflow reference the
tree) is the load-bearing one. Both were 0 here — but only the second one bounds blast radius.

**The fix — a step in the job, not a note in the store.** Added as `STEP 4b` to the nightly task
prompt (`task-1781522302095-mjy6s1`, agent group `ag-1776713211742-1w6l4e` = Orchestrator/main), so
it runs at staging time on every fire:

```bash
git diff --cached --name-only -z | xargs -0r -I{} sh -c 'test -e "{}" || exit 0; \
  case $(git ls-files -s "{}" | cut -d" " -f1) in \
    100755) echo "EXEC: {}";; 160000) echo "GITLINK: {}";; esac'
# EXEC    -> git update-index --chmod=-x <path>   (publish as data, not as a program)
# GITLINK -> STOP and report; never merge a gitlink
```

✅**Both arms proven before install, in a throwaway repo — not reasoned about:** an executable
`knowledge_base/prog.sh` produced `EXEC: knowledge_base/prog.sh` and went silent after
`--chmod=-x`; a **real nested repo** (`git init` inside the staged tree) produced
`GITLINK: knowledge_base/nested`, confirmed against raw `git ls-files -s` showing mode `160000`.
The gate ships with its own positive control (plant a `chmod +x` probe, assert one EXEC line, remove
it) because **a zero from this check means nothing until the control has printed on the same run** —
this store's recurring defect is control-backed false zeros.

**How to apply:**
- When an audit of a recurring job comes back clean, ask what *enforces* the property between runs.
  If the answer is "the audit", the property is undefended and the finding belongs in the job.
- Prefer a **staged-mode** assertion over a path/extension allowlist: mode catches the extensionless
  executable and the gitlink, which an extension key structurally cannot
  ([[feedback_a_control_built_from_the_matchers_own_assumption_is_blind]]).
- Verify a gate's arms in a scratch repo where you can *construct* the bad state. A gitlink arm you
  only ever observed as absent is untested — construct it.

Related: [[project_nanoclaw_kb_sync_pr_autoref_noop]] (the PR class, why it is a no-op),
[[feedback_a_directory_mtime_is_not_a_creation_time]] (the body-rationale defect on the same PR),
[[feedback_a_mirrored_source_that_became_a_repo_can_smuggle_a_gitlink]] (the gitlink regimes),
[[feedback_a_prose_only_rule_loses_to_a_mechanical_counter]].

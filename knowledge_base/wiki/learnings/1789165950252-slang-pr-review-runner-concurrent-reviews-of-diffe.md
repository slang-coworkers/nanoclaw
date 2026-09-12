---
title: "slang-pr-review-runner: concurrent reviews of different PRs race on the shared checkout's tmp/ — trust the run-local pr-diff.reference, re-run when quiescent"
type: learning
topic: slang-compiler
source: learnings/1789165950252-slang-pr-review-runner-concurrent-reviews-of-diffe.md
---

# slang-pr-review-runner: concurrent reviews of different PRs race on the shared checkout's tmp/ — trust the run-local pr-diff.reference, re-run when quiescent

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789160581074-cmio19
written_at: 2026-09-11T22:32:30.252Z
---

# slang-pr-review-runner: concurrent reviews of different PRs race on the shared checkout's tmp/ — trust the run-local pr-diff.reference, re-run when quiescent

**Symptom:** A `/slang-pr-review` run trips the harness INTEGRITY-FAIL (`compose-and-run.sh` writes `<run_dir>/INTEGRITY-FAIL.txt`, GUARD_RC=1) with a "reviewed diff != PR <N> files" message listing files from a *different* PR (e.g. reviewing #13020 but the guard reports CMakeLists.txt/README.md from #13021).

**Root cause:** `slang-pr-review-runner`'s `compose-and-run.sh` (Reviewer A) uses the **shared** checkout `/workspace/agent/slang` as `REPO_ROOT` and writes `REPO_ROOT/tmp/context.json` + `REPO_ROOT/tmp/pr-diff.patch` there. The post-run diff-integrity net re-reads `tmp/pr-diff.patch`. If a **second review of a different PR runs concurrently** against the same checkout (e.g. a peer coworker, or a supervisor dispatch), it clobbers those shared tmp files. The guard then compares the *other* PR's files against your PR's real file list → false-positive INTEGRITY-FAIL. (Reviewer C / `run-clarity.sh` is immune — it creates its own isolated worktree `wt-clarity-*`. Only Reviewer A shares the checkout.)

**How to tell a false alarm from a real wrong-diff review — don't trust the model's self-assurance, verify:**
1. `sha256sum <run_dir>/pr-diff.reference` — this file is written to the **unique per-run** RUN_DIR at dispatch, so it is NOT clobbered. Compare to the live `gh pr diff <N> -R <repo> | sha256sum`. Match ⇒ the run fetched the correct diff.
2. Cross-check against Reviewer C's run-dir name (it embeds the diff-hash marker) — C is isolated, so if A's `pr-diff.reference` hash == C's marker, both reviewed the same correct diff.
3. Scan `<run_dir>/stream.jsonl` for the other PR's content markers vs yours (ratio was ~1585:65 in the confirmed case — the minority were the model *diagnosing* the clobber + benign directory listings + a legit `CMakeLists.txt` grep for the new unit test's registration, not reviewing the wrong PR).

**Correct response:** Because subagent input files aren't preserved (`summarize.py` reports "Preserved subagent outputs: 0"), you can't fully prove a *subagent* didn't read the clobbered tmp. So even with strong evidence the run was fine, **re-run Reviewer A once when the checkout is quiescent** rather than reason around a tripped integrity guard: (a) confirm no active review — `ps -eo pid,args | grep -E 'compose-and-run|repro.sh|run-clarity'`; (b) `rm -f /workspace/agent/slang/tmp/{context.json,pr-diff.patch}`; (c) re-dispatch `--pr <N>`. A clean re-run passes the guard (no INTEGRITY-FAIL, marker=correct PR). In the confirmed case (#13020 r2) the clean re-run reproduced the same substance (0 bugs) — so the verdict was unchanged, but the guard was cleared honestly. Set `reviewers_complete:true` only after a guard-clean run.

**Latent improvement for the skill:** give Reviewer A the same per-run isolated worktree that `run-clarity.sh` uses, so concurrent reviews of different PRs can't share `tmp/`. Until then, avoid dispatching two Reviewer-A runs against the shared checkout simultaneously.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789165950252-slang-pr-review-runner-concurrent-reviews-of-diffe.md`_

## This install

These lines override the general base context where the two differ:

- **Forge: GitLab only.** The repositories, issues and merge requests live on the install's Khronos GitLab. There is no GitHub here: wherever the base context mentions GitHub, PRs or `gh`, read GitLab, MRs and the read-only GitLab API through the gateway. Never use `gh`.
- **Progress and the resumable artifact.** A job's resumable record is its local `outcome.json` and `result/reply.md` in the job root, plus your reply in the requester's thread. Status goes through the `khr-job-prep` status helper. You never post to GitLab yourself.
- **No coworker chain.** A khr job is a single coworker run, with no fixer, reviewer or orchestrator hand-offs. Report to the requester's thread only.
- **Second opinion.** `/codex-critique` is available. It is an optional independent review of your diff before the final check. It never replaces the completeness invariant or recorded validation.

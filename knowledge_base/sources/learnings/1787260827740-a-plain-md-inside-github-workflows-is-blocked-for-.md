---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787248988015-6bmb0o
written_at: 2026-08-20T21:20:27.740Z
---

# A plain .md inside .github/workflows/ IS blocked for the bot (workflows-permission guard is path-based, not parse-based)

**Confirmed live 2026-08-20 (slang#12662, real push to origin):** committing a plain Markdown file
`.github/workflows/README.md` and pushing as `nv-slang-bot[bot]` is **REJECTED**:

```
! [remote rejected] fix/issue-12662 -> fix/issue-12662
  (refusing to allow a GitHub App to create or update workflow
   `.github/workflows/README.md` without `workflows` permission)
```

This resolves a question the KB had left explicitly **untested**: earlier notes phrased the block as
either path-based ("any file under `.github/workflows/`") or parse-based ("only files GitHub parses
as workflows, i.e. `.yml`/`.yaml`"). The `.github/actions/**/action.yml` evidence had suggested a
finer, parse-based guard. **The README result shows the guard is path-based for `.github/workflows/`
specifically: even a `.md` in that directory is rejected.** (Composite actions under
`.github/actions/**` remain bot-pushable — that part is unchanged.)

**⚠ `git push --dry-run` is a FALSE GREEN for this guard.** The dry-run returned `rc=0` and
`* [new branch] ... Would set upstream` — i.e. it reported success — and then the *real* push was
rejected by the server-side guard. Do NOT trust a clean `--dry-run` as proof a workflow-dir push will
land; only the real push exercises the permission check. (This matches the older slang-repo note that
`--dry-run` does not catch it, and contradicts the one slangpy data point where it did — treat
dry-run as unreliable for this specific guard.)

**Consequence for triage/dispatch:** a request to add ANY file under `.github/workflows/` — including
a README/doc — is **not bot-landable**. Route it as a patch handoff to a human committer (maintainer
via issue comment, or orchestrator holding a `workflows`-scoped PAT) from the start; there is no PR
the bot can open. When the whole change lives under the guarded dir, there is no "push the
non-workflow part" split to do — the entire commit is blocked (a push is atomic).

---
title: "Workflow-file changes are policy-rejected for coworker bots — catch at triage-scoping"
type: learning
topic: agent-ops
source: learnings/1783546996023-workflow-file-changes-are-policy-rejected-for-cowo.md
---

# Workflow-file changes are policy-rejected for coworker bots — catch at triage-scoping

**Rule:** A fix whose change surface is entirely (or requires touching) `.github/workflows/**` is **not landable by a coworker bot** — flag it at **triage-scoping time** and do not spend a fix cycle producing a PR expecting it to merge.

**Two independent barriers stack here:**
1. **App-token permission:** the nv-slang-bot GitHub App lacks the `workflows` permission, so it cannot push workflow-file changes to a `shader-slang/*` branch. (Bots sometimes route around this via a cross-fork PR from `slang-coworkers` — but see #2.)
2. **Human/org policy:** even via a clean cross-fork PR, a maintainer will close it unmerged for security reasons. Coworker bots may not modify CI/workflow files; the maintainer pulls the change in-house ("I will run an agent locally").

**Evidence (2026-07-08, shader-slang/slang#11989 → PR #12001):** the fix was CI-example-harness work whose entire surface was `.github/workflows/ci-examples.sh` + `ci-slang-test.yml`. The fixer produced a clean, codex-approved cross-fork draft (#12001). jkwak-work closed it unmerged (comment 4919366303, verified): *"Closing because the PR is supposed to make changes to the workflow and coworker is not allowed to modify them for security reasons. I will run an agent locally."* Code quality was never the issue — it was never landable by a bot.

**How to apply:**
- **Triage:** when the recommended fix touches `.github/workflows/**` (or `.github/actions/**`), mark it maintainer-only in the verdict. Still triage/verify/recommend and file any spun-off *code* issues (those ARE landable) — but don't dispatch a fixer to open a workflow-file PR expecting a merge.
- **If a bot already opened such a PR:** annotate it maintainer-only and hand the diff to the maintainer as a comment, rather than iterating on it.
- **Corollary:** the *useful* bot output for a workflow-scoped issue is usually the verified analysis + any non-workflow code issues it spawns (e.g. #11989 → compiler false-positive trackers #12006/#12007), not the workflow PR itself.

Related: the bot `workflows`-permission limitation (post the workflow diff as a comment; `git push --dry-run` reports success misleadingly).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783546996023-workflow-file-changes-are-policy-rejected-for-cowo.md`_

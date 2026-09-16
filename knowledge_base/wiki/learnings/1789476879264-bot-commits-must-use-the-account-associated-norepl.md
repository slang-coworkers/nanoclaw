---
title: "Bot commits must use the account-associated noreply email or CLA-assistant blocks merge"
type: learning
topic: ci-tooling
source: learnings/1789476879264-bot-commits-must-use-the-account-associated-norepl.md
---

# Bot commits must use the account-associated noreply email or CLA-assistant blocks merge

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788770254051-khwfz8
written_at: 2026-09-15T12:54:39.264Z
---

# Bot commits must use the account-associated noreply email or CLA-assistant blocks merge

**Symptom:** On a bot-authored PR (nv-slang-bot), CLA-assistant (`license/cla` check) reports the bot as *unsigned* ("N of M committers signed", bot ❌) and sets `mergeStateStatus=BLOCKED`, even though the bot's CLA is signed and earlier commits on the same PR passed CLA.

**Root cause:** Git commit author email mismatch. GitHub associates a commit with an account only when the author email is either the account's real email or its account-scoped noreply form `<numericId>+<login>@users.noreply.github.com`. A *bare* `<login>@users.noreply.github.com` (no numeric id) does NOT map to the account, so CLA-assistant treats it as an unknown/unsigned committer. For nv-slang-bot the canonical (CLA-signed) identity is `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`; commits authored as `nv-slang-bot[bot] <nv-slang-bot@users.noreply.github.com>` get flagged unsigned.

**How it happens:** a container restart can reset the worktree's `git config user.email` to the bare/wrong value, so commits made after the restart silently regress while pre-restart commits are fine. Diagnose with: `git log --format='%h %ae' <branch> --not origin/master` and compare against `git log --format='%ae' master | grep <bot>`.

**Fix:** (1) `git config user.email "274397474+nv-slang-bot[bot]@users.noreply.github.com"` (and user.name "nv-slang-bot[bot]"). (2) Re-author the offending commits — if it's just the tip, `git commit --amend --reset-author --no-edit`; for several, an interactive/`--exec` rebase re-authoring each. Tree is byte-identical; only author/committer changes. (3) `git push --force-with-lease`. **Force-push is a gated destructive op — get explicit session authorization first.** A reverted/superseded wrong-email commit still counts (CLA scans all PR commits), so you MUST rewrite history, not add a new commit. Alternative: the org whitelists/rechecks the bot in CLA-assistant.

**Durable fix:** pin the container's default git identity for the bot to the account-scoped noreply email so future sessions don't regress. Verify `git config user.email` at the start of any commit-producing session on a bot identity.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789476879264-bot-commits-must-use-the-account-associated-norepl.md`_

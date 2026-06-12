# CORRECTION: bot CAN push/PR to slang-rhi — gh api permissions push:false is a false-positive for App tokens

**Supersedes the earlier learning "slang-rhi cross-repo fix is a forced patch-handoff" — that conclusion was WRONG.** The `nv-slang-bot[bot]` identity CAN push branches, open PRs, and comment on `shader-slang/slang-rhi`. Proven twice: merged same-repo bot PR #765 (fix/issue-762, 2026-06-03) and bot draft PR #773 (fix/issue-772, 2026-06-10, real `git push` returned `* [new branch]`, no 403).

**The misleading signals (do NOT treat any of these as "no write access"):**
- `gh api repos/shader-slang/slang-rhi --jq .permissions` → `{push:false, pull:false, triage:false}` is the NORMAL shape of a GitHub App *installation* token — it is NOT a capability statement. It looks identical on `shader-slang/slang` (which the bot pushes to daily). Do not gate a handoff on it.
- `gh api user` → 403 is EXPECTED: the auth proxy injects the real token only on org-scoped `shader-slang/*` paths, not `/user`.
- The clone having no `git user.name/email` and the remote showing a `x-access-token:placeholder@…` URL are NOT blockers: set a local identity (author `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`, one `Co-authored-by: Harsh Aggarwal <haaggarwal@nvidia.com>` trailer), `git remote set-url origin https://github.com/shader-slang/slang-rhi.git`, and the proxy supplies auth on push.

**The ONLY authoritative test of push capability is an actual `git push` / `gh pr create`.** A 403 from those is a real blocker; the permission probe is not evidence. (Note: `git push --dry-run` is ALSO a false-positive — it can succeed where a real push would fail — so neither the dry-run nor the permission API substitutes for the real attempt. When in doubt, just attempt the push; a reject is harmless.)

**Net for slang-rhi fixes:** follow the normal `/slang-fix-issue` Step 7 — commit, push `fix/issue-<n>` to origin, open the draft PR, `report_pr_created`. Do NOT pre-emptively declare a patch-handoff. (Patch fallback still applies only on a genuine push *rejection*.)

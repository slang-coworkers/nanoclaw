---
title: "git push --dry-run is a dud positive: it reports success with push:false"
type: learning
topic: misc
source: learnings/1785984172890-git-push-dry-run-is-a-dud-positive-it-reports-succ.md
---

# git push --dry-run is a dud positive: it reports success with push:false

## `git push --dry-run` never tests write permission

Measured 2026-08-06 (slang-fixer, PR shader-slang/slang#12089).

I needed to know whether our bot could push to a branch. I ran:

```bash
git push --dry-run origin refs/remotes/pr/12089:refs/heads/probe/auth-check
# → To https://github.com/shader-slang/slang.git
#   * [new branch]   pr/12089 -> probe/auth-check
# → exit 0
```

That looks like "yes, I can push." **It is not.** At that exact moment the token had:

```bash
gh api repos/shader-slang/slang --jq '.permissions'
# → {"admin":false,"maintain":false,"push":false,"triage":false,"pull":false}
gh api repos/shader-slang/slang/collaborators/nv-slang-bot/permission --jq '.permission'
# → "read"
```

**Why it lies:** `--dry-run` negotiates refs but never sends the pack, so the server never evaluates
write permission. On a *public* repo the connection and ref negotiation succeed for anyone. So the
output is identical whether or not you have write access — the classic instrument that prints the
same thing regardless of the answer. (Verified no branch was actually created.)

Worse variant: a dry-run where source and destination shas match prints `Everything up-to-date` and
exits 0. That tests nothing whatsoever.

**Use instead** — ask about permission directly:
```bash
gh api repos/<owner>/<repo> --jq '.permissions'                        # push: true/false
gh api repos/<owner>/<repo>/collaborators/<login>/permission --jq '.permission'
```

## Bonus: two auth probes that cry wolf for GitHub App tokens

If your `GH_TOKEN` is a GitHub App installation token (ours is, via the OneCLI proxy):

- `gh auth status` → *"The token in GH_TOKEN is invalid"* — **false alarm**, REST calls work fine.
- `gh api user` → `403 Resource not accessible by integration` — **expected**; App tokens have no
  *user* context. Not an auth failure.
- The probe that actually works: `gh api graphql -f query='query{viewer{login}}'` → `nv-slang-bot[bot]`.

Don't conclude "my token is broken" from the first two, and don't conclude "I can push" from a
dry-run. Also: **a branch living in the upstream repo rather than a fork does not imply you can push
to it** — check the permission bits, not the branch's location.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785984172890-git-push-dry-run-is-a-dud-positive-it-reports-succ.md`_

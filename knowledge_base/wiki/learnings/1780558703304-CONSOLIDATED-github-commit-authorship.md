---
title: "CONSOLIDATED: GitHub commit authorship for the bot (correct author email; never fabricate trailer ids)"
type: learning
topic: misc
source: learnings/1780558703304-CONSOLIDATED-github-commit-authorship.md
---

# CONSOLIDATED: GitHub commit authorship for the bot (correct author email; never fabricate trailer ids)

*Consolidation (2026-06-04) of 1779901254967 (App-ID vs Bot-User-ID ghost commits) and 1780309239999 (never fabricate co-author trailer ids). Supersedes both; they remain for history.*

## 1. Author identity — use the Bot **User ID**, not the App ID

Commits authored by the bot render with a real avatar/profile link only if the author email uses the bot's **user id**. App ID ≠ Bot User ID — two different numbers:

| Number | Example (`nv-slang-bot`) | Where it's used | Source |
|---|---|---|---|
| **App ID** | `3311378` | installation tokens, webhook/App admin endpoints | `api.github.com/apps/<slug>` → `.id` |
| **Bot User ID** | `274397474` | **the commit author email** | `api.github.com/users/<slug>%5Bbot%5D` → `.id` |

Set on the clone:
```bash
git config user.name  "nv-slang-bot[bot]"
git config user.email "274397474+nv-slang-bot[bot]@users.noreply.github.com"
```

**Symptom of getting it wrong:** `gh api repos/<o>/<r>/pulls/<n>/commits --jq '.[].author.login'` returns `null`; the PR page shows a hollow "ghost" avatar with no profile link. (Using a stray/wrong prefix instead of the bot user-id makes every commit render as a ghost and forces re-authoring.)

Verify after push:
```bash
gh api repos/<o>/<r>/pulls/<n>/commits \
  --jq '.[] | {sha: .sha[0:9], email: .commit.author.email, login: .author.login}'
# login must be nv-slang-bot[bot], not null
```
Confirm a bot's user-id without org access: `curl -s https://api.github.com/users/<slug>%5Bbot%5D | jq '{id,login,type}'`. If it returns `Not Found`, the App's bot user doesn't exist (wrong slug / not installed) — fixing the email won't help.

## 2. Co-authored-by trailers — credit only the operator; never fabricate the numeric id

**Standing rule:** every bot commit carries **exactly ONE** co-author trailer, crediting the operator (Harsh Aggarwal) at his **verified corporate nvidia.com address**. Add it on every commit, including amends/squashes. Do **not** use a `@users.noreply.github.com` personal-handle form for this trailer.

- **Never credit any other person** in a co-author trailer.
- **Never fabricate a numeric GitHub user-id** (`NNNNN+name@users.noreply.github.com`) — a guessed id can resolve to a **real but wrong person**, silently misattributing the commit. (Concrete miss: slang#11356 attached a fabricated id that belonged to a different GitHub user; the commit had to be re-authored.) If you only have an unverified address for someone, **omit that trailer** — but the operator trailer is always present.

## Slang house rule

Don't mention Claude/Codex/the agent in commit messages (per slang `CLAUDE.md`).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1780558703304-CONSOLIDATED-github-commit-authorship.md`_

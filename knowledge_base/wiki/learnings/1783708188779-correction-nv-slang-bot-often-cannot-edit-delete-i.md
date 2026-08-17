---
title: "CORRECTION: nv-slang-bot often CANNOT edit/delete its own GitHub issue comments (403) — duplicate footprints may be uncleanable; prevent, don't consolidate"
type: learning
topic: slang-compiler
source: learnings/1783708188779-correction-nv-slang-bot-often-cannot-edit-delete-i.md
---

# CORRECTION: nv-slang-bot often CANNOT edit/delete its own GitHub issue comments (403) — duplicate footprints may be uncleanable; prevent, don't consolidate

**Corrects the same-day learning** "Held-no-PR is triage's GitHub footprint; fixer posting its own hold comment races + duplicates (slang#12051)", which claimed the authoring coworker can PATCH its own comment to collapse a duplicate. **That is not reliably true.**

**Empirical result on shader-slang/slang#12051 (two nv-slang-bot comments, same day):**
- Comment 4937951648 — author login `nv-slang-bot` (triager's container/token). Its creator **could** PATCH it (edited in-place several times, HTTP 200).
- Comment 4938298124 — author login `nv-slang-bot[bot]` (fixer's container). **Neither** the triager (cross-token, expected 403) **nor the fixer editing its OWN comment** could PATCH or DELETE it — both got `403 "Must have admin rights to Repository."`

**So:** edit-back / delete capability on issue comments is **identity/token-dependent and NOT guaranteed** for this bot. Some coworker identities can only CREATE comments; PATCH and DELETE 403 even on their own comment (the discriminator appears to track the author-login form — `nv-slang-bot` vs `nv-slang-bot[bot]` — i.e. PAT-style vs GitHub-App-installation token, but treat the exact mechanism as unconfirmed). DELETE also needs repo admin the bot lacks. Consequence: once a duplicate/wrong comment is posted by such an identity, it **cannot be cleaned up by anyone in the coworker fleet** — it just stands.

**Durable rule — prevention, not cleanup:**
1. There is no reliable "fix it later" for GitHub comments. Verify BEFORE posting: is there already an nv-slang-bot comment for this state? If yes and it's editable-by-you, edit it; if it's another tier's, ping that tier — do NOT post a second.
2. On a **no-PR hold**, only the triager touches the issue (spine: fixer's GitHub footprint is when a PR opens). Fixer pings triager to update the existing comment; fixer does not self-post — because if it does and it's a duplicate, it may be permanently unremovable.
3. When you DO need a comment cleaned and you didn't create it (or your identity can't edit-back), the honest state is "cannot consolidate" — record it, accept two non-contradictory footprints, and make the earliest/richest one canonical. Don't burn turns retrying PATCH/DELETE that will 403.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783708188779-correction-nv-slang-bot-often-cannot-edit-delete-i.md`_

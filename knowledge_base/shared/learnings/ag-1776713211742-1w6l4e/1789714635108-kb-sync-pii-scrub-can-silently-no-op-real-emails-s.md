---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-18T06:57:15.108Z
---

# KB sync PII scrub can silently no-op → real emails/secrets leak to the public mirror

**Context:** The daily `/learnings-wiki` PART B syncs `/workspace/shared/wiki|sources|learnings` into the PUBLIC `slang-coworkers/nanoclaw` mirror (`knowledge_base/`), running `scripts/scrub_kb_pii.py --apply` to redact PII before commit.

**Failure observed (2026-09-18):** PR #1656 committed with message "…(PII scrub: emails redacted)" but actually merged **37 real contributor emails** (e.g. `[REDACTED-EMAIL]`, `[REDACTED-EMAIL]`, `[REDACTED-EMAIL]`) **+ 1 gateway-credential token** UNREDACTED into the public repo. The `--apply` had been a **no-op** in that run.

**Root cause / trap:** `scrub_kb_pii.py` is journaled+idempotent. If you run it after `git checkout -B <branch>` where the branch working tree is *already the previously-committed (raw) content*, or with a stale journal, `--apply` reports `rewrote 0 files, 0 redactions` even though raw PII is present — a silent pass. I hit the identical no-op on my first attempt this run; only re-doing it on a FRESH branch checked out from `origin/nv-coworkers` + a clean `rm -rf && cp -r` from the raw source produced the correct `rewrote 29 files, 38 redactions`.

**Rule:** Never trust the scrub's "0 redactions" as proof of a clean mirror. VERIFY independently before/after merge: `git grep -c "[REDACTED-EMAIL]" origin/nv-coworkers -- knowledge_base/` (or any known contributor email) must be **0**, and `git grep REDACTED-EMAIL` must be **>0**, on the merged tip. The `--audit` "0 email redact matches" only means *your current working copy* has none — it does not tell you whether the LIVE mirror already leaked. The mirror is PUBLIC (`private=false`), so a raw email/token there is a real exposure. When the scrub reports 0 on a copy freshly taken from raw source that you know contains emails, treat it as a BUG (stale journal / wrong working tree), re-run on a clean fresh branch, and confirm the diff shows the redactions before committing.

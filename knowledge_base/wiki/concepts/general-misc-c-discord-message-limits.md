---
title: "Discord message limits (the real cap is 2000 chars, and the first error lies) and reading the bot's posts for the compliance check"
type: concept
group: general
tags: [discord, mcp, message-limit, formatting, compliance-check, discord-read-messages, is_bot, github-search, url-encoding]
source_count: 2
---

## TL;DR

`mcp__slang-mcp__discord_send_message` rejects content over **2000 characters** (standard non-Nitro Discord) with `400 error code 50035: Invalid Form Body`. Budget for 2000 from the start; do not trust the ceiling the first error reports.

- The real ceiling is **2000**, not 4000. A first over-length attempt can report `Must be 4000 or fewer` — misleading; re-trimming to ~3900 just burns another round trip. Split to **under ~1900 chars per message** on the first attempt.
- Count with `python3 -c "print(len(open('f.md').read()))"`, **not `wc -c`** — `wc -c` counts bytes, and em-dashes / `⚠️` / arrows are multi-byte, so it overstates length. Discord counts UTF-16 code units, so Python `len()` is the closer proxy (emoji outside the BMP count as 2).
- The mandatory summon footer (~135 chars) is non-negotiable — subtract it first, leaving ~1865 for content.
- When trimming, cut prose clauses and keep **file:line citations + issue links** — users can follow a link, not recover a dropped fact.
- For long answers, prefer splitting into a follow-up message in the thread over deleting substance.
- **The compliance check reads the bot's Discord posts poorly**: its converter misses the `filtered` wrapper and `is_bot`, the bot posts as `SlangMaintainerBot`, and its GitHub searches 400 on a raw `>` in `created:>=`.

## Details

The `4000` in a first-attempt error is not the budget — one investigator burned ~6 rounds of iterative trimming (2299 → 2233 → … → 2000) assuming the Nitro/bot ceiling. Two attempts can even return *two different limits under the same error code 50035* (4000 then 2000). Treat 2000 as the hard cap and split accordingly. See [discord_send_message caps content at 2000 chars, not 4000](../learnings/1786006619395-discord-send-message-caps-content-at-2000-chars-no.md) and [Discord message limit is 2000 chars, not 4000 — the API error message lies on the first try](../learnings/1786006634390-discord-message-limit-is-2000-chars-not-4000-the-a.md).

**Multi-part answers with feedback buttons:** a mid-sequence rejection can leave a partially-delivered answer in the thread, so order the sends with `add_feedback_buttons: false` on parts 1..N-1 and `true` only on the **final** part — the Resolved/Helpful buttons then attach to a complete answer, and the recorded `reply_message_id` lands the reader at the end of the sequence. "Send success" for a split reply means *every* part returned a real `message_id`; verify each response before appending a handled row (a failure on part 3 of 3 still means the user got an incomplete answer).

## Reading the bot's own posts for the compliance check

The compliance-check converter `scripts/discord_export_from_json.py` cannot read `mcp__slang-mcp__discord_read_messages` output as of Oct 2026. The tool returns `{"filtered": {"channel_id": ..., "messages": [...], "total_count": N}}`, sometimes wrapped in an MCP `[{"type":"text","text": ...}]` block, while the converter unwraps only a top-level `messages`/`result`/`data`/`items` key, so `--inspect` exits 2 ("no message array found", then a JSONL fallback error). Messages carry no per-message `channel_id` (`--channel-id` covers it), the bot flag is a top-level `is_bot` with `author` a plain string (the converter reads `author.bot`/`msg.bot`), and in the three watched channels the fleet's bot posts as `SlangMaintainerBot`, not `nv-slang-bot`, so `--author nv-slang-bot` matches nothing. R10 (discord-thread) stays UNKNOWN until the converter learns the `filtered` wrapper and `is_bot` and the `--author` value is corrected; hand-written records are forbidden by the skill. A tool response over ~100 KB is saved by the harness under `~/.claude/projects/<proj>/<session>/tool-results/`; copy that file byte for byte instead of retyping it [discord_export_from_json.py cannot read discord_read_messages output](../learnings/1792145488222-compliance-check-discord-export-from-json-py-canno.md).

The same run's GitHub side failed for a URL-encoding reason. `compliance_check.py`'s `gh_command()` builds the URL with `urllib.parse.urlencode(params, safe=":/+>=<")`, so `created:>=2026-09-16` goes out with a raw `>`, and GitHub `search/issues` answers HTTP 400; `%3E`, `%3E%3D` or the range form `created:2026-09-16..*` answer 200. All nine searches failed, R1, R2/R3, R5, R7 and R9 went UNKNOWN with 0 items, and R8 covered only comments. The fix is a skill-script change, dropping `>` and `<` from `safe=`; check with `gh api --method GET "search/issues?q=repo:shader-slang/slang+is:pr+author:app/nv-slang-bot+created:%3E%3D2026-09-16&per_page=1"` [compliance_check.py GitHub searches return HTTP 400](../learnings/1792145809721-compliance-check-py-github-searches-return-http-40.md).

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794922516146-r1egm2
written_at: 2026-11-17T14:13:41.954Z
---

# Verify fixer self-check artifact claims before repeating them in a review verdict

When re-stating a fixer's `Fixer self-check:` claims in a [Review Verdict], treat artifact claims ("noted in the PR explanation comment <url>") as unverified and check them against GitHub before repeating (gh api the cited comment / grep the PR body). On slang#14547 r1 (2026-11-17) the self-check said the `[mutating]`-receiver exclusion was "noted in the PR explanation comment" — no comment or body on the PR mentioned it; the codex OUTPUT_REVIEW caught the attribution and live verification confirmed the note doesn't exist. The fixer-vs-evidence self-check mismatch is itself a review finding per the "compare with the fixer's self-check" rule.

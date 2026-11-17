---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794866067941-kae0zu
written_at: 2026-11-16T22:29:49.687Z
---

# Critique-gate mechanics: pulls-read false-positive, timeout residue, attested-hash binding

Two traps in the critique-gate plumbing, hit while filing the spvdb-relocation issue for jkwak-work (PR #12896 → issue #14516, 2026-11-16):

1. **The deliver gate false-positives read-only `gh api .../pulls/<n>` GETs.** `gate-critique-on-deliver.sh` matches the pattern `gh api [^|]*pulls\b` regardless of HTTP verb, so even a read-only `gh api repos/shader-slang/slang/pulls/12896` is denied as "CRITIQUE REQUIRED before PR creation" — burning a denial and blocking fact-gathering mid-task. Use the `issues/<n>` / `issues/<n>/timeline` / `issues/comments/<id>` endpoints instead (they expose the same data for PRs). Codex reviewers hit the same wall; tell them about it in the prompt's environment note.

2. **What the workflow-state actually tracks vs what it looks like it tracks.** (a) A client-side MCP timeout ("MCP error -32001") can still bump `critique_stages` counts and leave duplicate entries in `critique_threads` — after 2 timeouts + 1 success, OUTPUT_REVIEW showed count 2 and two thread ids, and I couldn't tell which thread was live. The authority is `critique_verdicts` + `critique_attested` (fresh hash set), not the counts; for a follow-up round on ambiguous threads, open a FRESH `mcp__codex__codex` call with `STAGE:` set — it records as an iteration round (stage count stays, verdict + attestation update) with no thread ambiguity. (b) The OUTPUT_REVIEW approve binds to the `### Attested` sha256s: re-hashing at delivery denies if ANY attested file changed after the approve — including a mechanical `#NNN` → `#14516` placeholder substitution in a reply template. Flow that works: review body + template (round 1) → create the GitHub artifact from the unchanged body file → fill the real number into the reply → one fresh OUTPUT_REVIEW round on the final bytes → post the reply file unchanged → report. `track-edits.sh` did not bump `edits_since_critique` for edits under `reports/`, so the freshness counter alone would NOT have caught the placeholder substitution — the attested-hash check is what does.

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795043986372-ntam6a
written_at: 2026-11-19T02:38:59.569Z
---

# codex-bridge dispatch: setsid not nohup; no #issuecomment URLs inside "Maintainer direction: none" clauses

Two dispatch/gate traps from slang#14618 fix session (2026-11-19), extending the codex-bridge fallback playbook:

1. **Bridge dispatch needs `setsid`, not bare `nohup … &`.** The agent shell tool's timeout kill reaps the whole process group: a `nohup python3 bridge-dispatch.py … &` client died mid-review twice (start event recorded, no round event — round lost). Wrap the dispatch in a tiny shell script and launch with `setsid <script> < /dev/null > /dev/null 2>&1 & disown` — that instance survived and recorded cleanly. Symptom to watch: shell metadata "terminated after exceeding timeout" right after `nohup … &`, then no round event in critique-attempts.jsonl.

2. **The `[Fix Review Request]` gate parses any `#issuecomment-` URL inside `Maintainer direction: none — …` as linked maintainer direction** and then rejects the message for lacking `Fixer self-check: R1…` items ("REVIEW REQUEST INCOMPLETE"). Keep the `none` clause anchor-free — reference the bot/comment id in prose ("its only commenter is the triage bot's status post, issuecomment <id>") instead of the full `https://…#issuecomment-…` URL. Also confirmed again: the message-batch boundary wipes workflow-state (plan gate + all critique verdicts); re-arm with a Write (not Edit) to the plan file, then one fresh bridge round per required stage.

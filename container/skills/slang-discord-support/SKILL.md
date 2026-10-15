---
name: slang-discord-support
license: MIT
description: "Heartbeat gate for the Discord support bot: pending summons, new messages in the watched channels, CI health and workflow failures, with the OneCLI gateway injecting the Discord and GitHub credentials."
provides: []
allowed-tools: Bash, Read
---

# slang-discord-support

`scripts/heartbeat-gate.sh` is the pre-task gate of the bot's heartbeat task. Within a 20-second network budget it checks pending summon requests (`memory/feedback/summon_requests.jsonl`), new messages in the watched source channels, the CI health snapshot and recent workflow failures, and prints the gate JSON as its last line:

```
{"wakeAgent": <true when any check needs you>, "data": {"ci_health": …, "workflow_failures": …, "new_discord_messages": …, "pending_summons": …}}
```

Credentials come from the OneCLI gateway: keep the proxy environment and send no `Authorization` header. The task row is `exec bash /app/skills/slang-discord-support/scripts/heartbeat-gate.sh`. Summons that arrive as dashboard inbounds wake you directly through `/slang-discord-answer`; the heartbeat is the fallback for summons the daemon did not deliver and for the channel and CI checks.

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-27T11:35:39.611Z
---

# ncl mutating call can time out client-side while the write still completes server-side

During a `ncl` outage recovery (2026-09-27), `ncl tasks update --script <60KB>` reported `ncl: command timed out after 30s` (exit 2) three times in a row. Lightweight reads (`groups list`, `tasks list`, even `--help`) were flapping too (succeeded ~2/3 tries), consistent with a still-recovering backend rather than a payload-size-specific issue.

Ran `ncl tasks get --id <id> --json` afterward anyway (to check for partial state before retrying further) and found the live `script` field was already byte-identical to the payload from one of the "timed out" `update` calls — confirmed via sha256 hash embedded in the script content and a full byte diff. One of the client-reported timeouts was a false negative: the server-side write completed, but the client gave up waiting for the response before it arrived.

Takeaway: after any `ncl` mutating call reports a timeout, don't assume it failed and don't just blindly retry — `tasks update --script` is idempotent (each call fully overwrites the field) so retrying is safe, but always verify actual state via a follow-up `tasks get` (or equivalent read) before concluding either way. This is especially important right after an outage is reported "recovered" — the recovery can be flaky/asymmetric (parent's container could reach it, mine couldn't, moments apart) rather than a clean on/off transition.

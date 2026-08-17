---
title: "A nanoclaw precheck script lives in the task record, not on any filesystem — check has_script before assigning ownership"
type: learning
topic: misc
source: learnings/1785927890347-a-nanoclaw-precheck-script-lives-in-the-task-recor.md
---

# A nanoclaw precheck script lives in the task record, not on any filesystem — check has_script before assigning ownership

**Rule:** before concluding another tier owns a scheduled script — or that you own it — run `ncl tasks get <series-id>` and look at `has_script`. In nanoclaw, a scheduled task's pre-check script is stored **in the task row in the host DB**, not as a file on any container. `ncl tasks update --id <series> --script "$(cat new.sh)"` is the edit path.

**The failure it produces (2026-08-05, two tiers, ~9 hours):** a coworker declined for hours to edit a precheck it believed the orchestrator owned; the user-facing cost was a Discord question sitting 9h behind that belief. The orchestrator independently ran `find /workspace -name heartbeat-precheck.sh` on *its* container, got zero hits, and concluded the script belonged to the coworker. **Both were right about their own filesystem and both wrong about ownership — there was no file to own.** Containers share absolute paths, so "that path is on the other machine" is unfalsifiable by `ls` from either side, and `find` returning nothing reads as evidence of someone else's ownership when it's actually evidence the thing isn't a file.

**The tell that was available and under-read.** The coworker's local `.sh` copy lacked a JSON field (`discord_auth_ok`) that the live precheck output contained. That is proof the local copy did not produce the observed output — i.e. it is not on the execution path. **When a local artifact provably cannot have produced the output you're looking at, stop reasoning about who owns it and go find the one that did.** A stale hand-copy sitting at the expected path is worse than a missing file: it answers "does it exist?" with a confident yes.

**Mitigations worth copying:** rename the decoy (`*.STALE-DECOY-do-not-edit-see-ncl-tasks`), drop a README at the expected path pointing at the real location, and keep a verbatim pre-edit dump of the live script before changing it. Verify the change by reading it back **from the DB**, not from your `/tmp` staging copy.

Generalizes past nanoclaw: config that lives in a database, an env var, or a control-plane record will present as "a file someone else has." Check the execution path before deference — deference applied to a wrong premise is indistinguishable from neglect.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785927890347-a-nanoclaw-precheck-script-lives-in-the-task-recor.md`_

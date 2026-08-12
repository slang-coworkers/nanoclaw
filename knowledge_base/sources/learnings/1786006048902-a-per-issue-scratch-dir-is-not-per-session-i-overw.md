# A per-issue scratch dir is not per-session: I overwrote a sibling's probe.cpp

## What happened

Triaging shader-slang/slang#12387, I created `/workspace/agent/scratch-12387/` for my probes and
wrote `probe.cpp` into it with `cat > probe.cpp`. That directory **already existed** — created
~35 min earlier by the *sibling session that filed the issue*, which had its own `probe.cpp`,
a compiled `probe` binary, and `.slang` inputs there. My write destroyed its probe source.
(Its binary and shaders survived; only the source was lost.)

## Why the obvious precaution didn't help

I *did* namespace the directory — by **issue number**. On a fleet where several sessions work
the same issue under one bot identity, the issue number is the single most likely name for two
sessions to collide on. Namespacing by the thing we have in common is not namespacing.

## The rule

Namespace scratch by issue **and** session (`scratch-12387-triage/`, or append a session id).
And before writing into a scratch dir you did not create *in this session*, `ls -la` it first:
a directory whose mtime predates your session start is somebody's working state.

`mkdir -p` is not a "does this exist?" check — it succeeds silently either way, which is exactly
why the collision was invisible until I looked at the file listing for an unrelated reason.

## Generalization

This is the same shape as "the hazard is the NAME, not the directory", which I already had filed
from a near-miss where a `rm -rf` on a short generic scratch name almost destroyed another
session's files. Filing the rule did not stop me repeating it one directory over — the guard has
to be a habit at write time (`ls` the target), not a principle in a notes file.

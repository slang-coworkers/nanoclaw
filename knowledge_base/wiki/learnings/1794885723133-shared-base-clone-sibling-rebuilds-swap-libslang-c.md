---
title: "Shared base-clone: sibling rebuilds swap libslang-compiler.so mid-session"
type: learning
topic: slang-compiler
source: learnings/1794885723133-shared-base-clone-sibling-rebuilds-swap-libslang-c.md
---

# Shared base-clone: sibling rebuilds swap libslang-compiler.so mid-session

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885084037-umyw55
written_at: 2026-11-17T03:22:03.133Z
---

# Shared base-clone: sibling rebuilds swap libslang-compiler.so mid-session

During triage/repro work in /workspace/agent/slang (shared base clone), a sibling session's rebuild swapped libslang-compiler.so mid-run: slang-test/slangc then failed with "error while loading shared libraries: ... invalid ELF header", and spawned tools emitted garbled/truncated stderr (my repro .actual ended in a bogus `--'` fragment). Symptom check: `ls -la build/Release/lib/libslang-compiler.so*` mtime vs `date`, and the size can change between listings while the build relinks. Recovery: sleep ~45-60s until mtime/size stabilizes, sanity-run one known-green test (e.g. tests/dispatcher/smoke.slang) before trusting any repro output, and re-run suspect results captured during the swap window. This bit me on the #14292 triage (2026-11-17); it is a sibling-concurrency hazard, distinct from the stale-binary lesson (that one says rebuild; this one says WAIT, because rebuilding yourself can race the sibling's link step).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794885723133-shared-base-clone-sibling-rebuilds-swap-libslang-c.md`_

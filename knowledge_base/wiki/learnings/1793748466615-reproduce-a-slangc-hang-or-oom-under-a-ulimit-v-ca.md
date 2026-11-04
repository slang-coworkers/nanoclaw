---
title: "Reproduce a slangc hang or OOM under a ulimit -v cap; segfault rc=139 is the signal"
type: learning
topic: slang-compiler
source: learnings/1793748466615-reproduce-a-slangc-hang-or-oom-under-a-ulimit-v-ca.md
---

# Reproduce a slangc hang or OOM under a ulimit -v cap; segfault rc=139 is the signal

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793667544858-o8dnsv
written_at: 2026-11-03T23:27:46.615Z
---

# Reproduce a slangc hang or OOM under a ulimit -v cap; segfault rc=139 is the signal

When a repro reportedly hangs slangc with unbounded memory growth (e.g. WGSL legalization at about 250 MB/s, about 150 GB in 10 min, #14278), never run it bare in a shared container. Run it as `( ulimit -v 8000000; timeout 60 slangc ... )`. Under the cap the allocation fails and slangc segfaults (rc=139) in about 30 s. That gives a bounded, repeatable repro signal without risking the host. To prove growth rather than an early crash, background the run and sample `ps -o rss= -p $PID` every 2 s. gdb is not installed in the coworker image, so you cannot take a stack sample this way. To label a side finding pre-existing or a regression, run the local release binary build/slang-2026.13.1-linux-x86_64/bin/slangc (inside the slang checkout) as a quick old baseline: no build needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793748466615-reproduce-a-slangc-hang-or-oom-under-a-ulimit-v-ca.md`_

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790705442980-p0cz3x
written_at: 2026-09-29T20:22:18.019Z
---

# Shell rc capture: `echo "$(cmd) rc=$?"` reports the substitution's rc, not the prior command's

While comparing slangc exit codes across builds (#13322 review, 2026-09-29), `slangc …; echo "$(basename $p) rc=$?"` printed rc=0 for probes that actually segfaulted. Expansions in a word run left to right, so `$(basename …)` runs before `$?` is read and resets it. Capture it first: `slangc …; rc=$?; echo "$(basename $p) rc=$rc"`. This matters most in crash-regression drills. A wrong "rc=0 everywhere" row nearly led me to call a still-crashing variant fixed. Also, when a compiler segfault takes down in-process `slang-test`, it can print nothing for that test. Use `-use-test-server` or plain `slangc` to see the FAILED line.

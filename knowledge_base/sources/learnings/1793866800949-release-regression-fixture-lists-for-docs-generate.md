---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793866152005-bph00z
written_at: 2026-11-05T08:20:00.949Z
---

# Release-regression fixture lists for docs/generated nightlies include expected-failure rows — diff against FAILED lines

When a nightly agentic-tests (docs/generated/tests) break is summarized by grepping `expected exit code ... is N` messages, the list also catches tests on `docs/generated/tests/_meta/expected-failures.txt`. Those print the same message but are tallied as "failed expectedly" and do not break the run. For #14338 (2026-11-05, run 41965949020), 89 messages covered only 80 unexpected FAILED ids. The 9 extra rows (7 files) were tracked bugs: adding `exit-code=` to them would mask the real failure (e.g. slangi VM matrix swizzle OOB). Always intersect the message list with the `FAILED test: '...'` lines before treating it as the fix set. Also: `gh pr view --json files` caps at 100 files, so #14269 looked like 101 files but had 358. Use the REST `pulls/N/files` pages. Finally, many docs/generated `-dump-ir` fixtures that expect success always failed with a real diagnostic (e.g. E31211 for implicit-LOD Sample in compute). #14269 only exposed them, and they are not intended-failure tests.

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793866152005-bph00z
written_at: 2026-11-05T08:20:28.932Z
---

# docs/generated nightly exit-code break after slang-test #14269: blanket exit-code=N masks ~22 real failures

After d6ad99cb3 (#14269), slang-test fails SIMPLE+filecheck tests whose slangc exit code != exit-code=N (default 0). The 2026-11-05 Agentic nightly (nightly-slang-test.yml: `slang-test -test-dir docs/generated/tests -use-test-server -server-count 4 -expected-failure-list docs/generated/tests/_meta/expected-failures.txt`, env SLANG_RUN_SPIRV_VALIDATION=1 SLANG_DISABLE_AVX512=1) reproduces locally in ~100s with an incremental release build: 89 exit-code mismatches (80 unexpected + 9 already on expected-failures.txt), exact match to CI. Caveat for the fix: ~22 of the 80 are IR-dump/codegen tests (CHECK IR text, no diagnostic) that actually fail to compile for unintended reasons — 7 only under SPIR-V validation (negative index literal, SeqCst atomics, sampler type, missing capability, OpTypeRuntimeArray var), 8 with E31211 derivative-group thread count (texture Sample in compute), 3 E38207 global generic param, plus E55201/E50100/E39999/E30015. Adding exit-code=-1 to those hides real test/compiler problems. Tip: slang-test writes `<fixture>[.N].actual` next to each failing fixture (gitignored) — the full slangc output to scan for E99999. Each failure also shows "retry never produced a verdict" with -use-test-server; that is harmless reporting noise.

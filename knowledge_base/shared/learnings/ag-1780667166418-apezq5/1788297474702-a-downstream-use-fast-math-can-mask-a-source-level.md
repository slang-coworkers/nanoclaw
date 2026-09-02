---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145325268-5ls3ip
written_at: 2026-09-01T21:17:54.702Z
---

# A downstream --use_fast_math can mask a source-level fast-math test, giving a false-positive redirect assertion

When adding a Slang source-emit fast-math feature (e.g. #12619: `-fp-mode fast` gating CUDA prelude transcendentals to `__*f` intrinsics), a `-target ptx` test that asserts "fast mode selects the approx SFU op (sin.approx/lg2.approx)" can be a FALSE POSITIVE: Slang's NVRTC downstream path already adds `--use_fast_math` for `FloatingPointMode::Fast` (slang-nvrtc-compiler.cpp:~1213), and NVRTC itself maps `sinf`→`__sinf` etc. So the approx op appears in the PTX even if your prelude redirect were deleted — the test proves nothing about your gate.

RULE for testing a source-level emit gate: assert on the EMITTED SOURCE, not on downstream-compiled PTX. Emit lanes (FAST present / DEFAULT absent / CPP absent → CUDA-only) are the real guard, plus a DEFAULT lane to catch an inverted gate / define leaking into non-fast. To truly isolate the redirect on a fast path you must compile the fixture with the gate macro on/off WITHOUT `--use_fast_math` and diff the preprocessed output — otherwise the downstream flag masks the very thing under test. General lesson: when a feature has a downstream equivalent (compiler flag, later pass), a test run through that downstream cannot attribute behavior to your layer.

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786650661382-gpsups
written_at: 2026-08-14T05:45:10.812Z
---

# COMPARE_COMPUTE test can pass VACUOUSLY when FileCheck is absent — cbuffer() never binds a module-scope uniform

**Two independent traps bit on the same test (slang#12535 fix), both make a `.slang` regression test pass while proving nothing:**

1. **FileCheck absent ⇒ `filecheck-buffer=CHECK` comparison is SKIPPED, not failed.** On the fixer/reviewer edges FileCheck is not installed. A `//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu` test then runs the compute shader but the output-vs-CHECK comparison is silently skipped — slang-test reports `passed test:` regardless of the actual buffer contents. So a test that produces all-zeros "passes."

2. **`cbuffer(data=...)` does NOT bind a module-scope `uniform Foo n;`.** For a module-scope uniform struct, the correct directive is `//TEST_INPUT:uniform(data=[...]):name=n`, NOT `cbuffer(...)`. With the wrong binder the uniform stays zero-initialized → the shader reads all zeros.

Combined: a `unorm`/`snorm` layout regression test "passed" 3/3 on cpu+cuda while every output was `0.000000`. Only reading the generated `tests/bugs/<name>.slang.<n>.actual.txt` files revealed it (they were byte-identical zeros). After switching to `uniform(data=[...])` the actual values became correct (1.0/4.0/0.5/-0.5/0.0).

**How to apply:**
- When FileCheck is unavailable locally, a green `slang-test` run is NOT proof. **Always `cat` the `.slang.<n>.actual.txt` files** and eyeball the values against the CHECK lines by hand. A crash-regression test especially must be confirmed to produce the *expected values*, not just "not crash."
- Module-scope `uniform` params → `uniform(data=...)`. `cbuffer(...)`/`ubuffer(...)` are for constant/structured buffers, not a bare module-scope uniform. A silently-unbound input reads as zeros.
- For a struct laid out for both natural (CPU/CUDA) AND constant-buffer (SPIR-V/HLSL) targets, put the widest field (e.g. `float4`) FIRST so its byte offset is identical across layouts; otherwise the CI vk run reads different values than your local cpu run.
- Caught by an adversarial codex reviewer that actually ran the test and hashed the `.actual.txt` files — a reviewer who only reads the diff would have missed it. Run the test AND inspect its output.

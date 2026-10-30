---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793329148996-f0cev2
written_at: 2026-10-30T04:53:00.095Z
---

# Test-server "malformed JSON response" with SLANG_RUN_SPIRV_VALIDATION=1 is a validation abort, not a flake

The failure: under `slang-test -use-test-server` with `SLANG_RUN_SPIRV_VALIDATION=1` set (CI sets it in ci-slang-test.yml), a vk test can fail as `JSON RPC protocol error: the test server returned a malformed HTTP or JSON response`, followed by "unreadable reply … twice in a row".

It looks like a flaky test server, but it can be a real SPIR-V validation abort (E99999) inside the server. Reruns without the env var, or a standalone run without validation, pass, which hides the cause.

- **Diagnose:** run the single test standalone, without `-use-test-server` and with the env var set, to see the spirv-val error. `SLANG_RUN_SPIRV_VALIDATION=1 slang-test tests/<file>.slang`
- **Example (#14087):** `int64_t(ptr)` makes direct SPIR-V emit `OpConvertPtrToU` with a signed result type (`emitCastPtrToInt` uses the inst's own type), which spirv-val rejects.
- **Related trap:** the validation env var checks only SPIR-V that slangc emits directly. For via-GLSL binaries, run in-tree spirv-val yourself. Build it with `cmake --build --preset debug --target spirv-val`; the binary is `build/external/spirv-tools/tools/Debug/spirv-val`.

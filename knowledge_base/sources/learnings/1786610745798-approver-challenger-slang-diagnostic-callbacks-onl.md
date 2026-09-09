---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786605051373-hmafbv
written_at: 2026-08-13T08:45:45.798Z
---

# [approver/challenger] Slang diagnostic callbacks only fire on the rich path — AlwaysGenerateRichDiagnostics gates delivery

Symptom: A PR adds a public per-diagnostic callback API (slang#12490 ISession::setDiagnosticCallback) whose header doc says it "fires once per diagnostic … including spans and notes". Three independent reviews and Devin all flagged the delivery as partial. When judging that gap's severity you must know how DiagnosticSink dispatches.

Root cause (verified at head 6dab6d37, source/compiler-core/slang-diagnostic-sink.h):
- The internal RichDiagnosticCallback hook is fired ONLY from `DiagnosticSink::diagnoseRichImpl` (slang-diagnostic-sink.cpp:655).
- The pervasive untyped template `diagnose(pos, info, args...)` (sink.h:221/237) routes to `diagnoseRichImpl` (fires the callback) ONLY when `Flag::AlwaysGenerateRichDiagnostics` is set; otherwise it goes to `diagnoseImpl`, which bypasses the callback.
- That flag is NOT default. It is set only via `-enable-experimental-rich-diagnostics`, or `-enable-machine-readable-diagnostics` which implies it (slang-compiler-options.cpp:676-682; slang-options.cpp:2823-2846 does the `set(EnableRichDiagnostics,true)` implication).
- The typed form `diagnose(D const& d)` (sink.h:255) ALWAYS goes rich → so tests that provoke a sema error DO see the callback, which can mask the gap.
- `diagnoseRaw(...)` (exception/fatal paths, sink.cpp:962/973/987) never reaches the callback at all.

How to catch it: for any "callback fires per diagnostic" claim, trace the sink's diagnose→rich dispatch and check whether the rich flag is default-on for the sinks the API wires. A unit test that only fires typed sema errors is not evidence the untyped/raw paths are covered. Also enumerate ALL sink-creation sites: slang#12490 wired ~11 but left ComponentType::getLayout (slang-linkable.cpp:127) and specialize (:406) uninstrumented.

Fix / call: a permanent public-API doc contract that overstates delivery + inconsistent rollout is an OPEN_GAP (human must look), not a nit — the trigger is reachable on the default supported path.

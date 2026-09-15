---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1789376725073-tajxgg
written_at: 2026-09-14T09:32:46.162Z
---

# SlangPy py_doc.h: mkdoc strips leading underscore from private symbol names

When checking whether a hand-edited `src/slangpy_ext/py_doc.h` is complete vs a real `slangpy_pydoc` regeneration, note that pybind11_mkdoc **strips the leading underscore** from underscore-prefixed C++ member/method names when forming the doc symbol. So the private method `Device::_notify_command_recording_submitted` becomes `__doc_sgl_Device_notify_command_recording_submitted` (single `_` between `Device` and `notify`), NOT `__doc_sgl_Device__notify_...`.

Consequence/trap: grepping `__doc_sgl_Device__notify` (double underscore) returns nothing and can make you wrongly conclude "private `_notify_*` methods aren't documented." They ARE — grep with a single underscore (`notify_command_recording`) or grep loosely for the bare name. mkdoc emits empty-docstring entries (`R"doc()doc"`) for private data **members** (e.g. `m_..._callbacks`) and for underscore-prefixed internal **methods** (`_notify_*`), but NOT for every private method uniformly — verify against the existing sibling entries in the file rather than assuming.

Practical review guidance: for a PR that adds a new callback mirroring existing ones (e.g. slangpy#1158 adding created/before_finish next to submitted/discarded), a faithful hand-edit must add the member entry AND the `_notify_*` method entry for each. Because the naming is non-obvious, recommend regenerating via the `slangpy_pydoc` target over hand-editing. These are empty docstrings on symbols no binding references, so omissions are cosmetic (no compile error) — but they produce a spurious diff on the next regeneration.

Bonus SGL lifecycle fact (slangpy#1158): `CommandEncoder::finish()` fires the before-finish hook, then calls RHI finish, then sets `m_open=false` only on success. A failed finish (or a throwing before_finish callback) leaves the encoder OPEN — so `finish()` is retryable (re-firing before_finish; before_finish is NOT 1:1 with a recording) and `discarded` fires only on eventual destruction. A profiler must retire per-recording state on submitted-OR-discarded and treat before_finish idempotently.

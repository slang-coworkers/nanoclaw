---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789178279378-py831z
written_at: 2026-09-12T02:11:09.634Z
---

# Inline-buffer over-read: validate copy length vs capacity, NOT offset+length

When triaging/fixing a memory-safety over-read where a descriptor copies bytes from a fixed inline array into a larger destination, the **source** read bound depends only on the **copy length**, not the destination offset. The correct validation is `length <= sizeof(inline_data)`, NOT `offset + length <= sizeof(inline_data)`.

Concrete case: slang-rhi#855 — `ShaderRecordOverwrite { uint8_t offset; uint8_t size; uint8_t data[8]; }`; backends do `memcpy((uint8_t*)dest + overwrite->offset, overwrite->data, overwrite->size)`. The over-read is purely `size > sizeof(data)` (==8). `offset` only shifts the *destination* pointer (and the destination record is separately sized to accommodate `max(offset+size)`). Checking `offset+size > 8` would wrongly reject a perfectly valid record where e.g. `offset=4, size=8` writes 8 source bytes into a 16-byte destination record.

General rule: separate the two bounds — (1) source over-read = `copyLen <= sizeof(source)`; (2) destination overflow = `destOffset + copyLen <= destCapacity` (usually already handled by the allocation sizing). Don't conflate them into one `offset+len` check; that over-restricts valid inputs. A code agent initially proposed the `offset+size` form here — catch it in review.

Also from this issue: slang-rhi has NO single shared Result-returning createShaderTable (base `Device::createShaderTable` is a `SLANG_E_NOT_AVAILABLE` stub; each backend fully overrides). To validate "once for all backends" and still return an error code, add a shared helper (`validateShaderTableDesc`) called at the top of each backend override — the shared base ctor can't return a Result. And slang-rhi (unlike shader-slang/slang) REJECTS C++17 if-init statements — matters when writing the validation code.

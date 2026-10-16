---
title: "tint-validate.mjs rejects all f16 WGSL unless the device requests shader-f16"
type: learning
topic: slang-compiler
source: learnings/1792085503561-tint-validate-mjs-rejects-all-f16-wgsl-unless-the-.md
---

# tint-validate.mjs rejects all f16 WGSL unless the device requests shader-f16

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792083175842-h8d820
written_at: 2026-10-15T17:31:43.561Z
---

# tint-validate.mjs rejects all f16 WGSL unless the device requests shader-f16

/workspace/agent/tools/tint-validate/tint-validate.mjs calls `adapter.requestDevice()` with no features, so any WGSL with `enable f16;` fails with "extension 'f16' is not allowed in the current environment". That is a false negative from the harness, not a Slang bug. The null-backend Dawn adapter (webgpu@0.6.2) does report `shader-f16`. Make a /tmp copy with `requestDevice({requiredFeatures:['shader-f16']})`, e.g. `sed "s/device = await adapter.requestDevice();/device = await adapter.requestDevice({requiredFeatures:['shader-f16']});/"`. To confirm the validator still rejects bad input, feed it a `var x : u16` line: it reports "u16 is unsupported in WGSL". Found while verifying PR #13647 (WGSL ByteAddressBuffer half loads).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792085503561-tint-validate-mjs-rejects-all-f16-wgsl-unless-the-.md`_

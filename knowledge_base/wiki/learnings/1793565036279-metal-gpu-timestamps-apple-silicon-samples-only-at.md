---
title: "Metal GPU timestamps: Apple silicon samples only at stage boundaries (Dawn empty-blit trick)"
type: learning
topic: slang-compiler
source: learnings/1793565036279-metal-gpu-timestamps-apple-silicon-samples-only-at.md
---

# Metal GPU timestamps: Apple silicon samples only at stage boundaries (Dawn empty-blit trick)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793563919824-3ixjox
written_at: 2026-11-01T20:30:36.279Z
---

# Metal GPU timestamps: Apple silicon samples only at stage boundaries (Dawn empty-blit trick)

On Apple-silicon Macs (M1 through M4, macOS 26), `supportsCounterSampling` is true only for `AtStageBoundary`. If you call blit or compute `sampleCountersInBuffer` there, the call errors (see the SDK headers). The working method is to put sample indices in the pass descriptor's `sampleBufferAttachments`: start/endOfEncoderSampleIndex for compute and blit passes, start/endOfVertex and start/endOfFragment for render passes. Each pass takes at most 4 attachments.

Dawn emulates an arbitrary writeTimestamp with `EncodeEmptyBlitEncoderForWriteTimestamp` (CommandBufferMTL.mm). It encodes a blit pass with endOfEncoderSampleIndex set to the query index and adds a 1-byte fill, because Metal does not store samples for empty encoders (dawn:1473).

Sample values are GPU ticks. Calibrate them with `sampleTimestamps:gpuTimestamp:` pairs.

A third party reports zeros on macOS 26 when the GPU resolve is committed before sampling completes (gfx-rs/wgpu issue 9414, open). A CPU `resolveCounterRange` after completion avoids this.

slang-rhi state as of 30250fa: Metal timestamps have been disabled since rhi#307 and never advertise `Feature::TimestampQuery`, so the rhi timestamp tests SKIP on Metal. The WGPU backend has the same gap. Triage memo: slang-triager memory/issues/triage-slang-rhi-962.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793565036279-metal-gpu-timestamps-apple-silicon-samples-only-at.md`_

---
title: "Validate emitted WGSL on the GPU with pip wgpu (naga) when Tint/Dawn are absent"
type: learning
topic: slang-compiler
source: learnings/1793437270685-validate-emitted-wgsl-on-the-gpu-with-pip-wgpu-nag.md
---

# Validate emitted WGSL on the GPU with pip wgpu (naga) when Tint/Dawn are absent

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793436811103-bu38p9
written_at: 2026-10-31T09:01:10.685Z
---

# Validate emitted WGSL on the GPU with pip wgpu (naga) when Tint/Dawn are absent

Coworker containers have no real `slang-tint` library (the only `libslang-tint.so` found was a 15 KB stub in a scratch dir), so `slangc -target wgsl-spirv-asm` fails with E00100/E52002. A fast replacement validator: `python3 -m venv /tmp/wgpuenv && /tmp/wgpuenv/bin/pip install -q wgpu` (wgpu-py 0.32, bundles wgpu-native/naga, ~1 min), then

```python
import wgpu
a = wgpu.gpu.request_adapter_sync(power_preference="high-performance")  # NVIDIA L40S, Vulkan
feats = [f for f in a.features if "clip" in f]                          # enable any feature the module `enable`s
d = a.request_device_sync(required_features=feats)
d.create_shader_module(code=open("x.wgsl").read())                       # raises on invalid WGSL
```

The XDG_RUNTIME_DIR warnings are harmless. This is naga, not Dawn/Tint — say so when citing it (they can disagree). Used for #14130 (WGSL `clip_distances`). Also: on 2026-10-31 `slang/build/Release/bin/slangc` (built 10-30 20:37Z) predated #14097 while Debug (10-31 04:11Z) had it — check binary mtime against the merge time before reproducing a just-merged change.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793437270685-validate-emitted-wgsl-on-the-gpu-with-pip-wgpu-nag.md`_

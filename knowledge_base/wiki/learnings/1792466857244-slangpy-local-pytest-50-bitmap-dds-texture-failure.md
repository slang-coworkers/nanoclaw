---
title: "SlangPy local pytest: 50 bitmap/DDS/texture failures come from git-lfs pointers, and the main checkout's .so is stale"
type: learning
topic: slang-compiler
source: learnings/1792466857244-slangpy-local-pytest-50-bitmap-dds-texture-failure.md
---

# SlangPy local pytest: 50 bitmap/DDS/texture failures come from git-lfs pointers, and the main checkout's .so is stale

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1792464573734-sf08b9
written_at: 2026-10-20T03:27:37.244Z
---

# SlangPy local pytest: 50 bitmap/DDS/texture failures come from git-lfs pointers, and the main checkout's .so is stale

Running `pytest slangpy/tests` in the slangpy-fixer container (venv /workspace/agent/slangpy-main-build-venv):

- **Missing dev deps:** the venv does not have `deepdiff` (also no pytest-timeout, pytest-xdist, or imageio). Collection aborts on test_declrefs.py and test_shapes.py. Fix without touching the venv: `pip install --target /tmp/deps deepdiff imageio`, delete the numpy that pip pulls into /tmp/deps (it would shadow the venv's numpy), and add `/tmp/deps` to PYTHONPATH.
- **50 failures are environmental, not regressions:** 51 of the 53 files in `data/test_images/` are git-lfs pointer files (130-byte text), and git-lfs is not installed. These tests fail with "Unknown file format!", "DDS file has invalid header", "Unsupported source image type", or "Unsupported bitmap metadata format unknown": test_bitmap.py (png_read_bit_depth, dds_read, dds_detect_format), test_bc_codec.py::test_load_and_decode_dds, and test_texture_loader.py (all variants). Decoding a real PNG/JPG with the same build works. Expect about 3633 passed, 50 failed, 599 skipped on an L40S with vulkan and cuda.
- **The main checkout is not a usable baseline:** /workspace/agent/slangpy is at e7bb2242, but its slangpy_ext .so was built Sep 22 from older source. `slangpy/__init__.py` at HEAD calls `_set_default_slang_include_paths`, which that .so does not export, so pytest dies in conftest with a NameError. Rebuild it before using it for baseline comparisons.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792466857244-slangpy-local-pytest-50-bitmap-dds-texture-failure.md`_

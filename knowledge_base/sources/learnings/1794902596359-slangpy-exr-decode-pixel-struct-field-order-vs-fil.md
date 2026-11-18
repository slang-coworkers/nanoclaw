---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1794901768289-blmo5a
written_at: 2026-11-17T08:03:16.359Z
---

# SlangPy EXR decode: pixel-struct field order vs file order, and TinyEXR pixel_types rewrite

When reviewing EXR decode changes in slangpy `src/sgl/core/bitmap.cpp`: (1) the pixel-struct fields are built in `exr_channel_key`-sorted order, NOT the file's alphabetical channel order — so field 0,1,2 of a YC file are Y,RY,BY even though the file lists A < BY < RY < Y; any conversion that indexes data[0..2] relies on this. (2) TinyEXR's `LoadEXRImageFromMemory` overwrites `header.pixel_types[i]` with each channel's actual decoded type post-load (tinyexr.h ~5413), so per-channel conversion is legitimate. (3) Destination component type is file-order channel 0 (alphabetically-first per the EXR spec), NOT the key-sorted first channel — explanations calling it "first sorted" are wrong. (4) `exr_pixel_format`'s coherence gate is order-independent, so `read_exr_info` passing unsorted names is benign but a latent trap. Verified during slangpy#1281 review (2026-11-17).

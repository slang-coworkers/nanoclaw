---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792420990239-5pvo37
written_at: 2026-10-19T14:46:06.308Z
---

# CUDA tex* built-ins type coverage: char/short/int/long/float, no half, no 3-component

The CUDA texture object built-ins (`tex1D/tex2D/tex2DLod/...<T>`) are gated by `__nv_itex_trait<T>` in `/usr/local/cuda-12.6/include/texture_indirect_functions.h:66-104`. It has specializations for char, signed/unsigned char, short, ushort, int, uint, long, ulong and float, each as scalar, 1, 2 and 4 components. There is no `__half` and no 3-component type. So when you say "CUDA has no overload" in a reply or a diagnostic, do not write "float/int/uint only". Write "integer and float types, but not `__half`". Check the header with `grep -n "__nv_itex_trait<" .../texture_indirect_functions.h`.

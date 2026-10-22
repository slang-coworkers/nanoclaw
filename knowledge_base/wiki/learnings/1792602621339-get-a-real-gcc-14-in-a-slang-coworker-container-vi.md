---
title: "Get a real GCC 14+ in a slang coworker container via micromamba (no apt)"
type: learning
topic: slang-compiler
source: learnings/1792602621339-get-a-real-gcc-14-in-a-slang-coworker-container-vi.md
---

# Get a real GCC 14+ in a slang coworker container via micromamba (no apt)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792503242394-zrf6p7
written_at: 2026-10-21T17:10:21.339Z
---

# Get a real GCC 14+ in a slang coworker container via micromamba (no apt)

If you need a newer GCC than the container's GCC 12, for example to locally verify a GCC 14-only warning, you can install one in user space:

```bash
curl -sSL https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xj -C /tmp/mm bin/micromamba
MAMBA_ROOT_PREFIX=/tmp/mmroot /tmp/mm/bin/micromamba create -y -p /tmp/gcc14 -c conda-forge --ssl-verify "$SSL_CERT_FILE" gxx_linux-64=14
```

The `--ssl-verify "$SSL_CERT_FILE"` flag is required. Without it, the OneCLI proxy's self-signed CA fails the repodata download with "SSL peer certificate … self-signed certificate in chain".

A full Slang build then works with no other changes:

```bash
cmake -B <dir> -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DCMAKE_C_COMPILER=/tmp/gcc14/bin/x86_64-conda-linux-gnu-gcc \
  -DCMAKE_CXX_COMPILER=/tmp/gcc14/bin/x86_64-conda-linux-gnu-g++
```

Run the tests with `LD_LIBRARY_PATH=/tmp/gcc14/lib`.

An out-of-tree build dir causes two false results in `slang-unit-test-tool/`:
- **`optixMultipleDefinition` fails.** OptiX headers are looked up 3 directories above the binary, at `<root>/external/optix-dev` (`slang-nvrtc-compiler.cpp:858`).
- **`CapabilityGeneratorFailsOnError` is ignored.** It needs `<build>/generators/<cfg>/bin`.

To get a like-for-like result, copy `<build>/RelWithDebInfo` and `<build>/generators` under `<root>/build/` next to `<root>/external/optix-dev`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792602621339-get-a-real-gcc-14-in-a-slang-coworker-container-vi.md`_

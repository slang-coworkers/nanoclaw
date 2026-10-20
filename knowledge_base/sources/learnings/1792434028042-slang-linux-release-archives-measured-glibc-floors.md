---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790610656705-by9rrv
written_at: 2026-10-19T18:20:28.042Z
---

# Slang Linux release archives: measured glibc floors and slang-llvm packaging (v2026.20)

Measured on v2026.20 with `readelf -V` over every ELF file (the container has no `file` tool, so filter ELFs by `head -c4 | grep -q ELF`):

| Archive | Highest `GLIBC_` symbol |
|---|---|
| unsuffixed `linux-x86_64` | 2.34 |
| unsuffixed `linux-aarch64` | 2.34 |
| `-glibc-2.27` | 2.17 |
| `-glibc-2.28` (x86_64 and aarch64) | 2.17 |

How each archive is built:

- **Unsuffixed archives:** built natively on `ubuntu-22.04` / `ubuntu-22.04-arm` by release.yml:24/30. Their floor follows the host image: jammy 2.35, noble 2.39, resolute 2.43.
- **Suffixed archives:** built in containers (`gztong/ubuntu18-gcc11:glibc2.28`, `manylinux_2_28`). A runner-label change leaves their floor alone.

Only the unsuffixed `linux-x86_64` archive ships `lib/libslang-llvm.so` (release.yml:71). Both suffixed builds use `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE`.

So "just keep the 2.28 build" when moving off `ubuntu-22.04` silently drops slang-llvm on Linux. Check this before proposing a release-runner change.

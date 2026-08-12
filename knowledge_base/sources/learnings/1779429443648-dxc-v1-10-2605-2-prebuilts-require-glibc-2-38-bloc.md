# DXC v1.10.2605.2 prebuilts require GLIBC 2.38 (blocks Ubuntu 22.04 CI)

# DXC v1.10.2605.2 prebuilts require GLIBC 2.38

When bumping `cmake/FetchDXC.cmake` to Microsoft's preview DXC build `v1.10.2605.2`
(first official build with SM 6.10 / `dx/linalg.h` support), the prebuilt Linux
binaries `libdxcompiler.so` and `libdxil.so` are linked against **GLIBC_2.38**.

Verify with:
```bash
objdump -T build/_deps/dxc-src/lib/libdxcompiler.so | grep -oP 'GLIBC_2\.[0-9]+' | sort -V -u
```

GLIBC version by distro:
- Ubuntu 22.04: 2.35 ❌
- Debian 12: 2.36 ❌
- Ubuntu 24.04: 2.39 ✅
- Debian 13: 2.39 ✅

Slang CI today uses `ubuntu-22.04` for many Linux build/test jobs
(`.github/workflows/ci.yml` lines 55, 63, 74, 82). Bumping DXC alone will
break the DXIL load path on those runners. The custom container
`ghcr.io/shader-slang/slang-linux-gpu-ci:v1.6.0` GLIBC is unknown — verify
before rolling preview DXC.

This GLIBC dependency is also why **local DXIL smoke tests cannot run**
inside the standard fixer dev container (Debian 12, GLIBC 2.36) once
the URL is bumped — verification has to happen on CI or in an Ubuntu 24.04
container.

# Side note: tests' `-Xdxc -Ibuild/dxc/include` needs explicit header staging

The cooperative-vector/matrix tests carry `-Xdxc -Ibuild/dxc/include` so the
DXC compiler can find `dx/linalg.h`, but **no CMake rule populated that path**
prior to this PR. The DXC tarball ships headers at
`_deps/dxc-src/include/hlsl/dx/linalg.h`. Add to `cmake/FetchDXC.cmake` after
`FetchContent_MakeAvailable(dxc)`:

```cmake
if(IS_DIRECTORY "${dxc_SOURCE_DIR}/include/hlsl")
    file(
        COPY "${dxc_SOURCE_DIR}/include/hlsl/"
        DESTINATION "${CMAKE_BINARY_DIR}/dxc/include"
    )
endif()
```

Without this, every `//TEST(...):SIMPLE(filecheck=DXIL):-target dxil ... -Xdxc -Ibuild/dxc/include`
in `tests/cooperative-{vector,matrix}/` will fail with `dx/linalg.h not found`.

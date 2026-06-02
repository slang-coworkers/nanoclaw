### SlangPy repository layout

- `slangpy/` -- Python package (high-level API: Module, Function, Device, Tensor)
- `slangpy/core/` -- Core Python API: `function.py` (FunctionNode), `calldata.py` (CallData), `callsignature.py`, `module.py`, `struct.py`
- `slangpy/bindings/` -- Type marshalling: `boundvariable.py` (BoundCall/BoundVariable), `marshall.py` (Marshall base), `typeregistry.py`, `codegen.py`
- `slangpy/reflection/` -- Type resolution: `typeresolution.py`
- `slangpy/builtin/` -- Built-in type marshalls (Tensor, Scalar, etc.)
- `slangpy/tests/` -- Python tests (pytest). See `/slangpy-build` to run.
- `src/sgl/` -- Native C++ (GPU abstraction over slang-rhi)
- `src/slangpy_ext/` -- nanobind Python bindings: `utils/slangpyfunction.cpp` (NativeFunctionNode::call), `utils/slangpy.cpp` (NativeCallData::exec)
- `src/slangpy_torch/` -- Native torch integration extension
- `tests/` -- C++ tests (doctest)
- `tools/` -- Utility scripts incl. `ci.py` (CI task runner)
- `examples/`, `samples/` -- Example code and experiments
- `docs/` -- Documentation (Sphinx)
- `external/` -- External C++ deps (slang-rhi, nanobind, etc.)
- `.github/workflows/` -- CI workflows. See `/slangpy-github` for CI issues.
- `CMakeLists.txt` -- Native build config. CMake presets: `linux-gcc`, `windows-msvc`, `macos-arm64-clang`.
- `pyproject.toml` -- Python build config (setuptools + cmake + ninja).

**Debug aid:** `SLANGPY_PRINT_GENERATED_SHADERS=1` dumps generated kernel code for any call.

---
title: "SlangPy py_doc.h must be updated when editing SlangCompilerOptions docstrings"
type: learning
topic: slang-compiler
source: learnings/1783909847856-slangpy-py-doc-h-must-be-updated-when-editing-slan.md
---

# SlangPy py_doc.h must be updated when editing SlangCompilerOptions docstrings

When you edit a `///` docstring on a struct field in `src/sgl/device/shader.h` (e.g. `SlangCompilerOptions.downstream_args`), the change does NOT reach Python users automatically. Python docstrings come from `src/slangpy_ext/py_doc.h`, a **checked-in generated file** (pybind11_mkdoc). The regeneration path is the `slangpy_pydoc` CMake custom target (`src/slangpy_ext/CMakeLists.txt:227`, runs `python -m pybind11_mkdoc -std=c++20 -stdlib=libc++ ... -o py_doc.h`), which needs a full build + vcpkg include dir.

If you can't run that target (no build / low disk), hand-edit `py_doc.h` to match: entries look like `static const char *__doc_sgl_SlangCompilerOptions_<field> = R"doc(...)doc";` with ~70-column reflow. `py_doc.h` is in the pre-commit `exclude:` list (`.pre-commit-config.yaml:43`), so clang-format won't touch it — but keep it ASCII and no trailing whitespace. A code review WILL catch the desync if you only edit shader.h. (Found on issue #1058 / PR #1061.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783909847856-slangpy-py-doc-h-must-be-updated-when-editing-slan.md`_

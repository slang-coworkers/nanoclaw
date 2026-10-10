---
title: "Python 3.15 pyconfig.h breaks -Werror builds of nanobind<2.12 extensions on Linux (_POSIX_C_SOURCE/_XOPEN_SOURCE redefined)"
type: learning
topic: ci-tooling
source: learnings/1791575026477-python-3-15-pyconfig-h-breaks-werror-builds-of-nan.md
---

# Python 3.15 pyconfig.h breaks -Werror builds of nanobind<2.12 extensions on Linux (_POSIX_C_SOURCE/_XOPEN_SOURCE redefined)

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1791571513091-0am71r
written_at: 2026-10-09T19:43:46.477Z
---

# Python 3.15 pyconfig.h breaks -Werror builds of nanobind<2.12 extensions on Linux (_POSIX_C_SOURCE/_XOPEN_SOURCE redefined)

**Symptom.** Building a C++ extension against CPython 3.15 on Linux/glibc with `-Werror` fails in every TU: `pyconfig.h:2067: "_POSIX_C_SOURCE" redefined` and `pyconfig.h:2124: "_XOPEN_SOURCE" redefined`. This was verified with slangpy_ext, gcc 12 and 3.15.0rc2; 32 TUs failed.

**Why it's new in 3.15.** CPython's configure now defines `_POSIX_C_SOURCE 202405L` and `_XOPEN_SOURCE 800`. In 3.14 these were 200809L and 700, the same values glibc's features.h already sets under g++ (which defines _GNU_SOURCE). An identical redefinition is silent, so the problem was invisible until 3.15. Any TU that includes a C++ std header before Python.h now warns. Darwin and Windows pyconfig don't define these macros, so the failure is Linux-only.

**Fix.** Make Python.h the first include.
- nanobind fixed its own header in wjakob/nanobind#1289 (merge 890745357b56, in ≥2.12.0), which moves `nb_python.h` above the std includes in nanobind.h. On the v2.10.2 fork, cherry-picking that commit cut the failures from 32 TUs to 3.
- The remaining TUs were project files that include `<algorithm>`, `<optional>` or `<initializer_list>` before "nanobind.h". After reordering those, the build is clean.
- Watch PCH headers too: a PCH that begins with std headers re-triggers the warning.
- Turning off `-Werror` only hides the problem; source builds by users will still fail.

**Also for 3.15 wheels.**
- cibuildwheel builds cp315 by default only from **4.2.0** (2026-08); 3.x has no cp315 identifiers.
- cibuildwheel 4.0 changed defaults: delvewheel is the Windows repair-wheel-command, and abi3audit runs on abi3 wheels.
- nanobind 3.x is the line with native 3.15 support, but it drops Python 3.9.
- PyTorch has no cp315 wheels on PyPI or the cu128 index; cu126/130/132 have them for torch ≥2.13.

Source: slangpy#1216 triage (2026-10-09). Same symptom in the wild: open-atmos/PyPartMC#555.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791575026477-python-3-15-pyconfig-h-breaks-werror-builds-of-nan.md`_

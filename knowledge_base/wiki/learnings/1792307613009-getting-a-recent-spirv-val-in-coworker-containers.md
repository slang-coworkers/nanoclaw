---
title: "Getting a recent spirv-val in coworker containers"
type: learning
topic: slang-compiler
source: learnings/1792307613009-getting-a-recent-spirv-val-in-coworker-containers.md
---

# Getting a recent spirv-val in coworker containers

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792307418189-022wun
written_at: 2026-10-18T07:13:33.009Z
---

# Getting a recent spirv-val in coworker containers

SPIRV-Tools GitHub releases (e.g. v2026.4) ship no binary assets. The Khronos CI build (storage.googleapis.com/spirv-tools/badges/build_link_linux_clang_release.html -> install.tgz) needs GLIBC_2.38/GLIBCXX_3.4.32, but the container is Debian 12 (glibc 2.36), so it fails to run. Workaround that took about 1 minute on 64 cores: shallow-clone SPIRV-Tools at the tag, fetch SPIRV-Headers at the `spirv_headers_revision` from DEPS into external/spirv-headers, then `cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DSPIRV_SKIP_TESTS=ON -DSPIRV_WERROR=OFF` and `ninja spirv-val`. A built copy may still exist at /tmp/spirv-tools-ci/src/build/tools/spirv-val (v2026.4).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792307613009-getting-a-recent-spirv-val-in-coworker-containers.md`_

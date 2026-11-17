---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794813722856-apacak
written_at: 2026-11-16T13:29:44.435Z
---

# Pre-build dry-checks catch slang build failures in seconds

Slang full builds cost 15-30 min; two of slang#14498's three build failures (and much of the third) were catchable in seconds BEFORE burning a run: (1) CMake variables set in one subdirectory (source/standard-modules) are invisible to a SIBLING directory added from the top-level CMakeLists — only CACHE INTERNAL variables cross that boundary; after writing a custom command, dry-check its expansion with `ninja -C build -t commands | grep <tool>` and confirm the argument list is complete. (2) Headers resolve from the INCLUDING file's own directory first, then -I paths — `slang-com-ptr.h` lives in `include/`, not `source/core/`; grep the real location of every `#include` you add in a new file before building. (3) slang-without-embedded-core-module (bootstrap) links slang-common-objects, so ANY new symbol referenced from slang-session.cpp/slang-language-server.cpp must have a definition in bootstrap's link set too — the pattern is adding the `-no-` empty variant target to its LINK_WITH_PRIVATE (as slang-no-embedded-core-module does). Rule of thumb: cheap dry-checks (ninja -t commands, header grep, one standalone compile of the new TU) before every full build.

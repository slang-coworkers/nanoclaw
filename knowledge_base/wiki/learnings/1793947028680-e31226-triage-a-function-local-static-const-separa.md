---
title: "E31226 triage: a function-local static const separates the check from lowering"
type: learning
topic: agent-ops
source: learnings/1793947028680-e31226-triage-a-function-local-static-const-separa.md
---

# E31226 triage: a function-local static const separates the check from lowering

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793946278456-imo3c0
written_at: 2026-11-06T06:37:08.680Z
---

# E31226 triage: a function-local static const separates the check from lowering

The E31226 check (`checkVarDeclCommon`, slang-check-decl.cpp ~:3834) runs only when `isGlobalDecl(varDecl)` is true. A function-local `static const` with the same initializer skips the check but goes through the same `lowerConstantDeclCommon` → IRGlobalConstant lowering. So when a global `static const` fails with E31226, write the same declaration inside the function body and compile it for all targets. If that compiles cleanly, the bug is only a check false positive, not a lowering gap, and no code edit is needed to show it. Used on #14378 (2026-11-06): resource-typed `static const Texture2D t = tex;` compiled for spirv (validated), hlsl, glsl, metal, wgsl and cuda when local. To pin a regression window, download release tarballs with `gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'`; for #10925 the first bad release is v2026.9.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793947028680-e31226-triage-a-function-local-static-const-separa.md`_

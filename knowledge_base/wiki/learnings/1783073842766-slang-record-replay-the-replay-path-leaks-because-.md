---
title: "Slang record-replay: the REPLAY path leaks because ReplayContext registries are raw/non-owning (DeepWiki wrongly says owning)"
type: learning
topic: slang-compiler
source: learnings/1783073842766-slang-record-replay-the-replay-path-leaks-because-.md
---

# Slang record-replay: the REPLAY path leaks because ReplayContext registries are raw/non-owning (DeepWiki wrongly says owning)

Context: triaging shader-slang/slang#11936 (LSan direct leaks from the record-replay *replay* path), verified @ f4975a7f8.

**Mechanism.** During playback, `ReplayContext::executeNextCall` → `replayHandler` → `callMethodWithDefaults` (source/slang-record-replay/proxy/proxy-macros.h:356-375) invokes each proxy method with default-initialized args and **discards the return value**. The proxy method body still calls the real impl (`getActual<>()->method(...)`), so object-creating calls produce refcount-1 objects — proxy wrappers via `wrapObject`/`tryWrap` (proxy-base.cpp:19-43, `new ProxyT` + `addRefImpl()`), or an `ISlangBlob`/`RawBlob` from the real impl. Null out-params are redirected by `PREPARE_POINTER_OUTPUT` (proxy-macros.h:68-71) to a stack temp `_temp_<arg>`. On method-scope exit the temp dies; the discarded return dies — and **nobody releases the object**.

**Why nothing releases it (the crux, and where DeepWiki lies).** The `ReplayContext` handle/proxy registries — `m_handleToObject`, `m_objectToHandle`, `m_proxyToImpl`, `m_implToProxy` — are declared `Dictionary<..., ISlangUnknown*>` i.e. **RAW, NON-OWNING** pointers (replay-context.h:789-795). `registerProxyImpl` stores raw pointers and **never `addRef`s** (replay-context.cpp:727-744); `reset()`/`~ReplayContext`/`switchToPlayback`/`switchToSync` only `.clear()` the maps — **no `release()`** (replay-context.cpp:213-267). Blobs aren't even registered (proxy-base.cpp:93 "Blobs are not wrapped"). So no owning reference survives the `callWithDefaults` call → direct leak. Record path doesn't leak because the caller holds the ComPtr.

**DeepWiki correction:** `mcp__deepwiki__ask_question` confidently asserted `m_handleToObject`/`m_proxyToImpl` "hold owning references" and "take ownership… storing them in its maps." That is FALSE — the container element type is a raw `ISlangUnknown*`, and the register/reset code proves no addRef/release. Trust the source over DeepWiki for lifetime/ownership questions; DeepWiki infers "owning" from "tracked", which is wrong here.

**Fix layer:** release the orphaned replay-only objects at their creation scope — the `_temp_<arg>` scaffolding (type-safe COM/blob release at method-scope exit, replay-path-only so record mode is a no-op) + release-before-overwrite in the playback `record(…, ISlangBlob*&)`/RECORD_COM_OUTPUT path + release the discarded return value in the dispatch layer. Making the registries owning fixes only the proxy subset (not blobs) and has wider blast radius. Same `_temp_<arg>` convention as the #11865 uninit-read fix.

**Bonus (verify-at-HEAD trap):** #11936's Test Plan says remove `SlangRecord::tryWrap` / `SlangRecord::callWithDefaults` from `cmake/expected-sanitizer-findings.txt`, but those patterns were absent from ALL 3 suppression files (expected-sanitizer-findings.txt, lsan-suppressions.txt, sanitizer-ignorelist.txt) at HEAD — a sanitizer-suppression issue can reference entries added by a not-yet-merged sibling PR. Always grep the suppression files at HEAD before assuming there's something to remove.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783073842766-slang-record-replay-the-replay-path-leaks-because-.md`_

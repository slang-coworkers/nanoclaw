---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790672363464-s7l314
written_at: 2026-09-29T09:16:59.809Z
---

# Slang Dictionary iteration order leaks into output via pointer-keyed loops (map-swap hazard)

At master b9199bdaa, Slang's `Dictionary`/`HashSet` wrap `ankerl::unordered_dense`. Its dense-vector storage means iteration follows insertion order (erase swaps the last entry into the hole), so output is deterministic today. Some plain (non-Ordered) Dictionary loops still let that order reach output:
- `slang-ir-lower-dynamic-dispatch-insts.cpp:338`, over an `IRInst*`-keyed map (`:276`): sets the wrapper/switch-case order of the generated dispatch function.
- `slang-serialize-source-loc.cpp:128`, over a `SourceFile*`-keyed map: sets `m_sourceInfos` order in serialized modules. The reader is a linear search (`:170-176`), so this changes bytes only.
- `slang-ir-link.cpp:1939`, int-keyed: sets the order of the atomic struct.

Any change to a hash-order map (e.g. boost::unordered_flat_map; see #13309, branch expipiplus1 3c87126) can make pointer-keyed output vary between runs of the same binary, because pointers hash their address and ASLR changes addresses. Check for this with a byte-compare of output over repeated runs of one binary; FileCheck tests won't catch it.

Related: master `getHashCode(const char*, len)` (`slang-hash.h:136-139`) calls the PRIVATE `ankerl::unordered_dense::detail::wyhash::hash`, which Homebrew's unordered_dense no longer has. PR #13293 switches it to the public `hash<std::string_view>`. The #13309 branch's WYHASH path re-adds the private call.

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1794095316837-99kpt6
written_at: 2026-11-07T23:50:35.907Z
---

# Slang: << and >> operators are not generic over ILogical/IInteger (only __BuiltinIntegerType)

Verified on slangc v2026.21 (Discord thread 1568774184769683486): in generic code, `first >> second` with `T : ILogical` or `T : IInteger` fails with E39999 "no overload for '>>'" + note E40022 "type argument 'T' does not conform to '__BuiltinIntegerType'". In source/slang/core.meta.slang the `kShiftOps` block declares `<<`/`>>` only for `L, R : __BuiltinIntegerType`, while `& | ^ ~ && || !` have `__generic<T : ILogical>` overloads (OverloadRank -10). Compound `&= |= ^=` only exist for `__BuiltinLogicalType`.
Workaround that compiles: `T : IInteger` and `first.shr(int(second)).toUInt()` (`shl`/`shr` take int, return T; ILogical alone has no conversion back to uint, only `init(int)`). The user guide line "Operator overloads are defined for these interfaces" is not true for shifts. No GitHub issue found for it.
Tooling tip: a release tarball (`https://github.com/shader-slang/slang/releases/download/<tag>/slang-<ver>-linux-x86_64.tar.gz`, tag from api.github.com/repos/shader-slang/slang/releases/latest) unpacks to bin/slangc and is enough to repro in under a minute. `-o /dev/null` fails with E00004; write to a real file. Also: in this session the deepwiki MCP tools (ask_wiki_question, read_wiki_structure) were all rejected with "PreToolUse hook error: Blocked by hook".

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042334907-mmbuho
written_at: 2026-08-18T09:12:29.307Z
---

# test-server garble hook writes through text-mode CRT stdout — mangles \r\n\r\n on Windows

The Slang test-server fault-injection garble hook (`SLANG_TEST_SERVER_GARBLE_ON_REQUEST`, added PR #12573 / commit a0690fa7d2, 2026-08-17) writes its non-message bytes `"this-is-not-a-jsonrpc-header\r\n\r\n"` via `fwrite`/`fflush` on the **C runtime `FILE* stdout`** (`tools/test-server/test-server-main.cpp:809-814`). But the framed JSON-RPC **reply** is written through a **different channel**: `Process::getStdStream(Out)` → `WinPipeStream::write` → raw `::WriteFile` on `GetStdHandle(STD_OUTPUT_HANDLE)` (`slang-win-process.cpp:281,422`; `slang-json-rpc-connection.cpp:48-52`), which does no CRLF translation.

There is **no `_setmode(_fileno(stdout), _O_BINARY)` anywhere in Slang's own source** (grep hits only `external/spirv-tools`), so on Windows the CRT `stdout` is in default **text mode**. Text mode translates each `\n`(0x0A)→`\r\n`(0x0D0A), so the garble's terminator `\r\n\r\n` (0D0A0D0A) goes on the wire as `\r\r\n\r\r\n` (0D 0D 0A 0D 0D 0A) — which does **NOT** contain the `\r\n\r\n` the client's `HTTPHeader::findHeaderEnd` scans for (`slang-http.cpp:9,52-61`). So on Windows the garbled bytes no longer self-terminate the header and the client's immediate malformed-header (`ProtocolError`) detection is defeated; it falls to waiting for the real reply to supply a terminator. Linux/macOS have no translation, so it works as intended there.

**Why this matters / the trap:** this cleanly explains a *Windows-only* symptom but NOT a *debug-only* one — text mode is identical in debug and release. Don't stop at "found the Windows bug"; a debug-vs-release split needs a co-factor (release likely coalesces garble+reply into one client read, masking the corruption; debug slowness unmasks it; and a permanent hang additionally needs an assert-modal-dialog block or a real race). Candidate fix: `_setmode(_fileno(stdout), _O_BINARY)` at server startup (safe — the reply path bypasses the CRT via WriteFile, and the server never writes stdout except through the connection). But validation of "does it stop the debug hang" needs the Windows-debug runner. General lesson: a binary protocol stream must never sit on a text-mode CRT FILE*; and when two write paths (CRT FILE* vs raw handle) share one pipe, CRLF translation applies to only one of them.

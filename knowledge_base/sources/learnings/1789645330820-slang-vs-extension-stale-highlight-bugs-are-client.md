---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789644807415-py7xr7
written_at: 2026-09-17T11:42:10.820Z
---

# slang-vs-extension stale-highlight bugs are client-side semantic-token cache/version mismatches, not slangd

When triaging a "syntax highlighting breaks/gets stuck after editing" report in **shader-slang/slang-vs-extension** (the C#/VSIX Visual Studio extension — distinct from the VS **Code** extension and from slangd), the bug is almost always in the extension's own **C# semantic-token classification tagger**, not in the Slang language server.

Key mechanism (verified in the extension @ v1.3.1, code unchanged since first commit 3cc627a 2024-01-22):
- Rich highlighting = LSP semantic tokens rendered by `SlangTokenHighlightTagger : ITagger<IClassificationTag>` (`src/SlangTokenHighlightTagger.cs`). `GetTags` decodes cached LSP token deltas into absolute offsets against the **current** editor snapshot with **no snapshot-version stamp and no `TranslateTo`** (`:76`, `:97-101`). A multi-line cut/paste (ctrl-x/ctrl-v) shifts the buffer while cached tokens describe the old layout → tokens mis-color live text (a token read as tokenType 0 = `Slang_Type` → "stuck in the type color"); an offset overrun throws into `catch { yield break; }` (`:103-106`) which silently kills the ENTIRE remaining tag enumeration. No `TextBuffer.Changed` re-map, so it "never recovers" until a fresh clean response lands.
- Secondary: the 2000ms debounce is dead code — `DateTime m_LastSemanticRequest;` is non-nullable so `== null` is always false (`SlangMiddleLayer.cs:23,49-53`); every edit fires an unthrottled `semanticTokens/full`, and out-of-order responses overwrite the token cache with no version check (`SlangWorkspace.cs:145`), so an intermediate syntax-error token set can become the sticky last-write.

Triage corrective worth stating up front: the common "rebuild the extension with the latest Slang libraries / cut a new release" suggestion will NOT fix this class of bug — the extension doesn't even pin a slangd version (launches whatever `SlangServer/slangd.exe` ships beside it), and the defect is client-side C#. Non-reproducibility in vim/other LSP clients (which re-map/re-request tokens on didChange) is a positive signal that the bug is the VS extension's tagger, not the server. Fix direction: stamp each token set with its request snapshot version and `TranslateTo`/re-map or discard-and-re-request on mismatch; replace `catch{yield break}` with a per-token `continue`; fix the debounce / drop stale-version responses.

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788275298714-r5q6l2
written_at: 2026-09-02T11:56:25.890Z
---

# completionItem/resolve has a NON-nullable LSP result — don't send null (slang LSP)

**Context:** follow-up on shader-slang/slang#12870. When making LSP "no result" responses emit JSON `null` instead of `{}`, it's tempting to route *every* no-result site through the same `sendNullResult(id)` helper. That is WRONG for `completionItem/resolve`.

**The trap:** unlike hover/gotoDefinition/completion/etc. (whose LSP result is nullable), `completionItem/resolve` has a **non-nullable** result — the spec requires it to answer with a `CompletionItem` (or a JSON-RPC error), never `null`. A maintainer caught this in review.

**Where it bites in slang:** `LanguageServerCore::completionResolve` (`source/slang/slang-language-server.cpp`) returns `std::nullopt` in exactly one case — the item's `data` is empty AND its `textEdit.newText` is non-empty. That's the **file/import completion** shape: the completion path (`slang-language-server-completion.cpp`) produces `TextEditCompletionItem`s that carry a `textEdit` but no `data` to enrich. Routing that through `sendNullResult` sends `null`, which strict clients reject — the same class of bug as the original `{}` issue.

**Correct fix (handler boundary, `LanguageServer::completionResolve`):**
- On `result.isNull` (the textEdit-no-data case): echo the client's item back. Crucially, send the `TextEditCompletionItem` (NOT the `CompletionItem`) — `CompletionItem` has no `textEdit` field, so returning it would DROP the textEdit. The handler already parses the client params into both a `CompletionItem` and a `TextEditCompletionItem`, so `editItem` is on hand.
- On `SLANG_FAILED(result.returnCode)`: send `sendError(JSONRPC::ErrorCode::InternalError, ..., id)` — item-or-error, never null.

**Testing it:** the LANG_SERVER harness had no resolve directive. Added a `//RESOLVE` directive that sends a synthetic `completionItem/resolve` for a textEdit-only item (no completion context needed — the null path returns before touching the workspace) and prints the resolved label/newText/range (or "null"). The test asserts the full TextEdit (including range) round-trips. Teeth-proven: fails if the isNull branch is reverted to `sendNullResult`.

**General rule:** before mapping an LSP method's empty case to `null`, check whether that method's `result` is actually nullable in the LSP spec. Nullable → `null`. Non-nullable (e.g. completionItem/resolve) → return the value or a JSON-RPC error.

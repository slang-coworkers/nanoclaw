---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794891274110-jwnvsq
written_at: 2026-11-17T05:13:51.490Z
---

# Slang issue Type "Language Maturity" exists; GraphQL issueType is authoritative, REST type field can be null

shader-slang/slang Issue Types are not limited to Bug/Feature/Testing. 2026-11-17, #13621 (keyword-classification RFC): GraphQL `issueType` returned **"Language Maturity"** (`IT_kwDOAb2kZs4BnXGY`), human-set — a better fit than Feature for RFC/policy issues, so check before setting Feature. Gotcha: the REST `GET /repos/.../issues/N` field `type` returned `null` for the same issue while GraphQL had it — use GraphQL `issueType` for the drift-check before any Type write. Why it matters: bot-overwriting a human's more-specific Type violates the never-overwrite-human-triage rule and has burned us before (#12526).

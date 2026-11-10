---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793858928003-n4rvnv
written_at: 2026-11-10T03:45:35.422Z
---

# Slang: as<T>(Type*) and Val::equals both canonicalize via resolve()

In slang-ast-base.h, `as<T>(Type*)` is `dynamicCast<T>(type->getCanonicalType())` and `getCanonicalType()` is `as<Type>(resolve())`; `Val::equals` compares `resolve()` results. So `as<BasicExpressionType>(t)->getBaseType()==BaseType::Void` and `t->equals(astBuilder->getVoidType())` are equivalent void tests (typedef sugar is stripped by both). Useful when a reviewer asks to unify the two idioms without a behaviour change.

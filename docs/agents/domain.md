# Domain Docs

This repository uses a single-context layout.

Consumer rules:

- Read `CONTEXT.md` at the repo root first when present.
- Read `docs/adr/` for architecture decisions when present.
- Treat these files as the source of domain language and project constraints.
- If the repo later splits into multiple contexts, add `CONTEXT-MAP.md` at the root and point each context to its own `CONTEXT.md`.

Current state:

- No `CONTEXT.md` exists yet.
- No `docs/adr/` directory exists yet.
- The layout is still single-context unless the repo later grows a monorepo structure.

# prompt_audit

A developer tool that audits prompt chains against context-engineering best
practices — flagging anti-patterns and suggesting fixes. Built in Odin.

It ingests a JSON transcript (Anthropic Messages / OpenAI chat shape), models
it as a typed `PromptChain`, runs a catalog of rules over it, and prints a
scored report. Exit code is non-zero when a High/Critical finding is present,
so it can gate CI.

## Run

```bash
odin run . -- testdata/ronscoffee.json
```

Auditing this repo's own memory-heist attack transcript flags the injection and
the link-following tool:

```
1. [Critical] Untrusted content used as instruction
   Untrusted (External) content contains instruction-like text "ignore previous"
   fix [Restructure]: Wrap this content in an explicit data block…
2. [High] Tool follows links from fetched content
   fix [Restructure]: Set follows_links=false; fetch only user-provided URLs…
```

## Pipeline

| Phase | File | What it does |
|-------|------|--------------|
| Ingest | `ingest.odin` | Parse transcript → `PromptChain`; infer `SegmentKind`/`TrustLevel`; estimate tokens |
| Models | `models.odin` | Map a model id to capability metadata (window, tools, caching, family) |
| Rules | `rules.odin` | Data-driven anti-pattern catalog + id→detector wiring |
| Detect | `detect.odin` | Concrete heuristic detectors; findings sorted worst-first |
| Fix | `fix.odin` | Suggest edits; `apply_fix` produces a modified clone (pure) |
| Report | `report.odin` | Score (0–100, per-category), assemble and render the report |
| Pipeline/CLI | `audit.odin` | `audit()` composes the phases; `main` is the CLI + CI gate |

Types live in `structs.odin`.

## Rules

`untrusted-as-instruction`, `tool-follows-untrusted-link`, `system-prompt-buried`,
`examples-after-input`, `no-output-schema`, `cache-hostile-ordering`,
`context-window-overflow`, `conflicting-instructions`, `deprecated-pattern`.

## Scope notes

- Trust is inferred from role (system/assistant = trusted, user = user input,
  tool results = external/untrusted). Callers that build a `PromptChain`
  programmatically can tag `SegmentKind`/`TrustLevel` directly for sharper
  results — every rule works the same either way.
- Token counts are a `chars/4` heuristic; swap in a provider tokenizer in
  `estimate_tokens` without touching callers.
- Parsing prompt-assembly source code (`.py`/`.ts`) into a chain is out of
  scope; use the JSON transcript format or the in-memory builder.

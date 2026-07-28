package prompt_audit

// Implementation roadmap for the prompt-audit tool.
//
// This file sketches the procedure surface the analyzer, rule engine, and
// report renderer will expose. Everything here is a stub — each proc returns
// a zero value so the package compiles while the TODOs below get filled in.
//
// Work is ordered roughly in dependency order: parsing/ingest first, then the
// rule engine, then fixes, then reporting and the CLI.

import "core:time"

// ---------------------------------------------------------------------------
// 1. Ingest — turn app source into a PromptChain
// ---------------------------------------------------------------------------

// TODO(ingest): parse a chain out of a source file. Support at least:
//   - raw JSON transcript (Anthropic Messages / OpenAI chat format)
//   - a .py / .ts file that assembles messages inline (best-effort extraction)
// TODO(ingest): tokenize each segment and populate token_count / Message.token_count.
//   Use a provider-appropriate tokenizer; fall back to a heuristic (chars/4) when
//   the exact tokenizer isn't available for a model.
// TODO(ingest): infer SegmentKind for unstructured messages (heuristics: leading
//   "You are..." -> Persona, fenced/tagged blocks -> Delimiter, etc.).
// TODO(ingest): infer TrustLevel from where content came from (developer literal
//   vs. interpolated user variable vs. tool-result feedback).
parse_chain :: proc(source: string, path: string) -> (chain: PromptChain, ok: bool) {
	// TODO: implement
	return {}, false
}

// TODO(ingest): resolve the target Model from a provider id string, filling in
//   capability metadata from a built-in table. Unknown ids -> Provider.Unknown
//   with conservative defaults.
resolve_model :: proc(provider_id: string) -> Model {
	// TODO: implement
	return {}
}

// ---------------------------------------------------------------------------
// 2. Rule catalog — the data-driven anti-pattern definitions
// ---------------------------------------------------------------------------

// TODO(rules): build the seed catalog. First-pass rules to author:
//   - untrusted-as-instruction   (External/Retrieved segment in an Instruction slot)
//   - tool-follows-untrusted-link (fetch-style tool with follows_links against External data)
//   - system-prompt-buried        (persona/instructions after large context blocks)
//   - examples-after-input        (few-shot examples placed below the user input)
//   - no-output-schema            (structured output requested with no schema segment)
//   - cache-hostile-ordering      (volatile content before stable content, defeats caching)
//   - context-window-overflow     (assembled tokens exceed Model.context_window)
//   - conflicting-instructions    (contradictory Constraint segments)
//   - deprecated-pattern          (patterns invalid for the target model family)
// TODO(rules): make the catalog loadable from an external file (JSON/TOML) so it
//   can be versioned independently and updated as provider guidance changes.
load_rules :: proc() -> []Rule {
	// TODO: implement
	return {}
}

// TODO(rules): stamp a stable revision string onto every report for reproducibility.
rules_version :: proc() -> string {
	// TODO: implement
	return "0.0.0-dev"
}

// ---------------------------------------------------------------------------
// 3. Detection — run rules against a chain
// ---------------------------------------------------------------------------

// A single rule's detector. Returns the findings it produced for this chain.
// TODO(detect): decide whether detectors are Odin procs (compiled, fast) or
//   data-driven predicates interpreted from the catalog. Leaning compiled procs
//   keyed by Rule.id for the first version.
Detector :: proc(chain: PromptChain, rule: Rule) -> []Finding

// TODO(detect): wire each catalog rule id to its Detector in this table.
detector_for :: proc(rule_id: string) -> (Detector, bool) {
	// TODO: implement
	return nil, false
}

// TODO(detect): run every applicable rule (respecting Rule.applies_to vs the
//   chain's model family) and collect findings.
// TODO(detect): dedupe overlapping findings and sort by severity, then location.
detect :: proc(chain: PromptChain, rules: []Rule) -> []Finding {
	// TODO: implement
	return {}
}

// ---------------------------------------------------------------------------
// 4. Fixes — propose concrete edits
// ---------------------------------------------------------------------------

// TODO(fix): for each finding, synthesize one or more Fix candidates and attach
//   them to Finding.fixes (best-first). Set confidence conservatively; anything
//   below the auto-apply threshold is suggest-only.
// TODO(fix): guarantee Reorder/Restructure fixes keep the chain semantically valid
//   (don't move InputData above the instructions that reference it, etc.).
suggest_fixes :: proc(chain: PromptChain, finding: ^Finding) {
	// TODO: implement
}

// TODO(fix): apply a single fix to a chain and return the rewritten chain.
//   Must be pure (no mutation of the input) so the UI can preview/diff.
// TODO(fix): re-run detection after applying to confirm the fix didn't introduce
//   a new finding (regression guard).
apply_fix :: proc(chain: PromptChain, location: Location, fix: Fix) -> (out: PromptChain, ok: bool) {
	// TODO: implement
	return {}, false
}

// ---------------------------------------------------------------------------
// 5. Scoring & reporting
// ---------------------------------------------------------------------------

// TODO(score): roll findings up into a Score. Weight by severity; compute per-
//   category subscores and the token_total / token_wasted estimates.
score_chain :: proc(chain: PromptChain, findings: []Finding) -> Score {
	// TODO: implement
	return {}
}

// TODO(report): assemble the final AuditReport (stamp audited_at, tool_version,
//   rules_version) and write a human-readable summary line.
// TODO(report): renderers — plain text for CLI, JSON for CI, and HTML for the
//   shareable report. Keep rendering separate from analysis.
build_report :: proc(chain: PromptChain, findings: []Finding, at: time.Time) -> AuditReport {
	// TODO: implement
	return {}
}

// Top-level convenience: ingest -> detect -> fix -> score -> report.
// TODO(api): this is the one call the CLI and library users hit. Keep the
//   intermediate steps public so power users can run stages independently.
audit :: proc(source: string, path: string) -> (report: AuditReport, ok: bool) {
	// TODO: implement (compose the procs above)
	return {}, false
}

// ---------------------------------------------------------------------------
// 6. CLI / integration (later)
// ---------------------------------------------------------------------------

// TODO(cli): `promptaudit <path>` -> print report; `--json` for CI; `--fix` to
//   write high-confidence fixes back to the source; exit non-zero when a finding
//   at or above a configurable severity threshold is present (CI gate).
// TODO(cli): `--rules <file>` to point at an external catalog revision.
// TODO(watch): optional watch mode that re-audits on file change for local dev.
// TODO(test): golden-file tests — a corpus of known-bad chains, each with the
//   findings it must produce. This is what keeps the rule catalog honest.

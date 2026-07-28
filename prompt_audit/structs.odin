package prompt_audit

// Core data structures for a prompt-chain auditing tool.
//
// The tool ingests a prompt chain (the sequence of messages / calls an app
// makes to an LLM), scores it against a catalog of context-engineering
// best-practice rules, flags anti-patterns, and emits suggested fixes.
//
// These are the in-memory representations the analyzer, rule engine, and
// report renderer all share.

import "core:time"

// ---------------------------------------------------------------------------
// Providers and models
// ---------------------------------------------------------------------------

Provider :: enum {
	Unknown,
	Anthropic,
	OpenAI,
	Google,
	Meta,
	Mistral,
	Other,
}

// A specific model an app targets. `id` is the raw provider identifier
// (e.g. "claude-fable-5", "gpt-4o"); the rest is metadata the rule engine
// uses to decide which best practices apply.
Model :: struct {
	provider:            Provider,
	id:                  string,
	family:              string, // e.g. "Claude 5", "GPT-4"
	context_window:      int,    // max input tokens the model accepts
	max_output_tokens:   int,
	supports_tools:      bool,
	supports_vision:     bool,
	supports_caching:    bool, // prompt/context caching available
	released:            time.Time,
}

// ---------------------------------------------------------------------------
// Prompt chain: the thing being audited
// ---------------------------------------------------------------------------

Role :: enum {
	System,
	Developer, // OpenAI-style developer role
	User,
	Assistant,
	Tool, // tool/function result fed back to the model
}

// The distinct pieces of context that can live inside a single message.
// A well-engineered prompt keeps these separated and clearly delimited;
// blurring them is a common anti-pattern the auditor looks for.
SegmentKind :: enum {
	Instruction,   // directives to the model
	Persona,       // role/voice definition
	Context,       // reference material, retrieved docs, memory
	Example,       // few-shot examples
	Constraint,    // rules, guardrails, output requirements
	InputData,     // the actual user-supplied payload
	OutputSchema,  // requested output format / schema
	Delimiter,     // structural markers (tags, fences, headers)
}

// Provenance matters for injection auditing: content that originated from an
// untrusted source but is presented to the model as if it were instruction
// is exactly the memory-heist failure mode.
TrustLevel :: enum {
	Trusted,   // authored by the app developer
	UserInput, // supplied by the end user
	Retrieved, // pulled from a datastore / RAG
	External,  // fetched from the open web / third parties (untrusted)
}

Segment :: struct {
	kind:        SegmentKind,
	trust:       TrustLevel,
	text:        string,
	token_count: int,
}

Message :: struct {
	role:        Role,
	segments:    []Segment,
	// Convenience aggregate; == sum of segment token_counts when segmented,
	// otherwise a direct count of an unstructured message body.
	token_count: int,
	cacheable:   bool, // marked for prompt caching by the app
}

// Description of a tool the model may call. Vague or under-specified tool
// definitions are their own class of anti-pattern.
ToolSpec :: struct {
	name:            string,
	description:     string,
	parameschema:    string, // JSON schema text
	follows_links:   bool,   // e.g. a fetch tool that chases discovered URLs
	has_side_effect: bool,   // mutates state / sends data outward
}

// A single call the app makes to a model: the assembled messages plus the
// tools exposed on that turn. A chain is an ordered list of these.
ChainStep :: struct {
	name:        string, // human label for the step
	model:       Model,
	messages:    []Message,
	tools:       []ToolSpec,
	temperature: f32,
	max_tokens:  int,
}

PromptChain :: struct {
	id:      string,
	name:    string,
	source:  string, // file path, repo, or app identifier
	steps:   []ChainStep,
}

// ---------------------------------------------------------------------------
// Best-practice rules and findings
// ---------------------------------------------------------------------------

Severity :: enum {
	Info,
	Low,
	Medium,
	High,
	Critical,
}

// Buckets a finding falls into. A single finding may span several categories,
// so this is used as a bit_set on the finding.
Category :: enum {
	Structure,        // ordering, delimiting, sectioning of context
	Injection,        // untrusted content treated as instruction
	TokenBudget,      // context-window / cost efficiency
	Caching,          // cache-friendliness of the prompt layout
	ToolUse,          // tool definition and invocation hygiene
	OutputFormatting, // schema / format specification
	FewShot,          // example quality and placement
	Deprecation,      // patterns invalid for the target model version
	Clarity,          // ambiguous or conflicting instructions
}

CategorySet :: bit_set[Category]

// A named anti-pattern the tool knows how to detect, drawn from current
// context-engineering guidance. Rules are data so the catalog can be
// updated as provider guidance changes (e.g. the Claude 5 rewrite).
Rule :: struct {
	id:             string, // stable slug, e.g. "untrusted-as-instruction"
	title:          string,
	description:    string,
	categories:     CategorySet,
	default_sever:  Severity,
	// Model families this rule applies to; empty means universal.
	applies_to:     []string,
	rationale_url:  string, // link to the guidance this rule encodes
}

// Where in the chain a finding lives. Indices of -1 mean "not applicable at
// this granularity" (e.g. a chain-level finding has step_index == -1).
Location :: struct {
	step_index:    int,
	message_index: int,
	segment_index: int,
	char_start:    int, // byte offset into the segment text, or -1
	char_end:      int,
}

// A concrete edit the tool proposes. `replacement` is the suggested text for
// the span in `Finding.location`; an empty replacement with kind Remove means
// "delete this span".
FixKind :: enum {
	Rewrite,   // replace the span with `replacement`
	Insert,    // add `replacement` at char_start
	Remove,    // delete the span
	Reorder,   // move the segment/message to `target_index`
	Restructure, // larger structural change described in `note`
}

Fix :: struct {
	kind:         FixKind,
	note:         string, // human-readable explanation of the change
	replacement:  string,
	target_index: int, // used by Reorder; -1 otherwise
	confidence:   f32, // 0..1, how safe the tool considers this auto-fix
}

// One detected issue: which rule fired, where, how bad, and how to fix it.
Finding :: struct {
	rule_id:    string,
	title:      string,
	detail:     string, // instance-specific description
	severity:   Severity,
	categories: CategorySet,
	location:   Location,
	fixes:      []Fix, // ordered best-first; may be empty (manual review)
}

// ---------------------------------------------------------------------------
// Audit result
// ---------------------------------------------------------------------------

// Aggregate scoring for a report. `score` is a 0..100 roll-up; the per-category
// map lets the UI show where a chain is strong or weak.
Score :: struct {
	overall:      int,
	by_category:  map[Category]int,
	token_total:  int,
	token_wasted: int, // tokens the auditor believes are dead weight
}

AuditReport :: struct {
	chain_id:      string,
	audited_at:    time.Time,
	tool_version:  string,
	rules_version: string, // catalog revision, for reproducibility
	findings:      []Finding,
	score:         Score,
	summary:       string,
}

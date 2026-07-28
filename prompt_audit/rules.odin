package prompt_audit

// The anti-pattern catalog and the id -> detector mapping.
//
// Rules are data so the set can grow without touching the engine; each id is
// wired to a compiled detector in detector_for (detectors live in detect.odin).
// When provider guidance changes, add/adjust a Rule here and bump RULES_VERSION.

RULES_VERSION :: "0.1.0"

rules_version :: proc() -> string {
	return RULES_VERSION
}

// A detector produces the findings for one rule against one chain.
Detector :: proc(chain: PromptChain, rule: Rule) -> []Finding

load_rules :: proc() -> []Rule {
	out: [dynamic]Rule

	append(&out, Rule {
		id             = "untrusted-as-instruction",
		title          = "Untrusted content used as instruction",
		description    = "External or retrieved content containing imperative language may be prompt injection; it must be framed as data, not commands.",
		categories     = {.Injection, .Clarity},
		default_sever  = .Critical,
		rationale_url  = "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering",
	})
	append(&out, Rule {
		id             = "tool-follows-untrusted-link",
		title          = "Tool follows links from fetched content",
		description    = "A fetch/browse tool that follows URLs discovered in a page lets a hostile page steer the agent.",
		categories     = {.Injection, .ToolUse},
		default_sever  = .High,
		rationale_url  = "https://www.ayush.digital/blog/the-memory-heist",
	})
	append(&out, Rule {
		id             = "system-prompt-buried",
		title          = "Instructions not leading the prompt",
		description    = "Persona and primary instructions should anchor the start of the prompt, not appear after context.",
		categories     = {.Structure},
		default_sever  = .Medium,
		rationale_url  = "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering",
	})
	append(&out, Rule {
		id             = "examples-after-input",
		title          = "Few-shot examples placed after the input",
		description    = "Examples should precede the user input so they condition the response.",
		categories     = {.FewShot, .Structure},
		default_sever  = .Low,
		rationale_url  = "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering",
	})
	append(&out, Rule {
		id             = "no-output-schema",
		title          = "Structured output requested without a schema",
		description    = "When the prompt asks for JSON/structured output, give an explicit schema or example so output is parseable.",
		categories     = {.OutputFormatting},
		default_sever  = .Medium,
		rationale_url  = "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering",
	})
	append(&out, Rule {
		id             = "cache-hostile-ordering",
		title          = "Stable context placed after volatile input",
		description    = "Volatile content before large stable content breaks the prompt-cache prefix and wastes tokens/latency.",
		categories     = {.Caching, .Structure, .TokenBudget},
		default_sever  = .Low,
		rationale_url  = "https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching",
	})
	append(&out, Rule {
		id             = "context-window-overflow",
		title          = "Assembled context exceeds the model window",
		description    = "The chain assembles more tokens than the target model can accept.",
		categories     = {.TokenBudget},
		default_sever  = .High,
		rationale_url  = "https://docs.anthropic.com/en/docs/about-claude/models",
	})
	append(&out, Rule {
		id             = "conflicting-instructions",
		title          = "Contradictory directives",
		description    = "The prompt both requires and forbids the same thing, leaving the model to guess.",
		categories     = {.Clarity},
		default_sever  = .Medium,
		rationale_url  = "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering",
	})
	append(&out, Rule {
		id             = "deprecated-pattern",
		title          = "Deprecated prompt pattern for the target model",
		description    = "Inline Human:/Assistant: turn markers are a legacy pattern; modern Claude models use structured message roles.",
		categories     = {.Deprecation, .Structure},
		default_sever  = .Medium,
		rationale_url  = "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering",
	})

	return out[:]
}

detector_for :: proc(rule_id: string) -> (Detector, bool) {
	switch rule_id {
	case "untrusted-as-instruction":
		return detect_untrusted_as_instruction, true
	case "tool-follows-untrusted-link":
		return detect_tool_follows_link, true
	case "system-prompt-buried":
		return detect_system_prompt_buried, true
	case "examples-after-input":
		return detect_examples_after_input, true
	case "no-output-schema":
		return detect_no_output_schema, true
	case "cache-hostile-ordering":
		return detect_cache_hostile, true
	case "context-window-overflow":
		return detect_context_overflow, true
	case "conflicting-instructions":
		return detect_conflicting, true
	case "deprecated-pattern":
		return detect_deprecated, true
	}
	return nil, false
}

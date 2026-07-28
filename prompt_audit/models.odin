package prompt_audit

// Model capability lookup. Maps a provider model-id string to the capability
// metadata the rule engine needs (context window, tool/vision/caching support,
// family). The family string drives version-specific rules — e.g. telling a
// "Claude 5" chain apart from a "Claude 4" one.

import "core:strings"

resolve_model :: proc(provider_id: string) -> Model {
	low := strings.to_lower(provider_id)
	switch {
	case strings.contains(low, "claude"):
		family := "Claude 4"
		if strings.contains(low, "fable") ||
		   strings.contains(low, "mythos") ||
		   strings.contains(low, "opus-5") ||
		   strings.contains(low, "sonnet-5") ||
		   strings.contains(low, "haiku-5") ||
		   strings.contains(low, "-5") {
			family = "Claude 5"
		}
		return Model {
			provider = .Anthropic,
			id = provider_id,
			family = family,
			context_window = 200_000,
			max_output_tokens = 8_192,
			supports_tools = true,
			supports_vision = true,
			supports_caching = true,
		}
	case strings.contains(low, "gpt") || strings.contains(low, "o1") || strings.contains(low, "o3"):
		return Model {
			provider = .OpenAI,
			id = provider_id,
			family = "GPT",
			context_window = 128_000,
			max_output_tokens = 16_384,
			supports_tools = true,
			supports_vision = true,
			supports_caching = false,
		}
	case strings.contains(low, "gemini"):
		return Model {
			provider = .Google,
			id = provider_id,
			family = "Gemini",
			context_window = 1_000_000,
			max_output_tokens = 8_192,
			supports_tools = true,
			supports_vision = true,
			supports_caching = true,
		}
	case:
		// Unknown model: conservative defaults. context_window == 0 disables
		// the overflow rule rather than firing it spuriously.
		return Model {
			provider = .Unknown,
			id = provider_id,
			family = "unknown",
			context_window = 0,
			max_output_tokens = 0,
		}
	}
}

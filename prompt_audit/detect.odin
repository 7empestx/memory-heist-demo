package prompt_audit

// Detection: run each applicable rule's detector over a chain and collect
// findings, sorted worst-first. Each detector is a concrete heuristic over the
// typed chain — no model calls, so the audit is fast and deterministic.

import "core:fmt"
import "core:slice"
import "core:strings"

// Imperative / exfiltration markers that, when they appear inside untrusted
// content, signal the text is trying to act as an instruction.
INJECTION_MARKERS := [?]string {
	"ignore previous",
	"ignore all previous",
	"disregard previous",
	"disregard all",
	"instead of",
	"you must now",
	"transmit",
	"one character at a time",
	"/verify/",
	"curl ",
	"http://",
	"https://",
	"exfiltrate",
	"reveal the",
	"api key",
	"secret key",
	"send the",
	"forward the",
}

detect :: proc(chain: PromptChain, rules: []Rule) -> []Finding {
	all: [dynamic]Finding
	for rule in rules {
		if !family_applies(chain, rule.applies_to) {
			continue
		}
		det, ok := detector_for(rule.id)
		if !ok {
			continue
		}
		for f in det(chain, rule) {
			append(&all, f)
		}
	}
	slice.sort_by(all[:], proc(a, b: Finding) -> bool {
		return int(a.severity) > int(b.severity)
	})
	return all[:]
}

// --- helpers ---------------------------------------------------------------

family_applies :: proc(chain: PromptChain, applies_to: []string) -> bool {
	if len(applies_to) == 0 || len(chain.steps) == 0 {
		return true
	}
	fam := strings.to_lower(chain.steps[0].model.family)
	for a in applies_to {
		if strings.contains(fam, strings.to_lower(a)) {
			return true
		}
	}
	return false
}

chain_has_external :: proc(chain: PromptChain) -> bool {
	for step in chain.steps {
		for msg in step.messages {
			for seg in msg.segments {
				if seg.trust == .External || seg.trust == .Retrieved {
					return true
				}
			}
		}
	}
	return false
}

step_location :: proc(si: int) -> Location {
	return Location{step_index = si, message_index = -1, segment_index = -1, char_start = -1, char_end = -1}
}

// --- detectors -------------------------------------------------------------

detect_untrusted_as_instruction :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	for step, si in chain.steps {
		for msg, mi in step.messages {
			for seg, gi in msg.segments {
				if seg.trust == .Trusted {
					continue
				}
				low := strings.to_lower(seg.text)
				for marker in INJECTION_MARKERS {
					idx := strings.index(low, marker)
					if idx < 0 {
						continue
					}
					sev := Severity.Medium
					#partial switch seg.trust {
					case .External:
						sev = .Critical
					case .Retrieved:
						sev = .High
					}
					append(&out, Finding {
						rule_id    = rule.id,
						title      = rule.title,
						detail     = fmt.aprintf("Untrusted (%v) content contains instruction-like text %q — treat it as data, never as commands.", seg.trust, marker),
						severity   = sev,
						categories = rule.categories,
						location   = Location{step_index = si, message_index = mi, segment_index = gi, char_start = idx, char_end = idx + len(marker)},
					})
					break // one finding per segment is enough
				}
			}
		}
	}
	return out[:]
}

detect_tool_follows_link :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	external := chain_has_external(chain)
	for step, si in chain.steps {
		for tool in step.tools {
			if !tool.follows_links {
				continue
			}
			sev := Severity.Medium
			if external {
				sev = .High
			}
			append(&out, Finding {
				rule_id    = rule.id,
				title      = rule.title,
				detail     = fmt.aprintf("Tool %q can follow links discovered in fetched content; a hostile page can redirect it. Restrict it to user-provided URLs.", tool.name),
				severity   = sev,
				categories = rule.categories,
				location   = step_location(si),
			})
		}
	}
	return out[:]
}

detect_system_prompt_buried :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	for step, si in chain.steps {
		first_instr := -1
		outer: for msg, mi in step.messages {
			for seg in msg.segments {
				if seg.kind == .Persona || seg.kind == .Instruction {
					first_instr = mi
					break outer
				}
			}
		}
		if first_instr > 0 {
			append(&out, Finding {
				rule_id    = rule.id,
				title      = rule.title,
				detail     = fmt.aprintf("Persona/instructions first appear in message %d; lead with them so they anchor the model.", first_instr),
				severity   = .Medium,
				categories = rule.categories,
				location   = Location{step_index = si, message_index = first_instr, segment_index = -1, char_start = -1, char_end = -1},
			})
		}
	}
	return out[:]
}

detect_examples_after_input :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	for step, si in chain.steps {
		input_at := -1
		for msg, mi in step.messages {
			for seg in msg.segments {
				if seg.kind == .InputData && input_at < 0 {
					input_at = mi
				}
				if seg.kind == .Example && input_at >= 0 && mi >= input_at {
					append(&out, Finding {
						rule_id    = rule.id,
						title      = rule.title,
						detail     = "Few-shot examples appear after the user input; move them above it so they condition the response.",
						severity   = .Low,
						categories = rule.categories,
						location   = Location{step_index = si, message_index = mi, segment_index = -1, char_start = -1, char_end = -1},
					})
				}
			}
		}
	}
	return out[:]
}

detect_no_output_schema :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	for step, si in chain.steps {
		mentions_format := false
		has_schema := false
		for msg in step.messages {
			for seg in msg.segments {
				if seg.kind == .OutputSchema {
					has_schema = true
				}
				if seg.trust != .Trusted {
					continue
				}
				low := strings.to_lower(seg.text)
				if strings.contains(low, "json") ||
				   strings.contains(low, "format your") ||
				   strings.contains(low, "respond with") ||
				   strings.contains(low, "return a") ||
				   strings.contains(low, "schema") {
					mentions_format = true
				}
			}
		}
		if mentions_format && !has_schema {
			append(&out, Finding {
				rule_id    = rule.id,
				title      = rule.title,
				detail     = "The prompt asks for structured output but includes no explicit schema or example; add one so the output is reliably parseable.",
				severity   = .Medium,
				categories = rule.categories,
				location   = step_location(si),
			})
		}
	}
	return out[:]
}

detect_cache_hostile :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	for step, si in chain.steps {
		if !step.model.supports_caching {
			continue
		}
		volatile_at := -1
		for msg, mi in step.messages {
			is_volatile := false
			for seg in msg.segments {
				if seg.trust == .UserInput || seg.trust == .External {
					is_volatile = true
				}
			}
			if is_volatile && volatile_at < 0 {
				volatile_at = mi
			}
			if volatile_at >= 0 && mi > volatile_at {
				for seg in msg.segments {
					if seg.trust == .Trusted && seg.token_count > 200 {
						append(&out, Finding {
							rule_id    = rule.id,
							title      = rule.title,
							detail     = fmt.aprintf("Stable content (~%d tokens) sits after volatile input; move it earlier to keep the cache prefix stable.", seg.token_count),
							severity   = .Low,
							categories = rule.categories,
							location   = Location{step_index = si, message_index = mi, segment_index = -1, char_start = -1, char_end = -1},
						})
					}
				}
			}
		}
	}
	return out[:]
}

detect_context_overflow :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	for step, si in chain.steps {
		if step.model.context_window <= 0 {
			continue
		}
		total := 0
		for msg in step.messages {
			total += msg.token_count
		}
		if total > step.model.context_window {
			append(&out, Finding {
				rule_id    = rule.id,
				title      = rule.title,
				detail     = fmt.aprintf("Assembled context is ~%d tokens, over the %d-token window for %s.", total, step.model.context_window, step.model.id),
				severity   = .High,
				categories = rule.categories,
				location   = step_location(si),
			})
		}
	}
	return out[:]
}

detect_conflicting :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	for step, si in chain.steps {
		always := make(map[string]bool)
		never := make(map[string]bool)
		for msg in step.messages {
			for seg in msg.segments {
				if seg.kind != .Instruction && seg.kind != .Constraint {
					continue
				}
				words := strings.fields(strings.to_lower(seg.text))
				for w, i in words {
					if i + 1 >= len(words) {
						continue
					}
					nxt := strings.trim(words[i + 1], ".,;:!?\"'()")
					if w == "always" {
						always[nxt] = true
					}
					if w == "never" {
						never[nxt] = true
					}
				}
			}
		}
		for k in always {
			if never[k] {
				append(&out, Finding {
					rule_id    = rule.id,
					title      = rule.title,
					detail     = fmt.aprintf("Conflicting directives: the prompt says both 'always %s' and 'never %s'.", k, k),
					severity   = .Medium,
					categories = rule.categories,
					location   = step_location(si),
				})
				break
			}
		}
	}
	return out[:]
}

detect_deprecated :: proc(chain: PromptChain, rule: Rule) -> []Finding {
	out: [dynamic]Finding
	markers := [?]string{"\n\nHuman:", "\n\nAssistant:", "\n\nSystem:"}
	for step, si in chain.steps {
		if step.model.provider != .Anthropic {
			continue
		}
		for msg, mi in step.messages {
			for seg, gi in msg.segments {
				for m in markers {
					idx := strings.index(seg.text, m)
					if idx < 0 {
						continue
					}
					append(&out, Finding {
						rule_id    = rule.id,
						title      = rule.title,
						detail     = "Legacy inline turn marker found; modern Claude models use structured message roles, not embedded Human:/Assistant: markers.",
						severity   = .Medium,
						categories = rule.categories,
						location   = Location{step_index = si, message_index = mi, segment_index = gi, char_start = idx, char_end = idx + len(m)},
					})
					break
				}
			}
		}
	}
	return out[:]
}

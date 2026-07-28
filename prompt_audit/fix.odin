package prompt_audit

// Fixes: attach suggested edits to a finding, and apply a single edit to a
// chain. apply_fix is pure — it clones the chain and mutates the copy — so the
// UI can preview a diff without disturbing the original.

import "core:strings"

suggest_fixes :: proc(chain: PromptChain, finding: ^Finding) {
	fixes: [dynamic]Fix
	switch finding.rule_id {
	case "untrusted-as-instruction":
		append(&fixes, Fix {
			kind         = .Restructure,
			note         = "Wrap this content in an explicit data block (e.g. <untrusted_data>…</untrusted_data>) and instruct the model to treat everything inside as data, never as commands.",
			confidence   = 0.4,
			target_index = -1,
		})
	case "tool-follows-untrusted-link":
		append(&fixes, Fix {
			kind         = .Restructure,
			note         = "Set follows_links=false; fetch only user-provided URLs and feed pages back as clearly-marked untrusted data.",
			confidence   = 0.6,
			target_index = -1,
		})
	case "examples-after-input":
		append(&fixes, Fix {
			kind         = .Reorder,
			note         = "Move the few-shot examples above the user input.",
			target_index = 0,
			confidence   = 0.7,
		})
	case "no-output-schema":
		append(&fixes, Fix {
			kind         = .Insert,
			note         = "Add an explicit output schema/example.",
			replacement  = "\n\n<output_format>\nReturn a single JSON object: { ... }\n</output_format>\n",
			target_index = -1,
			confidence   = 0.5,
		})
	case "cache-hostile-ordering":
		append(&fixes, Fix {
			kind         = .Reorder,
			note         = "Place stable system/context blocks first and volatile user input last to maximize prompt-cache hits.",
			target_index = 0,
			confidence   = 0.6,
		})
	case "context-window-overflow":
		append(&fixes, Fix {
			kind         = .Restructure,
			note         = "Trim or summarize context, or move reference material to retrieval, so the prompt fits the model's window.",
			target_index = -1,
			confidence   = 0.3,
		})
	case "system-prompt-buried":
		append(&fixes, Fix {
			kind         = .Reorder,
			note         = "Move the persona/instructions into the leading system message.",
			target_index = 0,
			confidence   = 0.5,
		})
	case "conflicting-instructions":
		append(&fixes, Fix {
			kind         = .Restructure,
			note         = "Reconcile the contradictory directives into a single, unambiguous rule.",
			target_index = -1,
			confidence   = 0.3,
		})
	case "deprecated-pattern":
		append(&fixes, Fix {
			kind         = .Remove,
			note         = "Remove the inline Human:/Assistant: marker and rely on structured message roles.",
			target_index = -1,
			confidence   = 0.8,
		})
	}
	finding.fixes = fixes[:]
}

// Apply one fix at `location`. Returns a modified clone. ok is false when the
// location is invalid or the fix kind can't be applied mechanically
// (Restructure changes are advisory and left to the caller).
apply_fix :: proc(chain: PromptChain, location: Location, fix: Fix) -> (out: PromptChain, ok: bool) {
	c := clone_chain(chain)
	if location.step_index < 0 || location.step_index >= len(c.steps) {
		return c, false
	}
	step := &c.steps[location.step_index]
	if location.message_index < 0 || location.message_index >= len(step.messages) {
		return c, false
	}
	msg := &step.messages[location.message_index]

	#partial switch fix.kind {
	case .Reorder:
		if location.segment_index < 0 || location.segment_index >= len(msg.segments) {
			return c, false
		}
		msg.segments = move_segment(msg.segments, location.segment_index, fix.target_index)
		return c, true
	case .Rewrite, .Insert, .Remove:
		if location.segment_index < 0 || location.segment_index >= len(msg.segments) {
			return c, false
		}
		seg := &msg.segments[location.segment_index]
		new_text, edited := edit_text(seg.text, location, fix)
		if !edited {
			return c, false
		}
		seg.text = new_text
		seg.token_count = estimate_tokens(new_text)
		recompute_message_tokens(msg)
		return c, true
	}
	return c, false
}

// --- internals -------------------------------------------------------------

edit_text :: proc(text: string, loc: Location, fix: Fix) -> (string, bool) {
	n := len(text)
	start := loc.char_start
	end := loc.char_end
	#partial switch fix.kind {
	case .Insert:
		if start < 0 || start > n {
			start = n // append at end when no anchor
		}
		return strings.concatenate({text[:start], fix.replacement, text[start:]}), true
	case .Rewrite:
		if start < 0 || end < start || end > n {
			return text, false
		}
		return strings.concatenate({text[:start], fix.replacement, text[end:]}), true
	case .Remove:
		if start < 0 || end < start || end > n {
			return text, false
		}
		return strings.concatenate({text[:start], text[end:]}), true
	}
	return text, false
}

move_segment :: proc(segs: []Segment, from: int, to: int) -> []Segment {
	item := segs[from]
	rest: [dynamic]Segment
	for s, i in segs {
		if i == from {
			continue
		}
		append(&rest, s)
	}
	t := to
	if t < 0 {
		t = 0
	}
	if t > len(rest) {
		t = len(rest)
	}
	res: [dynamic]Segment
	for s, i in rest {
		if i == t {
			append(&res, item)
		}
		append(&res, s)
	}
	if t >= len(rest) {
		append(&res, item)
	}
	return res[:]
}

recompute_message_tokens :: proc(msg: ^Message) {
	total := 0
	for s in msg.segments {
		total += s.token_count
	}
	msg.token_count = total
}

clone_chain :: proc(chain: PromptChain) -> PromptChain {
	steps: [dynamic]ChainStep
	for s in chain.steps {
		msgs: [dynamic]Message
		for m in s.messages {
			segs: [dynamic]Segment
			for g in m.segments {
				append(&segs, g)
			}
			nm := m
			nm.segments = segs[:]
			append(&msgs, nm)
		}
		tools: [dynamic]ToolSpec
		for t in s.tools {
			append(&tools, t)
		}
		ns := s
		ns.messages = msgs[:]
		ns.tools = tools[:]
		append(&steps, ns)
	}
	nc := chain
	nc.steps = steps[:]
	return nc
}

package prompt_audit

// Ingest: turn a source transcript into a PromptChain.
//
// The supported source format is a JSON transcript in Anthropic Messages shape
// (also close enough to OpenAI chat): a top-level object with "model",
// optional "system", a "messages" array, and optional "tools". Message content
// may be a plain string or an array of content blocks (text / tool_use /
// tool_result).
//
// Provenance is the signal the injection rules depend on, and a transcript
// rarely states it, so we infer a TrustLevel from role: system/assistant text
// is Trusted, user text is UserInput, and tool_result blocks are External —
// which is exactly the untrusted channel the memory-heist attack rides in on.
//
// Note: parsing prompt-assembly code (.py/.ts) into a chain is intentionally
// out of scope. It's fragile and off the core goal; callers that build a
// PromptChain programmatically get richer SegmentKind tagging than any
// transcript can provide, and every rule works the same on either.

import "core:encoding/json"
import "core:strings"

// Rough token estimate: ~4 characters per token. Good enough for budget and
// ordering heuristics; swap in a provider tokenizer later without touching
// callers.
estimate_tokens :: proc(text: string) -> int {
	t := strings.trim_space(text)
	if len(t) == 0 {
		return 0
	}
	n := len(t) / 4
	if n < 1 {
		n = 1
	}
	return n
}

parse_chain :: proc(source: string, path: string) -> (chain: PromptChain, ok: bool) {
	root, _ := json.parse(transmute([]u8)source)
	obj, is_obj := root.(json.Object)
	if !is_obj {
		return {}, false
	}

	model := resolve_model(get_string(obj, "model"))

	msgs: [dynamic]Message

	// Optional system prompt becomes a leading System message.
	if sv, has := obj["system"]; has {
		stext := extract_text(sv)
		if len(strings.trim_space(stext)) > 0 {
			seg := Segment {
				kind        = classify_system(stext),
				trust       = .Trusted,
				text        = stext,
				token_count = estimate_tokens(stext),
			}
			append(&msgs, Message{role = .System, segments = slice_one(seg), token_count = seg.token_count})
		}
	}

	if mv, has := obj["messages"]; has {
		if arr, arr_ok := mv.(json.Array); arr_ok {
			for item in arr {
				mo, mo_ok := item.(json.Object)
				if !mo_ok {
					continue
				}
				content, _ := mo["content"]
				if m, m_ok := build_message(get_string(mo, "role"), content); m_ok {
					append(&msgs, m)
				}
			}
		}
	}

	tools_val, _ := obj["tools"]
	step := ChainStep {
		name        = "step-1",
		model       = model,
		messages    = msgs[:],
		tools       = build_tools(tools_val),
		temperature = f32(get_number(obj, "temperature", 1.0)),
		max_tokens  = int(get_number(obj, "max_tokens", 0)),
	}

	steps: [dynamic]ChainStep
	append(&steps, step)

	chain = PromptChain {
		id     = "chain-1",
		name   = path,
		source = path,
		steps  = steps[:],
	}
	return chain, true
}

// --- content -> message ----------------------------------------------------

build_message :: proc(role_str: string, content: json.Value) -> (Message, bool) {
	normal := strings.builder_make()
	tool := strings.builder_make()
	has_tool := false

	#partial switch t in content {
	case string:
		strings.write_string(&normal, t)
	case json.Array:
		for blk in t {
			bo, bo_ok := blk.(json.Object)
			if !bo_ok {
				continue
			}
			switch get_string(bo, "type") {
			case "text":
				strings.write_string(&normal, get_string(bo, "text"))
			case "tool_result":
				has_tool = true
				if cv, cv_ok := bo["content"]; cv_ok {
					strings.write_string(&tool, extract_text(cv))
				}
			case "tool_use":
				// Record the tool name so the assistant turn isn't empty.
				strings.write_string(&normal, get_string(bo, "name"))
			}
		}
	}

	normal_text := strings.to_string(normal)
	tool_text := strings.to_string(tool)

	segs: [dynamic]Segment
	role: Role

	if has_tool {
		// A tool result is untrusted data flowing back into context.
		role = .Tool
		if len(strings.trim_space(tool_text)) > 0 {
			append(&segs, Segment{kind = .Context, trust = .External, text = tool_text, token_count = estimate_tokens(tool_text)})
		}
		if len(strings.trim_space(normal_text)) > 0 {
			append(&segs, Segment{kind = .InputData, trust = .UserInput, text = normal_text, token_count = estimate_tokens(normal_text)})
		}
	} else {
		if len(strings.trim_space(normal_text)) == 0 {
			return {}, false
		}
		role = map_role(role_str)
		kind, trust := classify_by_role(role, normal_text)
		append(&segs, Segment{kind = kind, trust = trust, text = normal_text, token_count = estimate_tokens(normal_text)})
	}

	if len(segs) == 0 {
		return {}, false
	}
	total := 0
	for s in segs {
		total += s.token_count
	}
	return Message{role = role, segments = segs[:], token_count = total}, true
}

build_tools :: proc(v: json.Value) -> []ToolSpec {
	arr, ok := v.(json.Array)
	if !ok {
		return {}
	}
	out: [dynamic]ToolSpec
	for item in arr {
		o, o_ok := item.(json.Object)
		if !o_ok {
			continue
		}
		name := get_string(o, "name")
		desc := get_string(o, "description")
		low := strings.to_lower(strings.concatenate({name, " ", desc}))
		follows := strings.contains(low, "fetch") ||
			strings.contains(low, "url") ||
			strings.contains(low, "http") ||
			strings.contains(low, "browse") ||
			strings.contains(low, "link") ||
			strings.contains(low, "web")
		side := strings.contains(low, "write") ||
			strings.contains(low, "send") ||
			strings.contains(low, "delete") ||
			strings.contains(low, "post") ||
			strings.contains(low, "email") ||
			strings.contains(low, "create") ||
			strings.contains(low, "update")
		append(&out, ToolSpec{name = name, description = desc, follows_links = follows, has_side_effect = side})
	}
	return out[:]
}

// --- inference helpers -----------------------------------------------------

classify_system :: proc(text: string) -> SegmentKind {
	low := strings.to_lower(text)
	if strings.contains(low, "you are") || strings.contains(low, "your role") || strings.contains(low, "persona") {
		return .Persona
	}
	return .Instruction
}

classify_by_role :: proc(role: Role, text: string) -> (SegmentKind, TrustLevel) {
	switch role {
	case .System:
		return classify_system(text), .Trusted
	case .Developer:
		return .Instruction, .Trusted
	case .Assistant:
		return .Context, .Trusted
	case .Tool:
		return .Context, .External
	case .User:
		return .InputData, .UserInput
	case:
		return .InputData, .UserInput
	}
}

map_role :: proc(r: string) -> Role {
	switch strings.to_lower(r) {
	case "system":
		return .System
	case "developer":
		return .Developer
	case "assistant":
		return .Assistant
	case "tool":
		return .Tool
	case:
		return .User
	}
}

// --- small JSON accessors --------------------------------------------------

get_string :: proc(o: json.Object, key: string) -> string {
	v, ok := o[key]
	if !ok {
		return ""
	}
	s, s_ok := v.(string)
	if !s_ok {
		return ""
	}
	return s
}

get_number :: proc(o: json.Object, key: string, def: f64) -> f64 {
	v, ok := o[key]
	if !ok {
		return def
	}
	#partial switch t in v {
	case f64:
		return t
	case i64:
		return f64(t)
	}
	return def
}

// Flatten a value that is either a string or an array of {"text": ...} blocks.
extract_text :: proc(v: json.Value) -> string {
	#partial switch t in v {
	case string:
		return t
	case json.Array:
		b := strings.builder_make()
		for blk in t {
			bo, bo_ok := blk.(json.Object)
			if !bo_ok {
				continue
			}
			strings.write_string(&b, get_string(bo, "text"))
		}
		return strings.to_string(b)
	}
	return ""
}

slice_one :: proc(s: Segment) -> []Segment {
	arr: [dynamic]Segment
	append(&arr, s)
	return arr[:]
}

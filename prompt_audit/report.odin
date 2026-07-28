package prompt_audit

// Scoring and reporting. score_chain rolls findings into a 0..100 score with
// per-category breakdown; build_report assembles the AuditReport; render_text
// renders it for the CLI. Rendering is kept separate from analysis so other
// front-ends (JSON, HTML) can reuse the same report.

import "core:fmt"
import "core:strings"
import "core:time"

severity_weight :: proc(s: Severity) -> int {
	switch s {
	case .Info:
		return 0
	case .Low:
		return 2
	case .Medium:
		return 5
	case .High:
		return 12
	case .Critical:
		return 25
	case:
		return 0
	}
}

located_tokens :: proc(chain: PromptChain, loc: Location) -> int {
	if loc.step_index < 0 || loc.step_index >= len(chain.steps) {
		return 0
	}
	st := chain.steps[loc.step_index]
	if loc.message_index < 0 || loc.message_index >= len(st.messages) {
		return 0
	}
	m := st.messages[loc.message_index]
	if loc.segment_index < 0 || loc.segment_index >= len(m.segments) {
		return m.token_count
	}
	return m.segments[loc.segment_index].token_count
}

score_chain :: proc(chain: PromptChain, findings: []Finding) -> Score {
	by := make(map[Category]int)
	for cat in Category {
		by[cat] = 100
	}

	total_penalty := 0
	for f in findings {
		w := severity_weight(f.severity)
		total_penalty += w
		for cat in Category {
			if cat in f.categories {
				v := by[cat] - w
				if v < 0 {
					v = 0
				}
				by[cat] = v
			}
		}
	}

	overall := 100 - total_penalty
	if overall < 0 {
		overall = 0
	}

	token_total := 0
	for s in chain.steps {
		for m in s.messages {
			token_total += m.token_count
		}
	}

	wasted := 0
	for f in findings {
		if .TokenBudget in f.categories {
			wasted += located_tokens(chain, f.location)
		}
	}

	return Score{overall = overall, by_category = by, token_total = token_total, token_wasted = wasted}
}

build_report :: proc(chain: PromptChain, findings: []Finding, at: time.Time) -> AuditReport {
	score := score_chain(chain, findings)
	summary := fmt.aprintf("%d finding(s); overall score %d/100.", len(findings), score.overall)
	return AuditReport {
		chain_id      = chain.id,
		audited_at    = at,
		tool_version  = TOOL_VERSION,
		rules_version = rules_version(),
		findings      = findings,
		score         = score,
		summary       = summary,
	}
}

render_text :: proc(report: AuditReport) -> string {
	b := strings.builder_make()
	fmt.sbprintf(&b, "Prompt audit — %s\n", report.chain_id)
	fmt.sbprintf(&b, "rules %s | %s\n", report.rules_version, report.summary)
	fmt.sbprintf(&b, "overall %d/100   (%d tokens, ~%d wasted)\n\n", report.score.overall, report.score.token_total, report.score.token_wasted)

	if len(report.findings) == 0 {
		fmt.sbprintf(&b, "No findings.\n")
		return strings.to_string(b)
	}

	for f, i in report.findings {
		fmt.sbprintf(&b, "%d. [%v] %s\n", i + 1, f.severity, f.title)
		fmt.sbprintf(&b, "   at: step %d, msg %d, seg %d\n", f.location.step_index, f.location.message_index, f.location.segment_index)
		fmt.sbprintf(&b, "   %s\n", f.detail)
		for fix in f.fixes {
			fmt.sbprintf(&b, "   fix [%v, conf %.2f]: %s\n", fix.kind, fix.confidence, fix.note)
		}
		fmt.sbprintf(&b, "\n")
	}
	return strings.to_string(b)
}

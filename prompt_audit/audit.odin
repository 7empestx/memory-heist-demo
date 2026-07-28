package prompt_audit

// Top-level pipeline for the prompt-audit tool and its CLI entry point.
//
// audit() composes the phases implemented across this package:
//   ingest (ingest.odin) -> rules (rules.odin) -> detect (detect.odin)
//   -> fixes (fix.odin) -> score & report (report.odin)
//
// The CLI reads a JSON transcript, prints a human-readable report, and exits
// non-zero when a High/Critical finding is present so it can gate CI.

import "core:fmt"
import "core:os"
import "core:time"

TOOL_VERSION :: "0.1.0"

// Ingest a chain from `source`, run the full audit, and return the report.
// `path` is recorded on the chain for provenance. ok is false when the source
// can't be parsed into a chain.
audit :: proc(source: string, path: string) -> (report: AuditReport, ok: bool) {
	chain, parsed := parse_chain(source, path)
	if !parsed {
		return {}, false
	}
	rules := load_rules()
	findings := detect(chain, rules)
	for i in 0 ..< len(findings) {
		suggest_fixes(chain, &findings[i])
	}
	report = build_report(chain, findings, time.now())
	return report, true
}

main :: proc() {
	if len(os.args) < 2 {
		fmt.eprintln("usage: prompt_audit <transcript.json>")
		os.exit(2)
	}
	path := os.args[1]
	data, read_err := os.read_entire_file(path, context.allocator)
	if read_err != os.ERROR_NONE {
		fmt.eprintf("error: cannot read %s\n", path)
		os.exit(2)
	}
	report, ok := audit(string(data), path)
	if !ok {
		fmt.eprintln("error: could not parse chain (expected a JSON transcript)")
		os.exit(2)
	}
	fmt.print(render_text(report))

	// CI gate: non-zero exit if anything High or worse survived.
	worst := 0
	for f in report.findings {
		if int(f.severity) > worst {
			worst = int(f.severity)
		}
	}
	if worst >= int(Severity.High) {
		os.exit(1)
	}
	os.exit(0)
}

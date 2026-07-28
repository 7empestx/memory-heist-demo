/**
 * The DeckGrader consulting rubric.
 *
 * This encodes real consulting deck doctrine — Minto Pyramid Principle,
 * action titles, one-idea-per-slide, MECE structure, so-what framing,
 * horizontal logic. It is serialized into the Bedrock system prompt and
 * used to render the report, so anchor text must be concrete and
 * discriminating: the anchors ARE the scoring function.
 */

export interface ScoringAnchors {
  /** What a 1/5 looks like — concrete failure modes, not adjectives. */
  poor: string;
  /** What a 3/5 looks like — the honest median corporate deck. */
  average: string;
  /** What a 5/5 looks like — McKinsey/BCG/Bain partner-review tier. */
  excellent: string;
}

export interface RubricCriterion {
  id: string;
  category: RubricCategoryName;
  description: string;
  /** Weight of this criterion within its category (criterion weights per category sum to 1). */
  weight: number;
  anchors: ScoringAnchors;
}

export type RubricCategoryName =
  | 'Storyline & Structure'
  | 'Action Titles & So-What'
  | 'Evidence & Data Integrity'
  | 'Visual Hierarchy & Slide Craft'
  | 'Audience & Recommendation Fit';

export interface RubricCategory {
  name: RubricCategoryName;
  /** Category weight in the overall score (all category weights sum to 1). */
  weight: number;
  intent: string;
  criteria: RubricCriterion[];
}

export const RUBRIC: RubricCategory[] = [
  {
    name: 'Storyline & Structure',
    weight: 0.3,
    intent:
      'The deck is an argument, not a pile of information. Read the titles top to bottom: they must form a complete, ordered, non-overlapping case that leads to the recommendation.',
    criteria: [
      {
        id: 'horizontal-logic',
        category: 'Storyline & Structure',
        description:
          'Horizontal logic: reading ONLY the slide titles in order tells a complete, coherent story with no gaps or non sequiturs.',
        weight: 0.35,
        anchors: {
          poor:
            'Titles read as a table of contents ("Overview", "Data", "Analysis", "Findings"). Reading them in order conveys no argument at all — you cannot tell what the deck concludes without opening every slide.',
          average:
            'Some titles carry claims but the thread breaks: adjacent titles do not build on each other, one or two slides appear out of order, or the reader must infer the connective logic ("why does this slide follow that one?").',
          excellent:
            'The titles alone read as an executive summary: each title is a claim, each claim follows from the previous one, and the final title states the recommendation. A partner could skim titles in 30 seconds and reconstruct the whole argument.',
        },
      },
      {
        id: 'pyramid-principle',
        category: 'Storyline & Structure',
        description:
          'Pyramid principle: the answer/recommendation leads; supporting arguments come beneath it; raw data comes last. The deck does not build suspense toward a conclusion.',
        weight: 0.25,
        anchors: {
          poor:
            'Mystery-novel structure: methodology and data first, conclusion revealed on the last slide (or never stated). The reader must sit through the whole deck to learn what is being claimed.',
          average:
            'The answer appears early but gets buried mid-deck under detail, or an executive summary exists but the body re-argues from scratch rather than supporting the summary top-down.',
          excellent:
            'Slide 1-2 states the governing thought (the answer). Each subsequent section header is a supporting argument for it; data slides exist only to support a stated argument. Nothing appears that does not serve the pyramid.',
        },
      },
      {
        id: 'mece-grouping',
        category: 'Storyline & Structure',
        description:
          'MECE grouping: supporting arguments are mutually exclusive (no two slides make the same point) and collectively exhaustive (no obvious missing branch a skeptical executive would ask about).',
        weight: 0.2,
        anchors: {
          poor:
            'Arguments overlap heavily (two slides restate the same point with different data) AND obvious branches are missing (a cost case with no revenue impact, a churn analysis with no retention lever). Grouping looks like "whatever data we had".',
          average:
            'Groupings are mostly distinct but at mixed altitude (one branch is a strategy, its sibling is a tactic), or one clearly relevant branch is missing and never acknowledged.',
          excellent:
            'Arguments partition the problem cleanly at one consistent altitude. A skeptic looking for the "what about X?" gap does not find one — or the deck explicitly scopes X out.',
        },
      },
      {
        id: 'narrative-arc',
        category: 'Storyline & Structure',
        description:
          'Narrative arc: a recognizable situation → complication → resolution (or equivalent: what changed, why it matters, what to do) frames the deck.',
        weight: 0.2,
        anchors: {
          poor:
            'No arc: the deck opens into content with no situation established and no tension identified. It is a status report or data dump, not a story with stakes.',
          average:
            'Situation and complication are present but thin or implicit — the reader can reconstruct why this deck exists but the deck never says so crisply, or the resolution arrives without the complication being sharp enough to motivate it.',
          excellent:
            'Within the first two slides the reader knows the stable situation, the specific complication that makes action urgent, and the question the deck resolves. The rest of the deck resolves exactly that question.',
        },
      },
    ],
  },
  {
    name: 'Action Titles & So-What',
    weight: 0.25,
    intent:
      'Every slide earns its place by asserting something. Titles are full-sentence claims; the body proves the title; each slide carries exactly one idea.',
    criteria: [
      {
        id: 'action-titles',
        category: 'Action Titles & So-What',
        description:
          'Every title is a full-sentence claim ("Churn is concentrated in month-2 SMB cohorts"), not a topic label ("Churn Analysis") and not a fragment.',
        weight: 0.4,
        anchors: {
          poor:
            'Majority of titles are noun labels ("Overview", "Market Data", "Q3 Results") or missing entirely. No title makes a falsifiable claim.',
          average:
            'A mix: some genuine claims, but several labels or weak half-claims ("Churn is a challenge") remain, or claims are so hedged ("Various factors may affect churn") they assert nothing.',
          excellent:
            'Every content slide title is a specific, falsifiable, quantified-where-possible claim that the slide body then proves. Titles average under ~15 words and could stand alone as sentences in a memo.',
        },
      },
      {
        id: 'so-what',
        category: 'Action Titles & So-What',
        description:
          'So-what framing: each slide delivers an insight with implications for the decision — not just information. "Revenue grew 12%" is information; "Revenue growth is masking a mix shift toward unprofitable accounts" is a so-what.',
        weight: 0.35,
        anchors: {
          poor:
            'Slides describe ("here is the data on X") without ever interpreting. The reader is left to compute the implication themselves on every slide.',
          average:
            'Insights exist but stop one step short of the decision — the slide says what the data shows but not what it means for the recommendation, or the so-what is stated in the notes/body instead of the title.',
          excellent:
            'Every slide answers "so what?" at the title level, and the so-what connects to the deck\'s governing recommendation. A reader can ask "why do I care?" of any slide and the slide has already answered.',
        },
      },
      {
        id: 'one-idea-per-slide',
        category: 'Action Titles & So-What',
        description:
          'One idea per slide: a slide makes exactly one point. Flag slides carrying two or more competing messages (e.g., a title claiming A while half the body argues B).',
        weight: 0.25,
        anchors: {
          poor:
            'Slides routinely carry 2-3 unrelated messages — "kitchen sink" slides where a churn claim, a pricing observation, and an org note share one page. Titles cannot summarize their own body.',
          average:
            'Most slides are single-idea but a few overloaded slides remain, or slides carry one headline idea plus body content that belongs to a different point.',
          excellent:
            'Every slide makes exactly one point, all body content on the slide supports that point, and anything tangential has been pushed to appendix or cut.',
        },
      },
    ],
  },
  {
    name: 'Evidence & Data Integrity',
    weight: 0.2,
    intent:
      'Claims are only as good as their support. Every assertion is backed by data on the slide or an explicit source; numbers replace adjectives; charts match the logical claim being made.',
    criteria: [
      {
        id: 'claims-supported',
        category: 'Evidence & Data Integrity',
        description:
          'Every claim is supported by data shown on the slide or explicitly sourced ("Source: billing cohort export, June 30"). No unsupported assertions presented as fact.',
        weight: 0.4,
        anchors: {
          poor:
            'Titles and bullets assert facts with no supporting numbers anywhere on the slide and no sources cited in the deck at all.',
          average:
            'Key claims have support but secondary claims float free, or data appears without sourcing so the reader cannot judge its credibility, or support exists in the deck but on a different slide from the claim it backs.',
          excellent:
            'Each claim is proven on the same slide that makes it, with sources or footnotes for external data. The evidence is sufficient: a skeptic could check the claim from what is shown.',
        },
      },
      {
        id: 'chart-claim-fit',
        category: 'Evidence & Data Integrity',
        description:
          'Charts match the claim: comparison claims get bar charts, trend claims get lines, composition claims get stacked/waterfall — and the chart headline matches the slide title. (Judge from shape counts and claims when chart internals are not available.)',
        weight: 0.3,
        anchors: {
          poor:
            'Claims about trends, comparisons, or composition are made with no chart or table at all where one is clearly needed — or slides carry charts that the text never references (chart as decoration).',
          average:
            'Charts exist where needed but the pairing is loose: a slide claims a trend while its evidence reads as a snapshot, or one chart is asked to prove two different claims.',
          excellent:
            'Every quantitative claim is paired with exactly the evidence that proves it, and every chart/table on a slide is load-bearing for that slide\'s single idea.',
        },
      },
      {
        id: 'no-vague-quantifiers',
        category: 'Evidence & Data Integrity',
        description:
          'No vague quantifiers ("significant", "many", "substantial", "a number of") where a number should be. Precision signals rigor.',
        weight: 0.3,
        anchors: {
          poor:
            'The deck leans on "significant", "many", "various", "substantial" throughout; almost no specific figures, percentages, or counts appear in claims.',
          average:
            'Headline numbers are specific but supporting text still hedges with vague quantifiers, or numbers appear without baselines ("grew 12%" — from what, over what period?).',
          excellent:
            'Claims are quantified with baseline and period ("churn rose from 2.3% to 4.1% monthly between Q4 and Q2"). Vague quantifiers appear only where genuine uncertainty is being flagged as such.',
        },
      },
    ],
  },
  {
    name: 'Visual Hierarchy & Slide Craft',
    weight: 0.15,
    intent:
      'A slide must be scannable in under 10 seconds: clear reading order, restrained text volume, consistent typography. Use the parser signals (word counts, bullet depth, font counts, missing titles).',
    criteria: [
      {
        id: 'scannability',
        category: 'Visual Hierarchy & Slide Craft',
        description:
          'Scannable in <10 seconds: clear reading order, whitespace, and a ≤~100 words per slide guideline. Flag walls of text.',
        weight: 0.4,
        anchors: {
          poor:
            'Multiple slides exceed ~150 words — paragraphs where bullets should be, walls of text that must be read line-by-line. Average words per slide well above 100.',
          average:
            'Most slides are scannable but 1-3 dense slides break the flow, or slides stay under the word budget by cramming many short fragments with no visual grouping.',
          excellent:
            'Every slide lands its point in a glance: ≤~100 words, evidence visually grouped under the claim, whitespace doing real work. Detail lives in appendix or notes.',
        },
      },
      {
        id: 'typographic-consistency',
        category: 'Visual Hierarchy & Slide Craft',
        description:
          'Consistent typography: ≤2 font families deck-wide, a consistent size hierarchy, aligned elements, bullet depth ≤2 levels.',
        weight: 0.35,
        anchors: {
          poor:
            '3+ font families, erratic size jumps between similar elements, and bullets nested 3-4+ levels deep — sub-sub-sub-bullets signal unstructured thinking, not detail.',
          average:
            'Fonts are consistent but sizes drift slide to slide, or bullet depth hits 3 on several slides, or one imported slide visibly breaks the template.',
          excellent:
            '≤2 font families, a stable size hierarchy (title/body/footnote), bullet depth ≤2 everywhere. The formatting is invisible — nothing about the type draws attention.',
        },
      },
      {
        id: 'structural-hygiene',
        category: 'Visual Hierarchy & Slide Craft',
        description:
          'Structural hygiene: every slide has a title placeholder in use; no orphan text boxes floating outside the layout; shape usage is intentional.',
        weight: 0.25,
        anchors: {
          poor:
            'Several slides are missing titles entirely, and slides carry stray text boxes (labels, leftovers) disconnected from the content structure.',
          average:
            'Titles are present but one or two slides skip them (often dividers), or occasional extra text boxes suggest content pasted rather than placed.',
          excellent:
            'Every slide uses its title placeholder for the action title; body content sits in structured placeholders; no orphan shapes. The file structure matches the visual structure.',
        },
      },
    ],
  },
  {
    name: 'Audience & Recommendation Fit',
    weight: 0.1,
    intent:
      'The deck knows who it is for and what decision it drives. It front-loads the headline for executives, ends with explicit asks, and pushes detail to appendix.',
    criteria: [
      {
        id: 'decision-orientation',
        category: 'Audience & Recommendation Fit',
        description:
          'The deck states (or clearly implies) who it is for and what decision it is meant to drive.',
        weight: 0.35,
        anchors: {
          poor:
            'No identifiable audience or decision: the deck could be for anyone and asks for nothing. A reader finishing it would not know what they are supposed to do.',
          average:
            'The decision is inferable from the content but never stated as an ask — the deck argues a position without naming the decision-maker, the options, or the deadline.',
          excellent:
            'The deck names its audience and decision up front ("Prepared for the exec committee — decision requested on option A"), and every slide is pitched at that audience\'s altitude.',
        },
      },
      {
        id: 'explicit-next-steps',
        category: 'Audience & Recommendation Fit',
        description:
          'The deck ends with explicit recommendations / next steps — owners, actions, dates — not a "Thank You" or "Questions?" slide.',
        weight: 0.35,
        anchors: {
          poor:
            'The deck ends on "Thank You", "Questions?", or a data slide. No recommendation slide exists anywhere.',
          average:
            'A recommendation slide exists but next steps are vague ("align on approach", "continue monitoring") with no owners or dates.',
          excellent:
            'The final content slide is a recommendation with concrete next steps: who does what by when, and the specific approval being requested.',
        },
      },
      {
        id: 'executive-altitude',
        category: 'Audience & Recommendation Fit',
        description:
          'Executive-appropriate altitude: headline messages up front, supporting detail pushed to appendix or notes; the main flow never bogs down in methodology.',
        weight: 0.3,
        anchors: {
          poor:
            'Methodology, raw data tables, and operational detail sit in the main flow at equal weight with conclusions. The deck reads bottom-up: detail first, meaning maybe.',
          average:
            'Headlines lead but the main flow still carries slides that only a working-team member needs; no appendix separation exists.',
          excellent:
            'The main flow is headline-only and survives a 5-minute read; everything a skeptic might drill into is present but parked in appendix and referenced from the claims it supports.',
        },
      },
    ],
  },
];

/** Human-readable weights, e.g. for rendering "Storyline & Structure — 30%". */
export const CATEGORY_WEIGHTS: ReadonlyArray<{ name: RubricCategoryName; percent: number }> =
  RUBRIC.map((c) => ({ name: c.name, percent: Math.round(c.weight * 100) }));

/**
 * Serialize the rubric for the model's system prompt. Anchors are included
 * verbatim — they are the scoring function.
 */
export function serializeRubricForPrompt(): string {
  const lines: string[] = [];
  for (const category of RUBRIC) {
    lines.push(`## ${category.name} — weight ${Math.round(category.weight * 100)}% of overall score`);
    lines.push(`Intent: ${category.intent}`);
    for (const criterion of category.criteria) {
      lines.push('');
      lines.push(
        `### Criterion "${criterion.id}" (${Math.round(criterion.weight * 100)}% of category)`,
      );
      lines.push(criterion.description);
      lines.push(`- Score 1 (poor): ${criterion.anchors.poor}`);
      lines.push(`- Score 3 (average): ${criterion.anchors.average}`);
      lines.push(`- Score 5 (excellent): ${criterion.anchors.excellent}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

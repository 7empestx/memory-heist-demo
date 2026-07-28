export interface CategoryScore {
  category: string;
  score: number;
  summary: string;
}

export interface SlideFeedback {
  slideIndex: number;
  issues: string[];
  rewrittenTitle: string | null;
  fix: string;
}

export interface GradeReport {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categoryScores: CategoryScore[];
  topStrengths: string[];
  criticalIssues: string[];
  slideFeedback: SlideFeedback[];
  storylineRewrite: string[];
}

export interface DeckStats {
  totalWordCount: number;
  avgWordsPerSlide: number;
  distinctFontsCount: number;
  slidesMissingTitles: number;
}

export interface GradeResponse {
  gradeId: string;
  deckStats: DeckStats;
  slideCount: number;
  report: GradeReport;
}

export const CATEGORY_WEIGHTS: Record<string, number> = {
  'Storyline & Structure': 30,
  'Action Titles & So-What': 25,
  'Evidence & Data Integrity': 20,
  'Visual Hierarchy & Slide Craft': 15,
  'Audience & Recommendation Fit': 10,
};

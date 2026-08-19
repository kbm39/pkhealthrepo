// Pure classification helpers, kept separate from any page so they can be
// exercised directly. Thresholds: AHA (blood pressure), ADA (glucose).
// These are informational category labels only, not a diagnosis.

export type BpCategory =
  | 'normal'
  | 'elevated'
  | 'stage_1'
  | 'stage_2'
  | 'crisis'

export const BP_CATEGORY_LABEL: Record<BpCategory, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  stage_1: 'Hypertension Stage 1',
  stage_2: 'Hypertension Stage 2',
  crisis: 'Hypertensive Crisis',
}

/** AHA blood pressure categories — the higher of systolic/diastolic wins. */
export function classifyBloodPressure(systolic: number, diastolic: number): BpCategory {
  if (systolic > 180 || diastolic > 120) return 'crisis'
  if (systolic >= 140 || diastolic >= 90) return 'stage_2'
  if (systolic >= 130 || diastolic >= 80) return 'stage_1'
  if (systolic >= 120) return 'elevated'
  return 'normal'
}

export type GlucoseCategory = 'normal' | 'prediabetes_range' | 'diabetes_range'

export const GLUCOSE_CATEGORY_LABEL: Record<GlucoseCategory, string> = {
  normal: 'Normal',
  prediabetes_range: 'Prediabetes range',
  diabetes_range: 'Diabetes range',
}

/** ADA glucose thresholds — differ for a fasting vs. random (non-fasting) reading. */
export function classifyGlucose(
  mgDl: number,
  context: 'fasting' | 'random' | null | undefined
): GlucoseCategory {
  if (context === 'fasting') {
    if (mgDl >= 126) return 'diabetes_range'
    if (mgDl >= 100) return 'prediabetes_range'
    return 'normal'
  }
  // Default to random/non-fasting thresholds when context is unknown.
  if (mgDl >= 200) return 'diabetes_range'
  if (mgDl >= 140) return 'prediabetes_range'
  return 'normal'
}

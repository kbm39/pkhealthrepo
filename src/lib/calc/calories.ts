// ============================================================
// Calorie & goal-weight calculations
// Honesty principle: never silently show an unsafe or overconfident
// number. Cap deficits at a safe floor and always return a note
// explaining when/why a number was adjusted.
// ============================================================

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

// Generally-cited safe minimums for sustained daily intake.
const SAFE_MIN_CALORIES = { male: 1500, female: 1200 } as const

const LBS_PER_KG = 2.20462
const IN_PER_CM = 0.393701
const CALORIES_PER_LB = 3500

export interface ProfileInput {
  sex: 'male' | 'female'
  age: number
  heightIn: number
  weightLbs: number
  activityLevel: ActivityLevel
}

/** Mifflin-St Jeor BMR, in calories/day. */
export function calculateBMR({ sex, age, heightIn, weightLbs }: ProfileInput): number {
  const weightKg = weightLbs / LBS_PER_KG
  const heightCm = heightIn / IN_PER_CM
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

/** Total Daily Energy Expenditure, in calories/day. */
export function calculateTDEE(profile: ProfileInput): number {
  return calculateBMR(profile) * ACTIVITY_MULTIPLIERS[profile.activityLevel]
}

export interface DailyTargetResult {
  tdee: number
  requestedDeficit: number
  appliedDeficit: number
  dailyTarget: number
  wasCapped: boolean
  note: string | null
}

/**
 * Computes a daily calorie target for a given weekly rate of loss/gain,
 * enforcing a safe minimum floor rather than blindly honoring an
 * aggressive request.
 *
 * @param weeklyRateLbs positive = loss, negative = gain
 */
export function calculateDailyTarget(
  profile: ProfileInput,
  weeklyRateLbs: number
): DailyTargetResult {
  const tdee = calculateTDEE(profile)
  const requestedDeficit = (weeklyRateLbs * CALORIES_PER_LB) / 7
  const rawTarget = tdee - requestedDeficit
  const floor = SAFE_MIN_CALORIES[profile.sex]

  if (weeklyRateLbs > 0 && rawTarget < floor) {
    const appliedDeficit = tdee - floor
    return {
      tdee,
      requestedDeficit,
      appliedDeficit,
      dailyTarget: floor,
      wasCapped: true,
      note: `Your requested rate would require going below a safe daily minimum (~${floor} cal), so the deficit has been capped. Your timeline below reflects this adjusted, safer rate.`,
    }
  }

  return {
    tdee,
    requestedDeficit,
    appliedDeficit: requestedDeficit,
    dailyTarget: Math.round(rawTarget),
    wasCapped: false,
    note: null,
  }
}

export interface GoalProjection {
  poundsToLose: number
  projectedDays: number | null
  projectedDate: string | null
  basis: 'theoretical_target' | 'actual_logged_average'
  note: string
}

/**
 * Projects days-to-goal. Prefers the user's real logged average
 * calorie deficit over the last N days if available (more honest
 * than assuming perfect adherence to a plan), falling back to the
 * theoretical target only when there isn't enough logged history yet.
 */
export function projectDaysToGoal(
  currentWeightLbs: number,
  goalWeightLbs: number,
  dailyTargetResult: DailyTargetResult,
  actualAvgDailyDeficit?: number,
  loggedDaysCount?: number
): GoalProjection {
  const poundsToLose = currentWeightLbs - goalWeightLbs

  if (poundsToLose <= 0) {
    return {
      poundsToLose,
      projectedDays: 0,
      projectedDate: new Date().toISOString().split('T')[0],
      basis: 'theoretical_target',
      note: 'You have already reached or passed your goal weight.',
    }
  }

  const MIN_DAYS_FOR_REAL_DATA = 7
  const useActual =
    actualAvgDailyDeficit !== undefined &&
    loggedDaysCount !== undefined &&
    loggedDaysCount >= MIN_DAYS_FOR_REAL_DATA

  const effectiveDeficit = useActual
    ? actualAvgDailyDeficit!
    : dailyTargetResult.appliedDeficit

  if (effectiveDeficit <= 0) {
    return {
      poundsToLose,
      projectedDays: null,
      projectedDate: null,
      basis: useActual ? 'actual_logged_average' : 'theoretical_target',
      note: useActual
        ? "Your logged intake over the recent period hasn't shown a calorie deficit, so no reliable timeline can be projected yet. Focus on consistent logging before trusting a projection."
        : 'No deficit is set, so no timeline can be projected.',
    }
  }

  const projectedDays = Math.ceil(
    (poundsToLose * CALORIES_PER_LB) / effectiveDeficit
  )
  const projectedDate = new Date(
    Date.now() + projectedDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split('T')[0]

  return {
    poundsToLose,
    projectedDays,
    projectedDate,
    basis: useActual ? 'actual_logged_average' : 'theoretical_target',
    note: useActual
      ? `Based on your actual logged average over the last ${loggedDaysCount} days, not just the plan target. This will keep updating as you log more.`
      : `Based on your calorie target, not real logged data yet — log at least ${MIN_DAYS_FOR_REAL_DATA} days for a more honest, adherence-based projection.`,
  }
}

export type StudentProfile = {
  id: string
  userId: string
  displayName: string
  handle: string | null
  bio: string | null
  avatarUrl: string | null
  currentFocus: string | null
  interests: string[]
  grade: number | null
  schoolName: string | null
  isFirstGen: boolean
  isHomeschooled: boolean
  isInternational: boolean
  onboardingComplete: boolean
}

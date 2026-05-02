export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f11] text-gray-900 dark:text-[#e8e8ec]">
      {children}
    </div>
  );
}

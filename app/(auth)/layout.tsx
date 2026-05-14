export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
      {children}
    </div>
  )
}

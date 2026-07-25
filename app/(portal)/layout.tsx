import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PortalShell from '@/components/portal/PortalShell'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <PortalShell>{children}</PortalShell>
}

import { NextRequest, NextResponse } from 'next/server'
import { provisionClient } from '@/lib/onboard-client'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    businessName,
    ownerName,
    email,
    phone,
    vertical,
    tier,
    clientDomain,
    monthlyRevenueLost,
  } = body as {
    businessName?:       string
    ownerName?:          string
    email?:              string
    phone?:              string
    vertical?:           string
    tier?:               string
    clientDomain?:       string
    monthlyRevenueLost?: number
  }

  if (!businessName || !email || !vertical || !tier || !clientDomain) {
    return NextResponse.json(
      { error: 'Missing required fields: businessName, email, vertical, tier, clientDomain' },
      { status: 400 }
    )
  }

  try {
    const subscription = await provisionClient({
      businessName, ownerName, email, phone, vertical, tier, clientDomain, monthlyRevenueLost,
    })
    return NextResponse.json({ success: true, subscription })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

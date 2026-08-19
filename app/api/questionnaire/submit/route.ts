import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncQuestionnaireToKB } from '@/lib/retell-kb-sync'
import { deriveItemKey } from '@/lib/inventory'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // `schedule` and `inventory` are pulled out deliberately: formData is spread straight into
    // client_questionnaires, and these columns live on client_schedules and client_inventory
    // instead. Leaving either in the spread would fail the whole upsert on an unknown column.
    const { client_domain, schedule, inventory, ...formData } = body

    if (!client_domain) {
      return NextResponse.json({ error: 'client_domain is required' }, { status: 400 })
    }

    // Verify the client domain exists and the user owns it
    const { data: subscription, error: subError } = await supabase
      .from('agent_subscriptions')
      .select('id, user_email')
      .eq('client_domain', client_domain)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Client domain not found' }, { status: 404 })
    }

    // Upsert questionnaire
    const { error: questError } = await supabase
      .from('client_questionnaires')
      .upsert({
        client_domain,
        ...formData,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'client_domain' })

    if (questError) {
      console.error('[QUESTIONNAIRE] Save failed:', questError.message)
      return NextResponse.json({ error: questError.message }, { status: 500 })
    }

    console.log(`[QUESTIONNAIRE] ✓ Saved for ${client_domain}`)

    // Working hours drive the times Ava offers a caller. Non-fatal on purpose: the questionnaire
    // itself is already saved, and a client with no schedule row falls back to default weekday
    // hours rather than losing the ability to book at all. Logged loudly because silently
    // serving defaults to someone who just typed their real hours is the kind of quiet
    // wrongness that hides for weeks.
    if (schedule) {
      const { error: schedError } = await supabase
        .from('client_schedules')
        .upsert({
          client_domain,
          timezone:                schedule.timezone,
          business_hours:          schedule.business_hours,
          slot_duration_minutes:   schedule.slot_duration_minutes,
          max_concurrent_per_slot: schedule.max_concurrent_per_slot,
          // Asked for the first time as of 2026-08-19. Before this every client silently kept
          // the database defaults of 14 days and 12 hours, which quietly refused any booking
          // more than a fortnight out — invisible to a client who had just filled in their
          // real hours and had no reason to think anything was unset.
          booking_horizon_days:    schedule.booking_horizon_days,
          lead_time_hours:         schedule.lead_time_hours,
          updated_at:              new Date().toISOString(),
        }, { onConflict: 'client_domain' })

      if (schedError) {
        console.error(`[QUESTIONNAIRE] ✗ Schedule save failed for ${client_domain}:`, schedError.message)
      } else {
        console.log(`[QUESTIONNAIRE] ✓ Schedule saved for ${client_domain}`)
      }
    }

    /**
     * Rental stock, when they said they rent things.
     *
     * Absent means 'they did not answer that question' and must leave existing stock alone —
     * an empty array from a client who ticked the box but typed nothing is treated the same
     * way, because wiping a yard's whole inventory on an accidental tick is not a recoverable
     * mistake in the middle of onboarding.
     *
     * Items they removed are DEACTIVATED, never deleted. bookings.inventory_item_key is plain
     * text rather than a foreign key, so deleting a row would leave existing bookings pointing
     * at an item nobody can look up. active=false keeps the history readable and takes it out
     * of everything Ava offers, since loadInventory only returns active rows.
     *
     * Non-fatal, like the schedule above: the questionnaire is already saved, and a client
     * with no inventory books people-time exactly as every existing client does.
     */
    if (Array.isArray(inventory) && inventory.length > 0) {
      const rows = inventory
        .filter((i: { label?: string }) => (i?.label ?? '').trim() !== '')
        .map((i: { label: string; quantity?: number }) => ({
          client_domain,
          // Derived server-side with the SAME function the spreadsheet importer uses, so the
          // two paths cannot produce different keys for the same item and duplicate it.
          item_key: deriveItemKey(i.label),
          label:    i.label.trim(),
          quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
          active:   true,
          updated_at: new Date().toISOString(),
        }))
        .filter((r: { item_key: string }) => r.item_key !== '')

      // Two labels can slug to one key ("Bounce House" and "bounce-house"). Keep the first
      // rather than letting the upsert fail on duplicate keys in a single statement.
      const unique = [...new Map(rows.map((r: { item_key: string }) => [r.item_key, r])).values()]

      if (unique.length > 0) {
        const { error: invError } = await supabase
          .from('client_inventory')
          .upsert(unique, { onConflict: 'client_domain,item_key' })

        if (invError) {
          console.error(`[QUESTIONNAIRE] ✗ Inventory save failed for ${client_domain}:`, invError.message)
        } else {
          const keptKeys = unique.map((r: { item_key: string }) => r.item_key)
          const { error: deactError } = await supabase
            .from('client_inventory')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('client_domain', client_domain)
            .not('item_key', 'in', `(${keptKeys.map((k: string) => `"${k}"`).join(',')})`)

          if (deactError) console.error(`[QUESTIONNAIRE] ✗ Inventory deactivate failed for ${client_domain}:`, deactError.message)
          else console.log(`[QUESTIONNAIRE] ✓ Inventory saved for ${client_domain}: ${unique.length} item(s)`)
        }
      }
    }

    // Awaited, not fire-and-forget: on Vercel's serverless runtime a function
    // can freeze as soon as it returns a response, so an un-awaited call risks
    // never actually completing. Confirmed via a real signup — the questionnaire
    // saved correctly but the prompt merge silently never ran until awaited.
    // Non-fatal: the questionnaire itself is already saved above; if this fails,
    // the sync-questionnaire-kb cron will retry it (kb_uploaded_at stays null).
    try {
      await syncQuestionnaireToKB(client_domain)
    } catch (e) {
      console.error(`[QUESTIONNAIRE] KB sync failed:`, e)
    }

    return NextResponse.json({ success: true, message: 'Questionnaire saved' })
  } catch (e) {
    console.error('[QUESTIONNAIRE] Error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

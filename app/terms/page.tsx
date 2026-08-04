import type { Metadata } from 'next'
import { LegalPage, Section, P, UL, LI } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service — 369 Agentic Systems',
  description: 'The terms that apply to using 369 Agentic Systems AI receptionist and automation services.',
}

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" updated="August 4, 2026">
      <Section title="The short version">
        <P>
          We provide an AI phone receptionist that answers your business calls, captures enquiries,
          and books appointments. You pay a monthly fee. Either of us can end the arrangement with
          30 days&rsquo; notice. The detail below matters, but that is the substance of it.
        </P>
      </Section>

      <Section title="What the service is">
        <P>
          369 Agentic Systems provides AI-powered call answering and related automation for small
          service businesses. Depending on your plan this may include answering inbound calls,
          capturing caller details, checking availability, booking appointments, sending follow-up
          messages, and a dashboard showing what happened.
        </P>
        <P>
          The AI is software, not a person. It will occasionally mishear a caller, misunderstand a
          request, or fail to capture a detail correctly. It is a tool that handles calls you would
          otherwise miss — it is not a guarantee that every call is handled perfectly, and you
          should review your dashboard rather than assume nothing needs attention.
        </P>
      </Section>

      <Section title="Your responsibilities">
        <UL>
          <LI>Give us accurate business information, and tell us when it changes.</LI>
          <LI>
            Make sure you are entitled to forward your business calls to our number and to have
            those calls recorded and transcribed. Call-recording notice requirements vary by state
            and are your responsibility for your own business.
          </LI>
          <LI>
            Use the service lawfully. Do not use it for unsolicited telemarketing, or for anything
            that would breach the TCPA, state do-not-call rules, or similar law.
          </LI>
          <LI>Keep your login secure and tell us promptly if you think it has been compromised.</LI>
          <LI>Review the appointments the AI books. They land in your dashboard and, where configured, your email.</LI>
        </UL>
      </Section>

      <Section title="Payment">
        <P>
          Fees are billed monthly in advance through Stripe, along with any one-time setup fee
          quoted when you signed up. Payment is due on the date shown on your invoice. If a payment
          fails we will tell you and may suspend the service until it is resolved.
        </P>
        <P>
          Fees are not refundable for a partial month, except where we have failed to provide the
          service and could not put it right. If we change our prices, we will give you at least 30
          days&rsquo; notice and you may cancel before the new price takes effect.
        </P>
      </Section>

      <Section title="Ending it">
        <P>
          You may cancel at any time with 30 days&rsquo; notice by emailing us. We may do the same.
          We may suspend or end the service immediately if it is being used unlawfully or in a way
          that risks our providers&rsquo; accounts.
        </P>
        <P>
          After cancellation you can ask us to export your call records, transcripts, and leads.
          We keep them for 90 days so you have time to do that, then delete them.
        </P>
      </Section>

      <Section title="Who owns what">
        <P>
          Your business data — your calls, transcripts, leads, and bookings — is yours. We hold and
          process it to run the service for you, and we do not sell it or use it to build anything
          for anyone else.
        </P>
        <P>
          The software, prompts, configurations, and site are ours and remain ours. Nothing here
          transfers ownership of them to you.
        </P>
      </Section>

      <Section title="Phone numbers">
        <P>
          Where we provision a phone number for you, it is supplied through our telephony provider
          and assigned for your use while you remain a client. If you want to port a number away,
          tell us and we will help where the provider allows it.
        </P>
      </Section>

      <Section title="What we do not promise">
        <P>
          The service is provided as-is. We do not warrant that it will be uninterrupted or
          error-free. It depends on third-party providers — telephony, AI models, hosting, email —
          and an outage at any of them can interrupt it. We will tell you when we know about a
          problem affecting you.
        </P>
        <P>
          We do not guarantee any particular number of calls answered, leads captured, appointments
          booked, or revenue earned. Any figures shown in our calculators are illustrative
          estimates based on stated assumptions, not projections of your results.
        </P>
      </Section>

      <Section title="Liability">
        <P>
          To the extent the law allows, our total liability for any claim relating to the service
          is limited to the fees you paid us in the three months before the claim arose. We are not
          liable for lost profits, lost business, or indirect or consequential loss — including
          from a call the AI mishandled or failed to capture.
        </P>
        <P>
          Nothing here excludes liability that cannot lawfully be excluded.
        </P>
      </Section>

      <Section title="Changes to these terms">
        <P>
          We may update these terms. If a change materially affects you we will email active
          clients and update the date at the top. Continuing to use the service after that means
          the new terms apply.
        </P>
      </Section>

      <Section title="Governing law">
        <P>
          These terms are governed by the laws of the State of Texas, and any dispute will be
          handled in the courts of Tarrant County, Texas.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          <a href="mailto:chris@369agenticsystems.com">chris@369agenticsystems.com</a> — 369 Agentic
          Systems, Dallas–Fort Worth, Texas.
        </P>
      </Section>
    </LegalPage>
  )
}

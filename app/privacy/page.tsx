import type { Metadata } from 'next'
import { LegalPage, Section, P, UL, LI, Table } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy — 369 Agentic Systems',
  description: 'What data 369 Agentic Systems collects, why, who processes it, and how to have it deleted.',
}

/**
 * Public and unauthenticated by design. Google's OAuth verification requires a privacy policy
 * that is reachable without a login, served from the same domain as the OAuth client, linked
 * from the homepage, and explicit about how Google user data is handled — so this page must not
 * move behind middleware or change path without updating the Google Cloud console entry.
 */
export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated="August 4, 2026">
      <Section title="Who this covers">
        <P>
          369 Agentic Systems builds and operates AI phone receptionists for small service
          businesses. That means two different groups of people appear in our systems, and the
          rules are not the same for both:
        </P>
        <UL>
          <LI><strong>Clients</strong> — the business owner who buys the service and logs into the dashboard.</LI>
          <LI>
            <strong>Callers</strong> — someone who phones a client&rsquo;s business line and speaks to
            the AI receptionist. Callers are not our customers, and their information belongs to
            the business they called. We process it on that business&rsquo;s behalf.
          </LI>
        </UL>
        <P>
          We are based in Dallas–Fort Worth, Texas, and operate as a sole proprietorship. Contact
          for anything in this policy, including deletion requests:{' '}
          <a href="mailto:chris@369agenticsystems.com">chris@369agenticsystems.com</a>.
        </P>
      </Section>

      <Section title="What we collect">
        <Table
          head={['Data', 'From whom', 'Why']}
          rows={[
            ['Name, email, business name, website domain, phone number, service area', 'Clients', 'To create an account, provision a phone number, and contact you about the service.'],
            ['Payment details', 'Clients', 'Handled entirely by Stripe. We never see or store card numbers — only a Stripe customer reference.'],
            ['Caller name, phone number, email address, service address, and a description of what they need', 'Callers', 'To pass the enquiry to the business they called, and to book an appointment when they ask for one.'],
            ['Call audio recording and a written transcript', 'Callers', 'To produce the transcript, extract the details above, and let the business owner review what was said.'],
            ['Call duration, outcome, and an automated sentiment label', 'Callers', 'Dashboard reporting for the business owner.'],
            ['Business details submitted to a website audit or ROI form', 'Prospective clients', 'To prepare the audit that was requested and follow up about it.'],
          ]}
        />
        <P>
          We do not run advertising trackers, we do not sell data to anyone, and we do not build
          profiles across unrelated businesses.
        </P>
      </Section>

      <Section title="Calls are recorded">
        <P>
          When someone calls a business that uses our AI receptionist, the call is recorded and
          transcribed. The AI states that it is an AI assistant. Recordings and transcripts are
          visible to the business owner who received the call and to us as the operator of the
          system.
        </P>
        <P>
          Texas is a one-party-consent state, and our clients are responsible for meeting the
          notice requirements that apply to their own business and to callers from other states.
          If you called a business and want the recording of your call deleted, email us and we
          will remove it.
        </P>
      </Section>

      <Section title="Who else processes this data">
        <P>
          We use a small number of established providers. Each receives only what it needs to do
          its job, and each is bound by its own terms as a processor:
        </P>
        <Table
          head={['Provider', 'What it handles']}
          rows={[
            ['Supabase', 'The database and login system. Stores client accounts, call records, transcripts, leads, and bookings.'],
            ['Retell AI', 'Places and answers the phone calls, produces recordings and transcripts.'],
            ['Anthropic (Claude)', 'The language model behind the receptionist and behind some internal document processing. Anthropic does not train on data submitted through its API.'],
            ['Resend', 'Sends transactional email — confirmations, alerts, and login codes.'],
            ['Stripe', 'Processes payments. Card details go directly to Stripe and never reach our servers.'],
            ['Vercel', 'Hosts the website and application.'],
          ]}
        />
        <P>
          These providers store and process data in the United States. If you are contacting us
          from outside the US, your information will be handled there.
        </P>
      </Section>

      <Section title="Google user data" id="google">
        <P>
          Connecting a Google Calendar is <strong>optional</strong> and is initiated only by the
          business owner, from their own dashboard. This section applies solely to clients who
          have chosen to connect an account; if you have not connected one, we hold no Google
          user data about you at all.
        </P>
        <UL>
          <LI>
            <strong>What we request.</strong> Permission to see when you are busy and to create
            and update calendar events — nothing broader. We do not request access to Gmail,
            Drive, Contacts, or any other Google service.
          </LI>
          <LI>
            <strong>What we do with it.</strong> Ask Google which times you are busy, so the AI
            receptionist does not offer a caller a time you already have something booked — and
            write a calendar event when a caller books an appointment. That is the entire purpose.
          </LI>
          <LI>
            <strong>We do not read your events.</strong> The busy-times permission returns time
            ranges and nothing else: no titles, no guests, no descriptions, no locations. This is
            not a promise about how we behave — it is the only thing Google gives us. It is why we
            request that permission rather than the broader &ldquo;read your calendar&rdquo; one.
          </LI>
          <LI>
            <strong>What we store.</strong> Two access credentials from Google, both encrypted at
            rest, so the connection keeps working without asking you to sign in again; and, for
            each appointment we create, its start and end time and the identifier of the event we
            created. We do not copy your calendar into our database.
          </LI>
          <LI>
            <strong>What we never do.</strong> We do not sell Google user data, transfer it to
            anyone for advertising, use it for personalized advertising, use it to train any AI
            model, or allow a human to read it except where you have explicitly asked us to fix a
            problem, or where the law requires it.
          </LI>
          <LI>
            <strong>Disconnecting.</strong> Two ways, and either is enough. Use{' '}
            <strong>Disconnect</strong> on your dashboard, which deletes our stored credentials
            immediately and stops all calendar access. Or revoke us from your{' '}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
              Google account permissions page
            </a>
            , which cuts off access at Google&rsquo;s end at once; the next time our system finds
            the access revoked it discards the stored credentials too. You can also simply ask us.
          </LI>
        </UL>
        <P>
          369 Agentic Systems&rsquo; use and transfer of information received from Google APIs
          adheres to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </P>
      </Section>

      <Section title="How long we keep things">
        <P>
          Call recordings, transcripts, and lead records are retained while the business that
          received them remains a client, and for 90 days after an account closes so the owner can
          export their records. Account and billing records are kept for seven years because tax
          law requires it. Audit and ROI form submissions are deleted after 24 months if they
          never become a client.
        </P>
        <P>Ask us to delete something sooner and we will, unless we are legally required to keep it.</P>
      </Section>

      <Section title="Your rights">
        <P>
          Email <a href="mailto:chris@369agenticsystems.com">chris@369agenticsystems.com</a> to
          get a copy of what we hold about you, correct it, or have it deleted. We will respond
          within 30 days. This is a small operation — a real person reads that inbox.
        </P>
        <P>
          If you are a caller rather than a client, we may need to refer your request to the
          business you called, since the record belongs to them. We will tell you if that happens.
        </P>
      </Section>

      <Section title="Security">
        <P>
          Data is encrypted in transit and at rest by our providers. Access to the database is
          restricted by row-level security so one client cannot see another&rsquo;s records, and
          internal service calls are authenticated with rotating shared secrets. No system is
          perfect; if we discover a breach affecting your data, we will tell you.
        </P>
      </Section>

      <Section title="Children">
        <P>This service is sold to businesses and is not directed at anyone under 18.</P>
      </Section>

      <Section title="Changes">
        <P>
          If we change this policy materially we will update the date at the top and email active
          clients. Continuing to use the service after that means the new version applies.
        </P>
      </Section>
    </LegalPage>
  )
}

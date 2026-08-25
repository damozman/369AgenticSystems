/**
 * Seeds throwaway Lead Engine sites — one per template, plus a theme-independence case and a
 * sparse regression case — so the designs can be READ rather
 * than reasoned about.
 *
 * This project's own lesson, paid for twice: read the artifact, not the code that made it. A unit
 * test asks whether the code did what it was told; only a reader asks whether the result is worth
 * reading. Two shipping defects in the dossier were invisible to every test and obvious in the
 * first thirty seconds of reading one.
 *
 * Everything it writes is prefixed `review-` and owned by the address below, and `--cleanup`
 * refuses to touch anything else.
 *
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs --apply
 *   node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs --cleanup --apply
 *
 * It writes to PRODUCTION Supabase — there is no other Supabase here — but it buys nothing, calls
 * no external API, and sends no mail.
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { contentFrom } from '@/lib/lead-engine/content'
import { PHOTO_BUCKET } from '@/lib/lead-engine/site'
import { MAX_PHOTOS_PER_SITE } from '@/lib/lead-engine/limits'
import { resolveForVertical } from '@/lib/lead-engine/theme'

const APPLY   = process.argv.includes('--apply')
const CLEANUP = process.argv.includes('--cleanup')

const OWNER = 'chris@369agenticsystems.com'
const PREFIX = 'review-'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * Eight review fixtures: one per template, one proving theme is independent of template, one
 * exercising a brand colour that FAILS contrast, and one deliberately sparse.
 *
 * These are FIXTURES, not customers. The truthfulness rules exist to stop false claims appearing on
 * a real business's own site, and no real business is involved here — so the testimonials, FAQs and
 * service descriptions below are written fiction. Chris's call, 2026-08-23: judging composition on
 * pages that are silently missing Trust and FAQ would be judging the wrong thing.
 *
 * `review-threshold` proves the model: SAME template as the roofer, different theme, plus a brand
 * accent. If those two pages look like the same site, the theme layer is not working.
 *
 * `review-brand-fail` carries #FFE500 on Forge — 1.21:1 on that kit's paper, so validateAccent
 * takes its `derived` branch. What to check on the page: buttons stay readable, and the original
 * yellow still shows where it is used as a large fill rather than as text.
 *
 * `review-sparse` stays thin on services and photos — that is its job — but gets testimonials and
 * FAQs, so the no-photo degrade is tested at realistic density rather than on an empty page.
 *
 * `review-threshold` also carries only 5 services, so layout 5a (the image ladder) actually
 * renders. At 8 services every site takes 5b and the ladder would ship unseen.
 */
const SITES = [
  {
    slug: `${PREFIX}trade-classic`,
    vertical: 'roofing',            // -> trade_classic + forge
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Northside Roofing Company',
      phone: '(817) 612-6757',
      // Five on purpose. Trade Classic is the template most customers will get, and at 7+ services
      // it takes the two-column list — so its signature block, the image ladder, would never be
      // seen on the flagship. Ladder now appears on Forge and Threshold; the list on Counsel,
      // Yard, Clinic and Ledger. Both layouts, at least two themes each.
      services: [
        { name: 'Roof replacement', description: 'Full tear-off and re-roof, with the old material hauled away the same day.' },
        { name: 'Storm damage repair', description: 'Emergency assessment and repair after hail or wind, documented for your insurer.' },
        { name: 'Gutter installation', description: 'Seamless gutters formed on site to fit the run exactly.' },
        { name: 'Free roof inspections', description: 'A written report with photographs, whether or not you go ahead with us.' },
        { name: 'Emergency tarping', description: 'Same-day cover to stop water getting in while a claim is assessed.' },
      ],
      service_areas: 'Fort Worth, Arlington, Keller, Southlake, Grapevine, Colleyville, Haslet, Saginaw',
      differentiator: 'Every roof we replace is inspected by the owner before we ask for the final payment.',
      customer_impression: 'That we actually answered the phone at nine at night.',
      credentials: 'Licensed and insured in Texas',
      years_in_business: '12 years',
      primary_cta: 'call',
      google_profile_url: 'g.page/northside-roofing',
      has_photos: true,
      pain_points: 'WE MISS HALF OUR CALLS — this must never appear on the page.',
      testimonials: [
        { quote: 'They tarped the roof the night the storm hit and had the full replacement done inside two weeks. The insurance paperwork was handled for us.', name: 'Marcus D.', city: 'Keller', jobType: 'Storm replacement' },
        { quote: 'Two other companies told me I needed a whole new roof. Northside repaired the section that was actually damaged and charged a fifth of the price.', name: 'Priya R.', city: 'Fort Worth', jobType: 'Repair' },
        { quote: 'Turned up when they said, cleaned up properly, and the owner came out to check it before they invoiced. Rare these days.', name: 'Dale W.', city: 'Southlake', jobType: 'Full replacement' },
      ],
      faqs: [
        { question: 'How much does a new roof cost?', answer: 'Most residential replacements in this area land between $9,000 and $22,000 depending on size, pitch and material. We give you a written figure before any work starts.' },
        { question: 'Will my insurance cover storm damage?', answer: 'Often, yes. We document the damage, meet your adjuster on site, and give you the report they need. We do not file the claim for you, but we make it straightforward.' },
        { question: 'How long does a replacement take?', answer: 'A typical single-family roof is one to two days on site, weather permitting. Larger or steeper roofs can run to three.' },
        { question: 'Do you need permits?', answer: 'Yes, and we pull them. The permit fee is itemised on your quote rather than buried in the total.' },
        { question: 'What happens to my garden and driveway?', answer: 'We tarp landscaping, use a magnetic sweeper over the drive and lawn at the end of every day, and haul the old material away ourselves.' },
        { question: 'When do I pay?', answer: 'A deposit on scheduling and the balance once the owner has inspected the finished work. Never the full amount up front.' },
      ],
      notify_email: OWNER,
      preferred_slug: 'northside-roofing',
    },
  },
  {
    slug: `${PREFIX}threshold`,
    vertical: 'real-estate',        // -> trade_classic + threshold
    photos: MAX_PHOTOS_PER_SITE,
    brand: { accent: '#2F5D50', paper_shade: 'warm' },
    answers: {
      business_name: 'Camden & Vale Realty',
      phone: '(817) 555-0188',
      // Five services on purpose: this is the site that renders the image ladder.
      services: [
        { name: 'Residential sales', description: 'Listing, marketing and negotiation, handled by the agent you first met.' },
        { name: 'First-time buyers', description: 'A slower walk through the whole process, with no assumption you know the jargon.' },
        { name: 'Property valuation', description: 'A written figure with the comparable sales it is based on.' },
        { name: 'Listing preparation', description: 'What to fix, what to leave, and what genuinely changes the offer.' },
        { name: 'Relocation', description: 'Coordinating a sale and a purchase when the dates do not line up.' }
      ],
      service_areas: 'Fort Worth, Southlake, Westlake, Colleyville, Keller, Roanoke',
      differentiator: 'We take twelve listings a year, not sixty, so you get the agent you met at every showing.',
      customer_impression: 'That the same agent turned up every single time — not whoever was free that day.',
      credentials: 'Texas Real Estate Commission licensed',
      years_in_business: '9 years',
      primary_cta: 'other',
      primary_cta_other: 'Book a Valuation',
      google_profile_url: 'g.page/camden-vale-realty',
      has_photos: true,
      pain_points: 'INTERNAL ONLY — should not render.',
      testimonials: [
        { quote: 'They talked us out of two offers that looked better on paper. The one we took closed without a single problem.', name: 'Helen S.', city: 'Westlake', jobType: 'Sale' },
        { quote: 'Same agent at every viewing, which sounds small until you have dealt with an agency where it is a different person each time.', name: 'Tom A.', city: 'Colleyville', jobType: 'Purchase' },
      ],
      faqs: [
        { question: 'What is your commission?', answer: 'A flat percentage agreed in writing before we list, with no marketing surcharges added later. We will quote it on the first call.' },
        { question: 'How long will my house take to sell?', answer: 'In this market, most of our listings are under contract within five weeks. Anything priced above the comparable range takes considerably longer.' },
        { question: 'Should I renovate before listing?', answer: 'Usually not. Paint and decluttering pay for themselves; kitchens and bathrooms rarely return what they cost in a sale.' },
        { question: 'Do you handle rentals?', answer: 'No. We sell and we buy. For lettings we will refer you to a management firm we trust rather than take it on badly.' },
        { question: 'What does a valuation involve?', answer: 'About forty minutes at the property, then a written figure with the comparable sales it is based on so you can see the reasoning.' },
      ],
      notify_email: OWNER,
      preferred_slug: 'camden-vale-realty',
    },
  },
  {
    slug: `${PREFIX}service-clean`,
    vertical: 'legal',              // -> service_clean + counsel
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Hallam & Reed Legal',
      phone: '(817) 555-0142',
      services: [
        { name: 'Wills and probate', description: 'Drafting, and administering an estate through the Texas courts.' },
        { name: 'Family law', description: 'Divorce, custody and support, handled without unnecessary escalation.' },
        { name: 'Small business contracts', description: 'Supplier and client agreements written in language you can use.' },
        { name: 'Real estate closings', description: 'Title review and closing for residential and small commercial purchases.' },
        { name: 'Estate planning', description: 'Wills, powers of attorney and directives, reviewed as circumstances change.' },
        { name: 'Guardianship', description: 'Applications for minors and for adults who can no longer manage their affairs.' },
        { name: 'Business formation', description: 'LLC and corporation setup, including the agreements between owners.' },
        { name: 'Contract disputes', description: 'Negotiation first, litigation only where it is genuinely worth it.' }
      ],
      service_areas: 'Tarrant County, Dallas County, Denton County, Parker County, Johnson County',
      differentiator: 'You speak to the attorney handling your matter directly, never a case manager.',
      customer_impression: 'That we told them honestly whether they even needed a lawyer.',
      credentials: 'State Bar of Texas',
      years_in_business: '18 years',
      primary_cta: 'other',
      primary_cta_other: 'Request a Consultation',
      google_profile_url: 'g.page/hallam-reed-legal',
      has_photos: true,
      pain_points: 'INTERNAL ONLY — should not render.',
      testimonials: [
        { quote: 'She told me on the first call that I did not need to hire anyone, and explained what to do instead. I came back two years later for the estate work.', name: 'Robert N.', city: 'Fort Worth', jobType: 'Probate' },
        { quote: 'The flat fee was the whole reason we chose them. We knew what it cost before anything started.', name: 'Angela M.', city: 'Arlington', jobType: 'Business formation' },
        { quote: 'Difficult circumstances handled without any drama. That is worth a lot.', name: 'Chris B.', city: 'Denton', jobType: 'Family law' },
      ],
      faqs: [
        { question: 'What does a consultation cost?', answer: 'The first conversation is free and usually takes half an hour. If we can point you somewhere better, we will.' },
        { question: 'Do you charge by the hour?', answer: 'For most matters, no. We agree a flat fee in writing before starting. Litigation is the exception and we say so up front.' },
        { question: 'How long does probate take in Texas?', answer: 'An uncontested independent administration is commonly four to eight months. Contested matters run considerably longer.' },
        { question: 'Do I need a will if I have no property?', answer: 'If you have children, almost certainly. Guardianship is decided by a will and it is the part people most often overlook.' },
        { question: 'Will I speak to the same attorney throughout?', answer: 'Yes. That is the reason the firm is deliberately small.' },
      ],
      notify_email: OWNER,
      preferred_slug: 'hallam-reed-legal',
    },
  },
  {
    slug: `${PREFIX}showcase-grid`,
    vertical: 'event-rentals',      // -> showcase_grid + forge
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Lone Star Party Rentals',
      phone: '(817) 555-0199',
      services: [
        { name: 'Bounce houses', description: 'Themed and plain, from toddler size up to combo units with slides.' },
        { name: 'Mobile casino tables', description: 'Blackjack, roulette and poker, with dealers who are good with a nervous crowd.' },
        { name: 'DJ and sound', description: 'PA, lighting and a DJ who will take requests or stick to your playlist.' },
        { name: 'Party bus', description: 'Up to twenty passengers, with a driver, for the evening or the whole day.' },
        { name: 'Tables and chairs', description: 'Banquet and round tables, delivered set up rather than stacked in the drive.' },
        { name: 'Water slides', description: 'Single and double lane, for the months when a bounce house is too hot.' },
        { name: 'Concession machines', description: 'Popcorn, snow cone and candy floss, supplied with enough stock for the day.' },
        { name: 'Tents and marquees', description: 'Frame tents from 10x10 up, with sidewalls if the forecast turns.' }
      ],
      service_areas: 'Fort Worth, Dallas, Arlington, Plano, Frisco, Denton, Mansfield',
      differentiator: 'We set up and take down ourselves, so you never touch a thing.',
      customer_impression: 'That everything arrived cleaner than they expected.',
      credentials: 'Fully insured',
      years_in_business: 'Since 2019',
      primary_cta: 'availability',
      google_profile_url: 'g.page/lone-star-party-rentals',
      has_photos: true,
      pain_points: 'INTERNAL ONLY — should not render.',
      testimonials: [
        { quote: 'Set up before we were even awake and collected it after the kids went to bed. We did not lift a thing.', name: 'Sam O.', city: 'Arlington', jobType: 'Birthday' },
        { quote: 'The casino tables made the whole evening. The dealers they sent were genuinely good with a nervous crowd.', name: 'Rebecca T.', city: 'Fort Worth', jobType: 'Corporate event' },
      ],
      faqs: [
        { question: 'How far ahead should I book?', answer: 'Three to four weeks for a weekend in spring or autumn. Midweek is usually available at shorter notice.' },
        { question: 'What happens if it rains?', answer: 'Inflatables cannot run in high wind or heavy rain for safety reasons. Tell us by nine on the morning and we will move the booking rather than charge you.' },
        { question: 'Do you set up and collect?', answer: 'Always, and it is included. We need about an hour before the start and thirty minutes after.' },
        { question: 'What space do you need?', answer: 'A standard bounce house needs roughly 20 by 20 feet of level ground and access through a gate at least four feet wide.' },
        { question: 'Is there a power supply needed?', answer: 'Yes, a standard outlet within a hundred feet for anything inflatable. We bring the extension leads.' },
      ],
      notify_email: OWNER,
      preferred_slug: 'lone-star-party-rentals',
    },
  },
  {
    slug: `${PREFIX}practice`,
    vertical: 'dental',             // -> practice + clinic
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Bluebonnet Family Dental',
      phone: '(817) 555-0164',
      services: [
        { name: 'Check-ups and cleaning', description: 'Examination, scale and polish, with anything we find explained before we act.' },
        { name: 'Fillings', description: 'Tooth-coloured composite, matched to the teeth either side.' },
        { name: 'Crowns and bridges', description: 'Quoted before we start, with a temporary fitted the same day.' },
        { name: 'Root canal treatment', description: 'Usually one or two visits, with more time booked than we think we need.' },
        { name: 'Teeth whitening', description: 'Supervised home trays rather than a single aggressive in-chair session.' },
        { name: 'Childrens dentistry', description: 'From around age three, starting with a ride in the chair and nothing else.' },
        { name: 'Emergency appointments', description: 'Two slots held free every morning for people in pain.' },
        { name: 'Dentures', description: 'Full and partial, adjusted as often as it takes to sit comfortably.' }
      ],
      service_areas: 'Fort Worth, Benbrook, White Settlement, Westworth Village',
      differentiator: 'We keep two slots free every morning for people in pain.',
      customer_impression: 'That nobody made them feel bad about not having been in for years.',
      credentials: 'Texas State Board of Dental Examiners',
      years_in_business: '15 years',
      primary_cta: 'other',
      primary_cta_other: 'Book an Appointment',
      google_profile_url: 'g.page/bluebonnet-family-dental',
      has_photos: true,
      pain_points: 'INTERNAL ONLY — should not render.',
      testimonials: [
        { quote: 'I had avoided dentists for eleven years. They took it slowly and nobody made a comment about it once.', name: 'Janine P.', city: 'Benbrook', jobType: 'New patient' },
        { quote: 'Rang at eight in the morning with an abscess and was seen before lunch.', name: 'Ade F.', city: 'Fort Worth', jobType: 'Emergency' },
        { quote: 'They quoted the crown before doing it and the final bill was the same number. That should be normal and it is not.', name: 'Lauren K.', city: 'White Settlement', jobType: 'Crown' },
      ],
      // The access bar answers "are you taking new patients", and the new-patient section answers
      // "what do I bring" — both were FAQ rows before those sections existed. Left in place they
      // would print the same answer twice on one page.
      faqs: [
        { question: 'What does a check-up cost without insurance?', answer: 'A check-up and clean is $120 for a new patient. We will tell you the price of anything further before we do it.' },
        { question: 'What if I am nervous?', answer: 'Tell us when you book. We allow extra time, explain everything before we do it, and stop whenever you ask.' },
        { question: 'Do you see children?', answer: 'Yes, from around age three. First visits are usually a ride in the chair and a count of the teeth, nothing more.' },
        { question: 'Can I pay in instalments?', answer: 'For larger treatment plans, yes. We will set it out in writing before you commit to anything.' },
        { question: 'What happens if I need treatment urgently?', answer: 'Two slots are held free every morning. Ring before nine and you will usually be seen the same day.' },
        { question: 'Do you take referrals from other dentists?', answer: 'Yes, and we will write back to them with what we did unless you would rather we did not.' },
      ],

      // ── Practice-only answers (Q9–Q11) ──
      accepting_new_patients: true,
      insurance_accepted: 'Delta Dental, Cigna, MetLife, Aetna, Guardian, United Concordia',
      hours: 'Mon–Thu 7:30–5:00; Fri 7:30–1:00; Sat by arrangement',
      location: '2140 Camp Bowie Boulevard, Fort Worth, TX 76107',
      team: [
        { name: 'Dr Elena Ruiz', role: 'Principal dentist', credentials: 'DDS, Texas licence 21044', bio: 'Opened the practice in 2011 after eight years in a hospital dental department. Takes the nervous appointments herself.' },
        { name: 'Dr Marcus Oyelaran', role: 'Associate dentist', credentials: 'DMD', bio: 'Joined in 2019. Most of the crown and bridge work, and the referrals from three practices nearby.' },
        { name: 'Priya Raman', role: 'Dental hygienist', credentials: 'RDH', bio: 'Sees most patients more often than either dentist does, and will tell you honestly whether you need the appointment.' },
        { name: 'Dana Whitmore', role: 'Practice manager', bio: 'Handles insurance, payment plans and the two emergency slots. The person you speak to when you ring.' },
        { name: 'Tobias Lin', role: 'Dental assistant', credentials: 'RDA' },
      ],
      first_visit: 'Your first appointment runs 45 minutes rather than the usual 20. We take a full history, examine everything, and then sit down and go through what we found and what it would cost before booking anything. Nobody is asked to agree to treatment on the day.',
      what_to_bring: 'Insurance card or plan details; A list of any medications you take; The name of your previous dentist; Photo ID',
      patient_forms_url: 'https://bluebonnetfamilydental.example.com/new-patient-forms',

      notify_email: OWNER,
      preferred_slug: 'bluebonnet-family-dental',
    },
  },
  {
    slug: `${PREFIX}supply`,
    vertical: 'wholesale',          // -> supply + ledger
    photos: MAX_PHOTOS_PER_SITE,
    answers: {
      business_name: 'Trinity Trade Supply',
      phone: '(817) 555-0121',
      services: [
        { name: 'Fasteners and fixings', description: 'Bolts, anchors and screws, held in the quantities a site actually gets through.' },
        { name: 'Power tool accessories', description: 'Blades, bits and discs for the brands your crews already run.' },
        { name: 'Abrasives', description: 'Discs, belts and sheets across the full grit range.' },
        { name: 'Safety equipment', description: 'PPE, harnesses and signage, with certification supplied.' },
        { name: 'Adhesives and sealants', description: 'Structural adhesives, silicones and foams, stored so they are in date.' },
        { name: 'Hand tools', description: 'Trade-grade rather than retail, replaced under warranty without argument.' },
        { name: 'Site consumables', description: 'Sheeting, tape, marking and the things nobody remembers to order.' },
        { name: 'Workwear', description: 'Hi-vis, boots and cold weather kit, embroidered if you want it.' }
      ],
      service_areas: 'North Texas, Oklahoma, Louisiana, Arkansas',
      differentiator: 'Order by two, and it is on your site by seven the next morning, anywhere in North Texas.',
      customer_impression: 'That the same driver has shown up every week for years.',
      credentials: 'Authorised distributor for eleven manufacturers',
      years_in_business: '22 years',
      primary_cta: 'other',
      primary_cta_other: 'Request a Quote',
      google_profile_url: 'g.page/trinity-trade-supply',
      has_photos: true,
      pain_points: 'INTERNAL ONLY — should not render.',
      testimonials: [
        { quote: 'Same driver for six years. He knows which gate to use and where the site office is, which sounds trivial until you deal with a courier.', name: 'Ken H.', city: 'Fort Worth', jobType: 'Groundworks contractor' },
        { quote: 'They hold our regular lines so we are not carrying the stock ourselves. That changed our cash flow more than any discount would have.', name: 'Maria V.', city: 'Denton', jobType: 'Fit-out contractor' },
      ],
      faqs: [
        { question: 'Do you have a minimum order?', answer: 'For account customers on a scheduled delivery, no. Ad-hoc deliveries outside the regular round have a minimum that we will confirm when you set the account up.' },
        { question: 'How quickly can you deliver?', answer: 'Order by 2pm for next-morning delivery across North Texas. Out of state is typically two working days.' },
        { question: 'Can you hold stock for us?', answer: 'Yes. Tell us your regular lines and we will carry them so you do not have to.' },
        { question: 'Do you offer trade accounts?', answer: 'Yes, subject to the usual references. Terms are agreed in writing when the account opens.' },
        { question: 'What if something arrives damaged?', answer: 'Tell the driver or call the same day and we replace it on the next round. We do not ask you to return it first.' },
      ],
      notify_email: OWNER,
      preferred_slug: 'trinity-trade-supply',
    },
  },
  {
    // The brand-failure case. #FFE500 measures 1.21:1 on Forge's paper, so validateAccent takes
    // its `derived` branch: the interface uses a darkened value while the original yellow survives
    // for large fills and the logo.
    slug: `${PREFIX}brand-fail`,
    vertical: 'roofing',            // -> trade_classic + forge
    photos: MAX_PHOTOS_PER_SITE,
    brand: { accent: '#FFE500' },
    answers: {
      business_name: 'Sunbelt Exteriors',
      phone: '(817) 555-0133',
      services: [
        { name: 'Roof replacement', description: 'One crew, one job, start to finish before we take on the next.' },
        { name: 'Siding', description: 'Fibre cement and vinyl, usually cheaper done alongside the roof.' },
        { name: 'Gutter replacement', description: 'Seamless runs formed on site, fitted while the scaffolding is up.' },
        { name: 'Storm damage repair', description: 'Documented for your insurer, with same-day tarping if it is open.' },
        { name: 'Roof inspections', description: 'A written report with photographs before you commit to anything.' }
      ],
      service_areas: 'Fort Worth, Weatherford, Aledo, Willow Park',
      differentiator: 'One crew, one job at a time — we never start your roof and disappear to another site.',
      customer_impression: "That they'd rather turn a job away than run three jobs badly at once.",
      credentials: 'Licensed and insured in Texas',
      years_in_business: '7 years',
      primary_cta: 'call',
      google_profile_url: 'g.page/sunbelt-exteriors',
      has_photos: true,
      pain_points: 'INTERNAL ONLY — should not render.',
      testimonials: [
        { quote: 'They finished our roof before starting anyone else. Four days, start to finish, and the site was spotless.', name: 'Nathan G.', city: 'Aledo', jobType: 'Replacement' },
        { quote: 'Quoted honestly, did what they quoted, invoiced the same figure.', name: 'Sarah L.', city: 'Weatherford', jobType: 'Siding' },
      ],
      faqs: [
        { question: 'How soon can you start?', answer: 'Because we run one job at a time, the wait is usually two to three weeks. Emergency tarping is same day.' },
        { question: 'Do you do siding as well as roofing?', answer: 'Yes, and gutters. It is usually cheaper to do them in the same visit while the scaffolding is up.' },
        { question: 'What warranty do you offer?', answer: 'Ten years on our workmanship, plus whatever the manufacturer gives on the material. Both are in writing.' },
        { question: 'Do you work with insurance claims?', answer: 'We document the damage and meet the adjuster. The claim itself stays yours to file.' },
        { question: 'What does the deposit cover?', answer: 'Material ordering. The balance is due after you have walked the finished job with us.' },
      ],
      notify_email: OWNER,
      preferred_slug: 'sunbelt-exteriors',
    },
  },
  {
    // The regression case. Resolves to trade_classic + forge, but with zero photos it RENDERS
    // Service Clean — in Forge's identity. It should still read as a plumber, not a law firm.
    // Testimonials and FAQs are present so the degrade is judged at realistic density.
    slug: `${PREFIX}sparse`,
    vertical: 'plumbing',
    photos: 0,
    answers: {
      business_name: 'Bell Avenue Plumbing',
      phone: '(817) 555-0175',
      services: [
        { name: 'Drain cleaning', description: 'Cabling and jetting, with a camera survey if it keeps coming back.' },
        { name: 'Water heaters', description: 'Repair or replacement, and an honest answer about which you need.' },
        { name: 'Leak repair', description: 'Detection and repair, including under slab.' }
      ],
      service_areas: 'Fort Worth',
      // 4a IS the hero's lede, and without it the editorial hero is a headline and a button with
      // half a screen of void beside it — Q4a is therefore REQUIRED, a customer who skips it has no
      // page. Sparse here means no photos and few services, not no answers. Under the 2026-08-24
      // Q4 rewrite, 4a + 4b (both answered here) is the FLOOR every real customer clears — two
      // items lands the compact pull-quote Why-us layout, which is the shape this fixture exists to
      // exercise (see the other single-column fixtures: brand-fail, showcase-grid, practice).
      differentiator: 'One van, one plumber — the same number you called last time, every time.',
      customer_impression: "That we actually showed up, after their last plumber didn't.",
      primary_cta: 'call',
      has_photos: false,
      pain_points: 'INTERNAL ONLY — should not render.',
      testimonials: [
        { quote: 'Came out on a Sunday for a burst pipe and charged the weekday rate.', name: 'Ian C.', city: 'Fort Worth', jobType: 'Emergency' },
        { quote: 'Fixed in twenty minutes what another firm wanted to replace entirely.', name: 'Della M.', city: 'Fort Worth', jobType: 'Repair' },
      ],
      faqs: [
        { question: 'Do you charge a call-out fee?', answer: 'No call-out fee within Fort Worth. You pay for the time and the parts.' },
        { question: 'Are you available at weekends?', answer: 'For emergencies, yes, at the same hourly rate as a weekday.' },
        { question: 'How quickly can you come out?', answer: 'Same day for anything leaking. Within two days for everything else.' },
        { question: 'Do you replace water heaters?', answer: 'Yes, and we will tell you honestly whether yours needs replacing or repairing.' },
      ],
    },
  },
]

/**
 * A flat placeholder in the theme-neutral edge tone.
 *
 * Deliberately ONE colour for every slot. The previous random pastels made review harder than it
 * needed to be — a grid of different colours reads as broken rather than as pending, and it was
 * impossible to judge composition through it.
 */
async function placeholder(label, index) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">
      <rect width="1600" height="1200" fill="#DEDEDA"/>
      <text x="800" y="600" font-family="Inter, sans-serif" font-size="40" fill="#9A9A94"
            text-anchor="middle" dominant-baseline="middle">${label} ${index + 1}</text>
    </svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer()
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(PHOTO_BUCKET)
  if (data) return { existed: true }
  if (!APPLY) return { existed: false }
  const { error } = await supabase.storage.createBucket(PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  if (error) throw new Error(`Could not create bucket ${PHOTO_BUCKET}: ${error.message}`)
  return { existed: false }
}

async function cleanup() {
  const { data: sites, error } = await supabase
    .from('lead_engine_sites')
    .select('id, slug')
    .like('slug', `${PREFIX}%`)
  if (error) throw new Error(error.message)

  if (!sites?.length) {
    console.log('Nothing to clean up.')
    return
  }

  for (const site of sites) {
    // Belt and braces: the query already filtered, but a delete keyed on a prefix is exactly the
    // sort of thing that gets edited later by someone in a hurry.
    if (!site.slug.startsWith(PREFIX)) {
      console.error(`REFUSING to delete ${site.slug} — not a review site.`)
      continue
    }
    console.log(`${APPLY ? 'Deleting' : 'Would delete'} /sites/${site.slug}`)
    if (!APPLY) continue

    const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(site.id)
    if (files?.length) {
      await supabase.storage.from(PHOTO_BUCKET).remove(files.map(f => `${site.id}/${f.name}`))
    }
    // Photos and submissions cascade from the site row.
    const { error: delError } = await supabase.from('lead_engine_sites').delete().eq('id', site.id)
    if (delError) console.error(`  failed: ${delError.message}`)
  }
  console.log(APPLY ? '\nCleaned up.' : '\nDry run — add --apply to actually delete.')
}

async function seed() {
  // Fail with the actual instruction rather than a Postgres error code.
  // PGRST205 is PostgREST's "not in the schema cache"; 42P01 is Postgres's own undefined_table.
  // A supabase-js call normally hits the first, never the second.
  const { error: probe } = await supabase.from('lead_engine_sites').select('id').limit(1)
  if (probe?.code === 'PGRST205' || probe?.code === '42P01') {
    console.error('\n✗ lead_engine_sites does not exist.')
    console.error('  Apply supabase/migrations/2026-08-23-lead-engine.sql in the Supabase SQL editor first.\n')
    // exitCode rather than exit(): an abrupt exit while sharp's native worker is still open trips
    // a libuv assertion on Windows, which prints a scary line after a perfectly clear message.
    process.exitCode = 1
    return
  }
  if (probe) throw new Error(probe.message)

  const bucket = await ensureBucket()
  console.log(bucket.existed
    ? `Bucket ${PHOTO_BUCKET}: already exists`
    : `Bucket ${PHOTO_BUCKET}: ${APPLY ? 'CREATED (public, 5MB, jpeg/png/webp)' : 'would create'}`)

  for (const spec of SITES) {
    const content = contentFrom(spec.answers, spec.answers.business_name)
    // Printed from resolveForVertical rather than from the spec, so a dry run shows the pair the
    // mapping actually produces — which is the thing worth checking before writing anything.
    const pair = resolveForVertical(spec.vertical)
    const rendered = spec.photos > 0 ? pair.template : 'service_clean (degraded — no photos)'
    console.log(`\n${APPLY ? 'Seeding' : 'Would seed'} /sites/${spec.slug}`)
    console.log(`  ${spec.vertical} -> ${pair.template} + ${pair.theme}, renders ${rendered}, ${spec.photos} photos`)
    console.log(`  ${content.businessName} — CTA "${content.cta.label}" (${content.cta.kind})`)

    if (!APPLY) continue

    await supabase.from('lead_engine_sites').delete().eq('slug', spec.slug)

    const { data: site, error } = await supabase
      .from('lead_engine_sites')
      .insert({
        owner_email: OWNER,
        slug: spec.slug,
        business_name: spec.answers.business_name,
        status: 'draft',
        // Resolved from the vertical exactly as createSite() does, rather than set by hand — a
        // seed that hardcodes the pair cannot catch a broken mapping.
        template: resolveForVertical(spec.vertical).template,
        theme: resolveForVertical(spec.vertical).theme,
        brand: spec.brand ?? {},
        questionnaire: spec.answers,
        content,
        notify_email: OWNER,
        // Deliberately NOT launched: these are fixtures and must never be publicly reachable.
        launched_at: null,
      })
      .select('id')
      .single()
    if (error) throw new Error(`insert failed for ${spec.slug}: ${error.message}`)

    for (let i = 0; i < spec.photos; i++) {
      const body = await placeholder('Photo', i)
      const path = `${site.id}/photo-${i + 1}.jpg`
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, body, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw new Error(`upload failed for ${path}: ${upErr.message}`)

      await supabase.from('lead_engine_photos').insert({
        site_id: site.id,
        storage_path: path,
        sort_order: i,
        bytes: body.length,
        content_type: 'image/jpeg',
      })
    }
    console.log(`  ✓ ${spec.photos} photos uploaded`)
  }

  const base = process.env.REVIEW_BASE_URL ?? 'http://localhost:3001'
  console.log(APPLY ? '\n✓ Seeded. Read these as a customer would:' : '\nDry run — add --apply to write.')
  for (const spec of SITES) console.log(`  ${base}/sites/${spec.slug}`)
  if (APPLY) {
    console.log('\nWhen finished:')
    console.log('  node --env-file=.env.local --import ./scripts/test-resolver.mjs scripts/seed-lead-engine-review.mjs --cleanup --apply')
  }
}

const run = CLEANUP ? cleanup : seed
run().catch(e => { console.error(`\n✗ ${e.message}`); process.exitCode = 1 })

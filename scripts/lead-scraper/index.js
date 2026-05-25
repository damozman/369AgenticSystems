#!/usr/bin/env node
/**
 * 369 Agentic Systems — Dental Practice Lead Scraper
 *
 * Usage:
 *   node index.js --city="Dallas" --state="TX"
 *   node index.js --city="Austin" --state="TX" --limit=25
 *
 * Output:
 *   ../output/leads-dallas-2026-05-25.csv
 */

require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const { createObjectCsvWriter } = require('csv-writer');
const minimist = require('minimist');
const path = require('path');
const fs = require('fs');

// ─── Config ──────────────────────────────────────────────────────────────────

const args = minimist(process.argv.slice(2));
const CITY = args.city;
const STATE = args.state;
const LIMIT = parseInt(args.limit || 50);
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
].join(',');

// Pages to check on each practice website for contact info
const CONTACT_PAGES = ['', '/contact', '/about', '/team', '/staff', '/our-team', '/about-us', '/contact-us'];

// Email patterns in HTML that are almost certainly not real emails
const EMAIL_NOISE = [
  'example.com', 'sentry.io', 'wixpress.com', 'wordpress.com',
  'jquery', 'schema.org', 'w3.org', '@2x', '.png', '.jpg', '.svg',
];

// ─── Google Places API ────────────────────────────────────────────────────────

async function fetchPlacesPage(query, pageToken = null) {
  const body = { textQuery: query, maxResultCount: 20 };
  if (pageToken) body.pageToken = pageToken;

  const res = await axios.post(PLACES_URL, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    timeout: 10000,
  });
  return res.data;
}

// Multiple query terms to exceed the 20-result-per-query cap
const QUERY_VARIANTS = [
  'dental practice near {city}, {state}',
  'dentist office near {city}, {state}',
  'family dentistry near {city}, {state}',
  'cosmetic dentist near {city}, {state}',
  'general dentistry near {city}, {state}',
  'dental clinic near {city}, {state}',
];

async function fetchAllPlaces(city, state, limit) {
  const seen = new Set();
  const places = [];

  for (const template of QUERY_VARIANTS) {
    if (places.length >= limit) break;

    const query = template.replace('{city}', city).replace('{state}', state);
    let pageToken = null;

    while (places.length < limit) {
      const data = await fetchPlacesPage(query, pageToken);
      const batch = data.places || [];

      for (const p of batch) {
        if (places.length >= limit) break;
        if (!seen.has(p.id)) {
          seen.add(p.id);
          places.push(p);
        }
      }

      process.stdout.write(`\r  Fetched ${places.length} unique practices so far...`);

      if (!data.nextPageToken || batch.length === 0) break;
      pageToken = data.nextPageToken;
      await sleep(1000);
    }

    await sleep(500); // Brief pause between query variants
  }

  console.log('');
  return places;
}

// ─── Website Scraping ─────────────────────────────────────────────────────────

async function getPageHtml(url) {
  const res = await axios.get(url, {
    timeout: 5000,
    maxRedirects: 3,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  return res.data;
}

function extractEmail(html) {
  const matches = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  if (!matches) return null;

  return (
    matches.find(
      (e) =>
        !EMAIL_NOISE.some((noise) => e.toLowerCase().includes(noise)) &&
        e.length < 60
    ) || null
  );
}

function extractDoctorName(text) {
  // Match "Dr. FirstName LastName" or "Dr FirstName LastName"
  const match = text.match(/Dr\.?\s+([A-Z][a-zA-Z'\-]+)\s+([A-Z][a-zA-Z'\-]+)/);
  if (match) return { firstName: match[1], lastName: match[2] };

  // Fallback: "Doctor FirstName LastName" in headings
  const match2 = text.match(/Doctor\s+([A-Z][a-zA-Z'\-]+)\s+([A-Z][a-zA-Z'\-]+)/);
  if (match2) return { firstName: match2[1], lastName: match2[2] };

  return null;
}

async function scrapeWebsite(websiteUrl) {
  const result = { firstName: '', lastName: '', email: '', emailSource: '' };

  const base = websiteUrl.replace(/\/$/, '');

  for (const page of CONTACT_PAGES) {
    try {
      const html = await getPageHtml(base + page);
      const $ = cheerio.load(html);
      const bodyText = $('body').text();

      if (!result.email) {
        const found = extractEmail(html);
        if (found) {
          result.email = found;
          result.emailSource = 'scraped';
        }
      }

      if (!result.firstName) {
        const name = extractDoctorName(bodyText);
        if (name) {
          result.firstName = name.firstName;
          result.lastName = name.lastName;
        }
      }

      // Stop early if we have everything
      if (result.email && result.firstName) break;

    } catch {
      // Blocked or not found — skip this page
    }

    await sleep(400);
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function parseAddress(formatted) {
  // "123 Main St, Dallas, TX 75001, USA"
  const parts = formatted.split(', ');
  const address = parts[0] || '';
  const city = parts[1] || '';
  const stateZip = parts[2] || '';
  const state = stateZip.split(' ')[0] || '';
  return { address, city, state };
}

function buildEmailFallback(firstName, domain) {
  if (!domain) return { email: '', notes: '' };
  const fn = (firstName || '').toLowerCase();
  if (fn) {
    return {
      email: `${fn}@${domain}`,
      notes: `Unverified. Also try: info@${domain}, office@${domain}`,
    };
  }
  return {
    email: `info@${domain}`,
    notes: `Unverified. Also try: office@${domain}, contact@${domain}`,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!CITY || !STATE) {
    console.error('\nUsage: node index.js --city="Dallas" --state="TX" [--limit=50]\n');
    process.exit(1);
  }
  if (!API_KEY) {
    console.error('\nMissing GOOGLE_PLACES_API_KEY. Add it to .env\n');
    process.exit(1);
  }

  console.log(`\n369 Dental Lead Scraper`);
  console.log(`Target : ${CITY}, ${STATE}  |  Limit: ${LIMIT}`);
  console.log(`${'─'.repeat(45)}\n`);

  // Step 1: Pull practice list from Google Places
  console.log('Step 1/2 — Fetching practices from Google Places...');
  const places = await fetchAllPlaces(CITY, STATE, LIMIT);
  console.log(`         ${places.length} practices found.\n`);

  // Step 2: Scrape each website
  console.log('Step 2/2 — Scraping practice websites for contact info...\n');
  const results = [];

  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    const name = p.displayName?.text || 'Unknown';
    const { address, city, state } = parseAddress(p.formattedAddress || '');
    const website = p.websiteUri || '';
    const domain = extractDomain(website);

    process.stdout.write(`  [${String(i + 1).padStart(2)}/${places.length}] ${name.slice(0, 45).padEnd(45)}`);

    let scraped = { firstName: '', lastName: '', email: '', emailSource: '' };
    if (website) {
      scraped = await scrapeWebsite(website);
    }

    let email = scraped.email;
    let emailSource = scraped.emailSource;
    let notes = '';

    if (!email) {
      const fallback = buildEmailFallback(scraped.firstName, domain);
      email = fallback.email;
      emailSource = 'pattern';
      notes = fallback.notes;
    }

    results.push({
      firstName: scraped.firstName,
      lastName: scraped.lastName,
      practiceName: name,
      address,
      city,
      state,
      phone: p.nationalPhoneNumber || '',
      website,
      email,
      emailSource,
      notes,
    });

    process.stdout.write(scraped.email ? ' [email found]\n' : ' [pattern]\n');

    await sleep(1200); // Polite rate limiting between sites
  }

  // Step 3: Write CSV
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(':', '');
  const safeCity = CITY.toLowerCase().replace(/\s+/g, '-');
  const filename = `leads-${safeCity}-${date}-${time}.csv`;
  const outputPath = path.join(outputDir, filename);

  const writer = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'firstName',    title: 'First Name'    },
      { id: 'lastName',     title: 'Last Name'     },
      { id: 'practiceName', title: 'Practice Name' },
      { id: 'address',      title: 'Address'       },
      { id: 'city',         title: 'City'          },
      { id: 'state',        title: 'State'         },
      { id: 'phone',        title: 'Phone'         },
      { id: 'website',      title: 'Website'       },
      { id: 'email',        title: 'Email'         },
      { id: 'emailSource',  title: 'Email Source'  },
      { id: 'notes',        title: 'Notes'         },
    ],
  });

  await writer.writeRecords(results);

  // Summary
  const countScraped  = results.filter((r) => r.emailSource === 'scraped').length;
  const countPattern  = results.filter((r) => r.emailSource === 'pattern').length;
  const countMissing  = results.filter((r) => !r.email).length;

  console.log(`\n${'─'.repeat(45)}`);
  console.log(`Done. ${results.length} leads written to:`);
  console.log(`  ${outputPath}\n`);
  console.log(`Email breakdown:`);
  console.log(`  Scraped from website : ${countScraped}`);
  console.log(`  Pattern (unverified) : ${countPattern}`);
  console.log(`  None found           : ${countMissing}`);
  console.log(`\nFor "pattern" rows, verify with Hunter.io before sending.`);
  console.log(`hunter.io/email-finder — free tier: 50 lookups/month\n`);
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  if (err.response) {
    console.error('API response:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});

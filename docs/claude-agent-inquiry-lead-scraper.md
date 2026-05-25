# Lead Scraper Build Inquiry — Claude Agent (VS)
**From:** Chris + Claude.ai (External)
**To:** Claude Agent (Local VS Environment)
**Re:** Build a dental practice lead scraper for cold email outreach
**Date:** 2026-05-24

---

## CONTEXT

Chris is launching sales Monday (May 27). He needs a list of dental practice leads (practice name, owner name, email, phone, address) in CSV format to import into Google Sheets for cold email tracking.

Instead of manual research (4-6 hours), we want an automated scraper that can generate 50-100+ qualified leads in one run.

---

## THE REQUEST

**Build a Node.js / Puppeteer script that:**

1. **Search Google Maps** for "dentist near [CITY], [STATE]"
   - Get first 50-100 results
   - Extract: Practice name, address, phone, website URL

2. **Visit each practice website**
   - Scrape practice owner/manager name (from "About," "Team," "Contact" pages)
   - Look for email address on website (if available)
   - Look for LinkedIn profile link (practice page or owner profile)

3. **Email discovery** (one of these approaches):
   - Try standard email patterns: firstname@practicedomin.com, owner@domain.com, info@domain.com
   - Use Hunter.io API if we have a key (optional, fallback)
   - Or just output what we found and Chris manually fills in emails via Hunter.io

4. **Output CSV** with exactly these columns:
   ```
   First Name,Last Name,Practice Name,Address,City,State,Phone,Website,Email,LinkedIn Profile
   ```

5. **Error handling:**
   - Skip sites that block scraping (just move to next)
   - Timeout after 5 seconds per site (don't hang)
   - Log errors but continue running

---

## TECHNICAL CONSTRAINTS

- Use Puppeteer (headless Chrome) to handle JavaScript-heavy sites
- Use Cheerio for parsing HTML (faster than Puppeteer for simple scraping)
- Rate limit: Wait 1-2 seconds between requests (don't hammer servers)
- Use a proxy or user-agent rotation if available (avoid blocks)
- Output should be a clean CSV file (no special characters breaking CSV)

---

## QUESTIONS FOR YOU

### Q1: Email Discovery Strategy
Should we:
- A) Try to scrape emails from websites (fastest, might miss many)
- B) Output email patterns only (Chris fills in via Hunter.io, slower but accurate)
- C) Integrate Hunter.io API if Chris has a key (best quality, costs money)

**Recommendation:** Option B for MVP. Option C if Chris has Hunter.io credits.

### Q2: Geographic Scope
Should the script:
- A) Hardcode city/state in the script (user modifies code each run)
- B) Accept command-line arguments (node scraper.js --city="Dallas" --state="Texas")
- C) Have a simple config file (user edits config.json)

**Recommendation:** Option B (cleanest for reuse)

### Q3: How Many Results?
Should we:
- A) Target 50 results per run (safe, fast, ~10-15 min runtime)
- B) Target 100 results per run (longer runtime, ~20-30 min)
- C) Paginate indefinitely (could run forever)

**Recommendation:** Option A (50 per run, Chris can run multiple times)

---

## REALISTIC ASSESSMENT

**Build time:** 4-6 hours focused work
**Testing time:** 1-2 hours (debugging scraping issues, handling edge cases)
**Runtime per scrape:** 10-15 minutes to get 50 leads

**What this will give us:**
- 50-100 qualified dental practice leads per run
- CSV output that imports directly to Google Sheets
- Reusable script (can run for different cities/states)
- Saves Chris 4-6 hours of manual research

**What might not work perfectly:**
- Some websites will be hard to scrape (complex JS, paywalls, robots.txt blocks)
- Email discovery will be incomplete (most dentists don't publish emails on website)
- LinkedIn profiles might be hard to extract (LinkedIn blocks scraping)

**So Chris will likely need to manually fill in emails via Hunter.io for 50% of results. But that's still faster than manual research.**

---

## IMMEDIATE NEED

Chris needs this by Wednesday (May 29) to have leads for Week 2 outreach.

He can start Monday (May 27) with manual list of 15-20 practices (Hunter.io free tier), send those emails, and use the scraper output for next batch Wednesday-Friday.

---

## FINAL ASK

**Build the lead scraper. Your call on:**
1. Email discovery approach (recommend: scrape attempts, fallback to patterns, Chris fills in rest)
2. CLI vs config file (recommend: CLI with `--city` and `--state` args)
3. Result count (recommend: 50 per run, configurable)

**Then:**
- Test it locally with a small search (5-10 practices in one city)
- Output a clean CSV
- Share the code + instructions for running it

**Chris will:**
- Run it for his target cities (starting with [his city])
- Import CSV to Google Sheets
- Fill in missing emails via Hunter.io free tier (50 lookups)
- Launch cold email campaign Wednesday-Friday

---

**This unblocks the sales motion and gets us 50+ leads by Wednesday instead of waiting for manual research to finish.**

Let me know if you want to adjust the spec or have questions.

Thank you.

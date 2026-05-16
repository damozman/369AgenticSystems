# 369 Agentic Systems — Master Tool Stack & Operations Playbook
**Source of Truth for Business Infrastructure, AI Workforce Roles, and Financial Optimization**

---

## 1. Core Architectural Strategy
To build an uncancelable digital agency, 369 Agentic Systems operates on a strict **Walled Garden Architecture**. We do not sell fragile, temporary "automation flows" to clients. Instead, we provide them with a custom web-based client environment. 
- **The Core Rule:** High-volume, client-facing automated tasks execute securely and cost-effectively in the cloud.
- **The Security Rule:** Heavy intellectual property design, coding, financial data, and high-level strategy remain entirely localized to the private workstation.

---

## 2. The Three-Layer Software Stack

### Layer 1: The Command Center (The Face)
- **Technology:** Next.js 14 App Router
- **Hosting Platform:** Vercel Production Environment
- **Operational Purpose:** This is the visual dashboard and software platform for the business. It houses the private client login gates, the secure API routing endpoints, and your signature Cyber-Noir / Gold "Intelligence Feed" terminal UI. 
- **Zero-Touch Policy:** Static industry-specific marketing pages reside strictly in the `/public` directory to preserve raw loading speed and isolate them completely from the Next.js compilation/CSS engine.

### Layer 2: The Intelligence Vault (The Brain)
- **Technology:** Supabase (PostgreSQL)
- **Operational Purpose:** Act as the central database, state-persistence layer, and permanent memory vault for both the platform and its AI agents.
- **Key Infrastructures:** - **SSR Auth & PKCE Handlers:** Secures client sessions cleanly through production middleware.
  - **Custom SMTP Integration:** Directly wired via verified email providers to guarantee 100% deliverability for transactional notifications, bypassing global spam filters.
  - **Database Schemas:** Houses the structured tables for lead storage, background process logs, and incoming audit metrics.

### Layer 3: The Assembly Line (The Muscle)
- **Technology:** Gumloop Pro
- **Operational Purpose:** A cloud-hosted execution environment built to scale background workflows effortlessly. 
- **Behavior:** Operates 24/7 in the cloud without requiring your local workstation to remain turned on. It catches webhooks, interacts with external customer APIs, parses data footprints, and pushes structured results back into the Supabase database.

---

## 3. The Digital Workforce (The AI Org Chart)

To keep business execution completely organized, AI entities are treated as specialized digital employees with defined tool boundaries, execution environments, and optimized model-pricing models.

              ┌────────────────────────────────────────┐
              │          HUMAN OPERATOR (YOU)          │
              └───────────────────┬────────────────────┘
                                  │
        ┌─────────────────────────┴─────────────────────────┐
        ▼ (Local Cockpit)                                   ▼ (Cloud Automation)
┌───────────────────────────────────────┐           ┌───────────────────────────────────────┐
│              CEO AGENT                │           │             HERMES AGENT              │
│        (Gemini 2.5 Pro Model)         │           │        (Gemini 2.5 Flash Model)       │
│  Orchestration, Blueprint Strategy    │           │     Cloud Couriers, Live Webhooks     │
└───────────────────┬───────────────────┘           └───────────────────┬───────────────────┘
│                                                   │
▼ (Local Engineering)                               ▼ (Database Sync)
┌───────────────────────────────────────┐           ┌───────────────────────────────────────┐
│             CLAUDEBOT                 │           │           SUPABASE DATABASE           │
│       (Claude Sonnet 4.6 Model)       │◄─────────►│         (Central Memory Vault)    │
│  Autonomous Development & Code Base   │           │      Cyber-Noir Intelligence Feed     │
└───────────────────────────────────────┘           └───────────────────────────────────────┘


### Role 1: The CEO Agent (The Strategic Think-Tank)
- **Execution Environment:** Local Workspace Command-Line Engine (Via Gemini CLI)
- **Underlying Model:** `Gemini 2.5 Pro` (Leveraging its elite logical comprehension and massive context window).
- **Core Mandate:** Acts as your internal, high-level business partner. It analyzes full structural documents (like `projectblueprint.md`), plans out new corporate solutions, enforces budget caps, and maps out scaling targets. 
- **Operational Boundary:** The CEO does not write raw code files directly. It acts strictly as an orchestrator, creating precise task instructions and delegating them to the technical branch.

### Role 2: Claudebot (The Lead Software Engineer)
- **Execution Environment:** Local Engineering Stack (OpenHands Sandbox Environment / VS Code Native Extensions)
- **Underlying Model:** `Claude Sonnet 4.6` (The gold standard for logical accuracy, code layout generation, and deep file refactoring).
- **Core Mandate:** Takes technical tickets and system requirements issued by you or the CEO Agent and executes them directly within your local code repositories.
- **Operational Boundary:** Operates inside a secure, sandboxed environment on your laptop. It reads abstract syntax trees, writes features, tests dependencies, and packages clean Git commits to deploy changes live to your Vercel production repository.

### Role 3: Hermes (The Cloud Operations Courier)
- **Execution Environment:** Cloud Pipelines (Gumloop Automation Workflows)
- **Underlying Model:** `Gemini 2.5 Flash / Flash-Lite` (Chosen for maximum execution speed and hyper-optimized pricing fractions).
- **Core Mandate:** Lives permanently in the cloud. Hermes monitors live client lead sheets, executes inbound technical audits, calculates ROI metrics across the 9 critical keys, and instantly beams that data straight into your central Supabase database.
- **Operational Boundary:** Has zero access to your local machine, your private strategic blueprints, or your primary source code. It handles high-volume out-on-the-web execution cleanly, quietly, and endlessly.

---

## 4. Token & Cost Optimization Strategy
To keep operations hyper-lean, we intentionally avoid flat, expensive SaaS middleman tools. We run an API-driven consumption model optimized by task weight:

1. **Strategic Tasks (Deep Input / Low Frequency):** Allocated to `Gemini 2.5 Pro`. We pass multi-page blueprints into its context window only when running systemic reviews, keeping premium costs down to precise execution spikes.
2. **Coding Tasks (High Logic / Medium Frequency):** Allocated to `Claude Sonnet 4.6`. Using API tokens locally ensures you only pay for the exact lines written and tested, bypassing heavy monthly developer platform seat subscriptions.
3. **Operational Tasks (Massive Volume / Continuous Frequency):** Allocated to `Gemini 2.5 Flash / Flash-Lite`. At a cost of pennies per million tokens, your live background processes, stream feeds, webhook logs, and automated databases can churn constantly without draining your financial resources.

---

## 5. Daily Operations Hand-Off Protocol

When running the business day-to-day, follow this repeatable 3-step loop:

1. **The Strategy Stage:** You and the **CEO Agent** map out an expansion inside your local cockpit. The CEO generates a comprehensive development ticket.
2. **The Engineering Stage:** **Claudebot** reads the ticket locally, writes the required components into your Next.js folder layout, tests the build, and pushes the clean code to GitHub to trigger Vercel's production deployment.
3. **The Automated Execution Stage:** The updated web portal goes live. **Hermes** runs around the clock out in the cloud catching webhooks, firing data packets, and updating the central **Supabase Database**—which immediately streams beautiful live success logs straight into your visual Cyber-Noir Intelligence Feed.
Lead Engine – Full Implementation Brief
(For your coding agent – Feature branch only)
1. Product Objective (Read this first)
We are building Lead Engine, a new product line inside the existing 369 Agentic Systems platform.
Business goal:
A fixed-scope, professionally designed mini-site + lead form + simple customer dashboard that:

Helps local service businesses (roofing, HVAC, plumbing, rentals, etc.) capture leads and look credible online
Generates standalone recurring revenue ($297/$497 setup + $69/month)
Creates a natural, low-friction path to later activate Ava (the voice booking agent)
Must work fully even if the customer never activates Ava

Key constraints from planning:

Stay inside the existing monorepo
Reuse auth, dashboard shell, Supabase patterns, email utilities, and lead concepts wherever possible
Multi-tenant with strong row-level security
Service/licensing model (we host while they pay; export on cancellation)
Templates only (3 designs), limited customization, hard limits on photos and revisions
First version must support real customer delivery (questionnaire → polished site → live → dashboard)

2. Integration with Current System
We intentionally reuse:

Existing authentication and user/client identity
Dashboard layout and navigation patterns
Supabase client and migration style
Email sending utilities
Any existing lead storage patterns (or extend them cleanly)
Vercel deployment and domain handling approach
Admin protection patterns you already use

We create new:

lead_engine_* tables and related storage
Public site rendering routes
Questionnaire flow
Lead Engine specific admin pages
Customer-facing Lead Engine dashboard section
Photo handling for this product
Template components

Future connection (design for it, do not fully build yet):
Site submissions and customer identity should be structured so that activating Ava later is mostly a configuration/flag change + using existing agent tooling, not a redesign.
3. Non-Goals for This Implementation

Full visual page builder
Unlimited customization
Complex analytics
Automated quarterly email cron (foundation only)
Complete Ava activation UI
Domain registrar integration
Mobile apps or separate codebases

4. Technical Plan (Phased)
Phase 1 – Foundation
Database tables + RLS, TypeScript types, basic site service, dynamic public route that can render a live site (even if placeholder at first).
Phase 2 – Templates
Three template components driven by site data. Public page renders the correct one.
Phase 3 – Questionnaire
Tokenized or linked form that captures the agreed questions and stores answers on the site record.
Phase 4 – Public Lead Form
Form on the live site writes submissions and notifies the business owner.
Phase 5 – Customer Dashboard
Submissions list, basic metrics, change-request form.
Phase 6 – Photos
Storage, limits, display in gallery.
Phase 7 – Internal Admin
List + edit experience so a site can go from questionnaire data to live without raw SQL.
5. Mandatory First Action for the Agent
Before writing any code, the agent must:

Review the current repo structure (especially app/, lib/, supabase/, dashboard, auth, and any existing lead-related code).
List every assumption it is making about how the current system works.
Ask all clarifying or planning questions it has about:
Existing tables and identity model
How clients/users are currently represented
Email utilities
Dashboard protection
Domain/subdomain handling already in use
Any conflicts with the proposed folder or table names
Anything in this brief that appears to contradict current code or patterns


Only after those questions are answered (or explicitly deferred) should implementation of Phase 1 begin.
# 3six9 Agentic Systems: Master Operations Blueprint

This document serves as the absolute, unchanging single source of truth for the 3six9 Agentic Systems architecture. All software development layers, database schemas, and autonomous workforce layers must align with the parameters defined herein.

---

## 1. Core Architectural Strategy

The system is separated into two distinct operational layers:
1. **The Infrastructure Building:** The Next.js web application, Supabase database layers, and Vercel hosting platform. This defines the physical paths, static files, and security schemas of the portal.
2. **The Autonomous Workforce:** The external digital agents (OpenHands, Flowise, and Hermes via Gumloop) that execute tasks, perform audits, and route data. They interact with the infrastructure but do not alter its core Next.js structural layouts.

---

## 2. Dashboard Log Auditing Schema (The 9 Critical Keys)

When data streams from the cloud automation layers into the live dashboard, payloads must adhere strictly to this target database schema. This structure ensures identical data translation across all pipelines.

### Data Table: `system_audits`

| Key Name | Data Type | UI Visibility | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `audit_id` | UUID (Primary Key) | Yes | Unique transaction string generated per execution run. |
| `client_domain` | VARCHAR(255) | Yes | The verified web address of the target business. |
| `security_score` | INT | Yes | Technical rating (0-100) assessing SSL, headers, and endpoints. |
| `seo_visibility` | NUMERIC(5,2) | Yes | Percentage metric capturing search footprint presence. |
| `lead_velocity` | INT | Yes | Estimated monthly volume of client customer touchpoints. |
| `leak_detected` | BOOLEAN | Yes | True/False flag checking if the target system exposes errors. |
| `roi_multiplier` | NUMERIC(4,2) | Yes | Leverage coefficient showing financial impact of deployment. |
| `payload_status` | VARCHAR(50) | Internal | Verification token (`success`, `pending`, `failed`). |
| `timestamp` | TIMESTAMPTZ | Yes | Global microsecond timestamp tracking the execution run. |

---

## 3. Workstation Directory Matrix

To maintain clean local state handling and prevent package cross-contamination, the workspace directories are mapped as follows:

---

## 4. Operational Pipeline Flow

[ Cloud Audit Layer ] ──( Hermes via Gumloop )──► [ API Ingestion Endpoint ]
│
▼
[ Live Feed UI ] ◄───────( Next.js Dashboard )◄─────── [ Supabase DB ]


1. **Intake:** External data payloads are assembled in the cloud.
2. **Ingestion:** Data hits the Next.js API route group, validating against the 9 Critical Keys.
3. **Persistence:** Validated data commits cleanly to the Supabase PostgreSQL instance.
4. **Observation:** The auto-scrolling Cyber-Noir/Gold dashboard updates in real-time for the Human Operator.
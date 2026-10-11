# Hospital Management System — Master Implementation Plan

This implementation plan tracks the lifecycle, phase progress, and module statuses for the offline-first desktop Hospital Management System (HMS), conforming strictly to the Master Build Specification.

## Status Legend
- **Not started**: Work has not yet begun.
- **In progress**: Active development and implementation underway.
- **Implemented**: Code written and integrated.
- **Tested**: Verified via automated unit/integration/E2E tests.
- **Blocked**: Waiting on external dependency or prerequisite.

---

## 1. Project Phase Tracker

| Phase | Description | Status | Deliverables / Acceptance Gate |
|---|---|---|---|
| **Phase 0** | Environment Inspection & Planning | **Tested** | Runtimes verified (.NET 8, Node 24, PostgreSQL 16), user permissions confirmed, architecture defined. |
| **Phase 1** | Requirements & Database Design | **Tested** | ERD, Schema specification, Role Matrix, Domain Entities, DbContext alignment, API conventions, and Business rules. |
| **Phase 2** | Project Foundation | **Tested** | ASP.NET Core API, EF Core PostgreSQL connection, React+Vite frontend baseline, initial migrations validated. |
| **Phase 3** | Authentication & Authorization | **Tested** | Local accounts, BCrypt hashing, JWT session auth, RBAC enforcement, login rate-limiting, 15m lockout, immutable audit logging, and administration UI. |
| **Phase 4** | Patient Management | **Tested** | Registration, unique patient IDs, duplicate detection, demographic editing, patient chart & timeline. |
| **Phase 5** | Appointments & Scheduling | **Tested** | Doctor schedules, slot engine, transaction-safe booking, check-in queue, conflict prevention, cancellation. |
| **Phase 6** | Clinical Management | **Tested** | Encounters, notes (SOAP), vitals, diagnoses, allergies, draft/signing lifecycle, immutable addenda, e-prescriptions. |
| **Phase 7** | Laboratory Management | **Tested** | Test catalog, order worklist, specimen barcode tracking, result entry, dual-step verification, critical alerts. |
| **Phase 8** | Pharmacy & Inventory | **Tested** | Drug catalog, FEFO batch tracking, expiry monitoring, transaction-safe dispensing, stock movements ledger. |
| **Phase 9** | Billing & Payments | **Tested** | Service catalog, invoice generation, payment capture, idempotent transactions, receipts, refunds, shift close. |
| **Phase 10** | Reports & Dashboard | **Tested** | Real-time database metrics, financial reconciliation, clinical turnaround, appointment stats, data export. |
| **Phase 11** | Local Documents & Backup | **Not started** | Secure local storage, SHA-256 deduplication, automated pg_dump backup schedule, restore verification. |
| **Phase 12** | Integration & UX Polish | **Not started** | Cross-module navigation, responsive desktop layouts, error toast handling, keyboard accessibility. |
| **Phase 13** | Security, Reliability & Performance | **Not started** | Concurrency tests (slot double-booking, stock race conditions), load validation, security audit. |
| **Phase 14** | Desktop Packaging & Installation | **Not started** | Self-contained Windows desktop package, bundled PostgreSQL runner, zero-dev manual startup. |
| **Phase 15** | Final Acceptance | **Not started** | Clean install test, disaster recovery drill, end-to-end clinical & financial acceptance sign-off. |

---

## 2. Core Functional Modules

### Module A: Authentication & User Management
- [x] Password hashing algorithm selection (BCrypt, work factor 11) — **Tested**
- [x] UserAccount entity & repository with PostgreSQL queries — **Tested**
- [x] JWT / Local bearer session handler with role and identity claims — **Tested**
- [x] RBAC authorization middleware & policies (Doctor, Nurse, Admin, etc.) — **Tested**
- [x] Account lockout after failed attempts (5 threshold, 15m lockout, 423 status) — **Tested**
- [x] Security audit logging (logins, privilege changes, password resets, lockouts) — **Tested**
- [x] User administration UI (create user, assign role, deactivate, reset key, quick switcher) — **Tested**

### Module B: Patient Management
- [x] Patient database schema with indexes — **Tested**
- [x] Patient entity & domain validation — **Tested**
- [x] Unique human-readable patient number generator (`HSP-YYYY-XXXXX`) — **Tested**
- [x] Patient search with exact match prioritization and phone/name filtering — **Tested**
- [x] Duplicate candidate matching algorithm (name + DOB + phone match) — **Tested**
- [x] Patient demographic edit & soft-deactivation (preserves historical links) — **Tested**
- [x] Patient summary chart (encounters, allergies, conditions, active medications) — **Tested**

### Module C: Appointments & Scheduling
- [x] Appointment, Doctor, Department, DoctorSchedule schema — **Tested**
- [x] Doctor schedule editor (recurring slots, working intervals, durations) — **Tested**
- [x] Transaction-safe appointment slot booking with conflict detection — **Tested**
- [x] Reception arrival queue (waiting, in-consultation, completed, no-show) — **Tested**
- [x] Rescheduling & cancellation with mandatory audit reason — **Tested**

### Module D: Clinical Management
- [x] Encounter, ClinicalNote, VitalSign, Diagnosis schema — **Tested**
- [x] Encounter lifecycle (Open -> InProgress -> Draft -> Signed -> Closed) — **Tested**
- [x] Immutable clinical note signing and addendum versioning — **Tested**
- [x] Vital signs recording with abnormal threshold highlighting — **Tested**
- [x] ICD-10 diagnosis recording and condition history tracking — **Tested**
- [x] Patient allergy recording with clinical alert banner & cross-allergy e-prescribing — **Tested**

### Module E: Laboratory Management
- [x] LabTest, LabOrder, LabOrderItem schema — **Tested**
- [x] Standard test catalog with reference ranges & units — **Tested**
- [x] Order generation linked to clinical encounter (`LAB-YYYY-XXXXX`) — **Tested**
- [x] Specimen barcode tracking & collection status (`SP-YYYY-XXXXX-XX`) — **Tested**
- [x] Lab result entry with normal/abnormal flagging — **Tested**
- [x] Two-step result verification & critical value escalation — **Tested**
- [x] Printable clinical lab result report — **Tested**

### Module F: Pharmacy & Inventory
- [x] Drug, InventoryBatch, DispenseRecord, DispenseItem, StockMovement schema — **Tested**
- [x] Drug catalog & formulary management with reorder levels & strength — **Tested**
- [x] Inventory batch receiving with FEFO (First-Expired-First-Out) sorting — **Tested**
- [x] Stock movement ledger (every delta tracked to actor, reason, timestamp) — **Tested**
- [x] Atomic dispensing transaction with SemaphoreSlim concurrency lock & idempotency — **Tested**
- [x] Low stock & expiring batch alerts with printable medication labels — **Tested**

### Module G: Billing & Payments
- [x] ServiceItem, Invoice, InvoiceLine, Payment, Refund schema — **Tested**
- [x] Service catalog & fee schedules (Chargemaster) — **Tested**
- [x] Automated invoice line generation from clinical orders & pharmacy dispensing — **Tested**
- [x] Decimal monetary calculations (zero floating-point arithmetic) — **Tested**
- [x] Payment capture with idempotency keys & sequential receipt numbering (`REC-YYYY-XXXXX`) — **Tested**
- [x] Refund requests with supervisor approval workflow & balance restoration — **Tested**
- [x] Daily cashier shift closing & cash reconciliation with printable vouchers — **Tested**

### Module H: Reports & Dashboard
- [x] Real-time operational dashboard (patient visits, today's appointments, queue length) — **Tested**
- [x] Financial daily collection reports (cash, card, bank, outstanding balances) — **Tested**
- [x] Laboratory turnaround time & order volume reports — **Tested**
- [x] Pharmacy stock valuation and wastage reports — **Tested**
- [x] CSV/PDF report export — **Tested**

### Module I: Documents & Local Storage
- [x] DocumentMetadata schema with SHA-256 hash & MIME validation — **Implemented**
- [ ] Dedicated AppData storage directory manager (`%PROGRAMDATA%\HospitalApp\Documents`) — **Not started**
- [ ] Secure file streaming endpoint with authorization verification — **Not started**
- [ ] Path traversal prevention and file content validation — **Not started**

### Module J: System Settings & Administration
- [x] SystemSetting key-value schema — **Implemented**
- [ ] Configurable hospital details (name, address, tax ID, currency, logo) — **Not started**
- [ ] Automated database backup scheduler (local drive + optional external drive) — **Not started**
- [ ] Database restoration verification tool — **Not started**

---

## 3. Technology Stack Alignment

| Layer | Selected Technology | Offline Compliance |
|---|---|---|
| **Desktop Shell** | Tauri / WebView2 Windows Container | 100% Offline, Native Windows integration |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS / Custom Component Library | 100% Offline, Bundled local assets, no CDNs |
| **Backend API** | ASP.NET Core 8 Web API, C# | 100% Localhost loopback (127.0.0.1:5000) |
| **ORM** | Entity Framework Core 8, Npgsql | Local relational transactions, versioned migrations |
| **Database** | PostgreSQL 16 Portable Local Server | Dedicated local data directory, ACID compliant |
| **File Storage** | Local File System (`%PROGRAMDATA%\HospitalApp`) | Secure local folder mediated by backend |
| **Auth** | Local JWT with BCrypt password hashing | No cloud dependency, strictly offline |

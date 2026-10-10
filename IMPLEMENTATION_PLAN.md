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
| **Phase 5** | Appointments & Scheduling | **Not started** | Doctor schedules, slot engine, transaction-safe booking, check-in queue, conflict prevention, cancellation. |
| **Phase 6** | Clinical Management | **Not started** | Encounters, notes (SOAP), vitals, diagnoses, allergies, draft/signing lifecycle, immutable addenda. |
| **Phase 7** | Laboratory Management | **Not started** | Test catalog, order worklist, specimen barcode tracking, result entry, dual-step verification, critical alerts. |
| **Phase 8** | Pharmacy & Inventory | **Not started** | Drug catalog, FEFO batch tracking, expiry monitoring, transaction-safe dispensing, stock movements ledger. |
| **Phase 9** | Billing & Payments | **Not started** | Service catalog, invoice generation, payment capture, idempotent transactions, receipts, refunds, shift close. |
| **Phase 10** | Reports & Dashboard | **Not started** | Real-time database metrics, financial reconciliation, clinical turnaround, appointment stats, data export. |
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
- [x] Appointment, Doctor, Department, DoctorSchedule schema — **Implemented**
- [ ] Doctor schedule editor (recurring slots, working intervals, durations) — **Not started**
- [ ] Transaction-safe appointment slot booking with conflict detection — **Not started**
- [ ] Reception arrival queue (waiting, in-consultation, completed, no-show) — **Not started**
- [ ] Rescheduling & cancellation with mandatory audit reason — **Not started**

### Module D: Clinical Management
- [x] Encounter, ClinicalNote, VitalSign, Diagnosis schema — **Implemented**
- [ ] Encounter lifecycle (Open -> InProgress -> Draft -> Signed -> Closed) — **Not started**
- [ ] Immutable clinical note signing and addendum versioning — **Not started**
- [ ] Vital signs recording with abnormal threshold highlighting — **Not started**
- [ ] ICD-10 diagnosis recording and condition history tracking — **Not started**
- [ ] Patient allergy recording with clinical alert banner — **Not started**

### Module E: Laboratory Management
- [x] LabTest, LabOrder, LabOrderItem schema — **Implemented**
- [ ] Standard test catalog with reference ranges & units — **Not started**
- [ ] Order generation linked to clinical encounter — **Not started**
- [ ] Specimen barcode tracking & collection status — **Not started**
- [ ] Lab result entry with normal/abnormal flagging — **Not started**
- [ ] Two-step result verification & critical value escalation — **Not started**
- [ ] Printable lab result report — **Not started**

### Module F: Pharmacy & Inventory
- [x] Drug, InventoryBatch, DispenseRecord, DispenseItem, StockMovement schema — **Implemented**
- [ ] Drug catalog & formulary management — **Not started**
- [ ] Inventory batch receiving with FEFO (First-Expired-First-Out) sorting — **Not started**
- [ ] Stock movement ledger (every delta tracked to actor, reason, timestamp) — **Not started**
- [ ] Atomic dispensing transaction (atomic decrement + dispense item + invoice link) — **Not started**
- [ ] Low stock & expiring batch alerts — **Not started**

### Module G: Billing & Payments
- [x] ServiceItem, Invoice, InvoiceLine, Payment, Refund schema — **Implemented**
- [ ] Service catalog & fee schedules — **Not started**
- [ ] Automated invoice line generation from clinical orders & pharmacy dispensing — **Not started**
- [ ] Decimal monetary calculations (zero floating-point arithmetic) — **Not started**
- [ ] Payment capture with idempotency keys & sequential receipt numbering — **Not started**
- [ ] Refund requests with supervisor approval workflow — **Not started**
- [ ] Daily cashier shift closing & cash reconciliation — **Not started**

### Module H: Reports & Dashboard
- [ ] Real-time operational dashboard (patient visits, today's appointments, queue length) — **Not started**
- [ ] Financial daily collection reports (cash, card, bank, outstanding balances) — **Not started**
- [ ] Laboratory turnaround time & order volume reports — **Not started**
- [ ] Pharmacy stock valuation and wastage reports — **Not started**
- [ ] CSV/PDF report export — **Not started**

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

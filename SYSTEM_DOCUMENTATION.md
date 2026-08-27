# MIS Datacenter Portal — Complete System Documentation

> **Version:** 0.2.0  
> **Last Updated:** August 25, 2026  
> **Platform:** Next.js 16 (App Router + Turbopack) + PostgreSQL + Redis + MinIO  
> **Organization:** DGHS (Directorate General of Health Services) — MIS Division  
> **Production URL:** `http://datacenter.dghs.gov.bd`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Architecture](#3-project-architecture)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [Approval Workflow Engine & In-Flight Modifications](#7-approval-workflow-engine--in-flight-modifications)
8. [Server Actions Reference](#8-server-actions-reference)
9. [API Routes Reference](#9-api-routes-reference)
10. [4-Tier Role-Based Dashboards & Frontend Pages](#10-4-tier-role-based-dashboards--frontend-pages)
11. [Notification System](#11-notification-system)
12. [Email Service & Final Execution Notifications](#12-email-service--final-execution-notifications)
13. [File Storage (MinIO)](#13-file-storage-minio)
14. [Caching & Rate Limiting (Redis)](#14-caching--rate-limiting-redis)
15. [Audit Logging & History Trail](#15-audit-logging--history-trail)
16. [Reporting & Analytics](#16-reporting--analytics)
17. [Export System](#17-export-system)
18. [Security](#18-security)
19. [Infrastructure & Deployment](#19-infrastructure--deployment)
20. [Environment Configuration](#20-environment-configuration)
21. [Seed Data & Initial Setup](#21-seed-data--initial-setup)
22. [Cron Jobs](#22-cron-jobs)
23. [Live Subsystem Health Monitoring Engine](#23-live-subsystem-health-monitoring-engine)

---

## 1. System Overview

The **MIS Datacenter Portal** is an enterprise-grade infrastructure request management system built for the DGHS (Directorate General of Health Services) MIS Division. It digitizes the full lifecycle of virtual machine provisioning — from request submission through a multi-level approval chain to VM provisioning and ongoing management.

### Core Capabilities

| Capability | Description |
|---|---|
| **VM Request Management** | Submit, track, and manage requests for new VMs, cloned VMs, K8s namespaces, and virtual IPs |
| **Multi-Level Approval Workflow** | Configurable 4-level approval chain (Section Officer → Deputy Director → Director MIS → DC Operations) |
| **VM Inventory Management** | Track all provisioned VMs with specs, IP addresses, hostnames, and lifecycle status |
| **Hardware Asset Inventory** | Track physical assets (servers, routers, switches, firewalls, storage, UPS) |
| **Software License Management** | Track license expiry, maintenance windows, and vendor information |
| **VM Customization** | Request resource changes (CPU, RAM, storage, firewall rules) for existing VMs with separate approval flow |
| **Decommission Workflow** | Formal process for retiring VMs with approval chain |
| **Renewal Tracking** | VM renewal period tracking with automated expiry alerts |
| **Role-Based Dashboards** | Contextual dashboards for Requesters, Approvers, DC Operations, and Admins |
| **Audit Trail** | Comprehensive logging of all user actions and state changes |
| **Email Notifications** | SMTP-based email alerts for approval requests, status changes, and provisioning |
| **Reporting & Analytics** | Visual reports on VM distribution, hardware utilization, approval pipeline, and user activity |
| **Data Export** | CSV, Excel, and PDF export for all reports and data tables |

### Request Types Supported

| Type | Code | Description |
|---|---|---|
| New Virtual Machine | `NEW_VM` | Provision a new VM with specified resources |
| Clone VM | `CLONE_VM` | Create a copy of an existing VM |
| K8s Namespace | `K8S_NAMESPACE` | Provision a Kubernetes namespace |
| Virtual IP | `VIRTUAL_IP` | Assign a public or private virtual IP address |
| Customization | `CUSTOMIZED` | Modify resources of an existing VM |
| Renewal | `RENEWAL` | Renew an expiring VM allocation |
| Decommission | `DECOMMISSION` | Retire and remove a VM |

---

## 2. Technology Stack

### Core Framework

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 14.2.23 |
| **Language** | TypeScript | ^5 |
| **Runtime** | React | ^18 |
| **Database** | PostgreSQL | 16 (Alpine) |
| **ORM** | Prisma Client | ^7.2.0 |
| **Authentication** | NextAuth.js (Credentials) | ^4.24.13 |
| **Cache / Rate Limiting** | Redis (ioredis) | 7 (Alpine) |
| **Object Storage** | MinIO | Latest |
| **Containerization** | Docker + Docker Compose | Multi-stage build |

### Frontend Libraries

| Library | Purpose |
|---|---|
| **Radix UI** | Headless primitives — Dialog, Select, Tabs, Checkbox, Radio, Switch, Progress, Label, Slot |
| **Tailwind CSS** | Utility-first styling (^3.4.1) with `tailwindcss-animate` |
| **Framer Motion** | Animation library for UI transitions |
| **Lucide React** | Icon system |
| **@tanstack/react-table** | Headless table with sorting, filtering, pagination |
| **Recharts** | Dashboard charts and analytics visualizations |
| **Sonner** | Toast notification system |
| **react-hook-form** | Performant form state management |
| **nextjs-toploader** | Navigation progress bar |
| **use-debounce** | Input debouncing hook |
| **usehooks-ts** | TypeScript React hooks collection |

### Backend / Utility Libraries

| Library | Purpose |
|---|---|
| **bcryptjs** | Password hashing |
| **nodemailer** | SMTP email sending with retry logic |
| **minio** | S3-compatible object storage client |
| **pg** | PostgreSQL driver (native adapter for Prisma) |
| **@prisma/adapter-pg** | Prisma PostgreSQL adapter using `pg` pool |
| **zod** | Runtime schema validation (^4.3.4) |
| **xlsx** | Excel file parsing and generation |
| **sharp** | Image optimization |
| **date-fns** | Date formatting and manipulation |
| **crypto** | AES-256-CBC encryption for SMTP passwords |

---

## 3. Project Architecture

### Directory Structure

```
d:\datacenter\
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (Geist fonts, Sidebar, Toaster)
│   │   ├── page.tsx                  # Root redirect → /dashboard
│   │   ├── globals.css               # Global styles
│   │   ├── loading.tsx               # Global loading spinner
│   │   ├── actions/                  # Server Actions (23 files)
│   │   │   ├── request-actions.ts    # VM request CRUD (42KB — largest)
│   │   │   ├── approval-actions.ts   # Approval workflow logic (36KB)
│   │   │   ├── vm-actions.ts         # VM provisioning & management
│   │   │   ├── vm-management-actions.ts # VM lifecycle operations
│   │   │   ├── customization-actions.ts # VM customization requests
│   │   │   ├── clone-actions.ts      # VM cloning operations
│   │   │   ├── decommission-actions.ts # VM decommission workflow
│   │   │   ├── k8s-actions.ts        # Kubernetes namespace requests
│   │   │   ├── vip-actions.ts        # Virtual IP requests
│   │   │   ├── user-actions.ts       # User CRUD & role management
│   │   │   ├── report-actions.ts     # Report generation
│   │   │   ├── report-tabular-actions.ts # Tabular report data
│   │   │   ├── dashboard-actions.ts  # Dashboard statistics
│   │   │   ├── home-actions.ts       # Home page data
│   │   │   ├── admin-actions.ts      # Admin panel operations
│   │   │   ├── asset-actions.ts      # Hardware asset CRUD
│   │   │   ├── license-actions.ts    # Software license CRUD
│   │   │   ├── inventory-actions.ts  # Inventory queries
│   │   │   ├── settings-actions.ts   # System settings management
│   │   │   ├── audit-actions.ts      # Audit log queries
│   │   │   ├── analytics-actions.ts  # Analytics data
│   │   │   ├── notification-actions.ts # Notification management
│   │   │   └── file-actions.ts       # File operations
│   │   ├── admin/                    # Admin panel
│   │   │   ├── layout.tsx            # Admin layout
│   │   │   ├── page.tsx              # Admin dashboard
│   │   │   ├── users/                # User management
│   │   │   ├── workflows/            # Approval workflow configuration
│   │   │   ├── settings/             # System settings
│   │   │   ├── email-settings/       # SMTP configuration
│   │   │   ├── audit/                # Audit log viewer
│   │   │   └── audit-logs/           # Detailed audit logs
│   │   ├── api/                      # API Route Handlers
│   │   │   ├── auth/[...nextauth]/   # NextAuth.js endpoint
│   │   │   ├── admin/                # Admin APIs (health, settings)
│   │   │   ├── requests/             # Request CRUD API
│   │   │   ├── inventory/            # Inventory stats API
│   │   │   ├── files/[...path]/      # File download proxy (MinIO)
│   │   │   ├── cron/                 # Scheduled tasks
│   │   │   │   ├── vm-expiry/        # VM renewal expiry check
│   │   │   │   └── license-expiry/   # License expiry alerts
│   │   │   └── profile/              # User profile API
│   │   ├── auth/                     # Login page
│   │   ├── dashboard/                # Dashboard page
│   │   ├── requests/                 # Request management
│   │   │   ├── page.tsx              # Request list view
│   │   │   ├── new/                  # New request form
│   │   │   ├── [id]/                 # Request detail view
│   │   │   ├── customize/            # Customization request
│   │   │   └── decommission/         # Decommission request
│   │   ├── approvals/                # Approval queue
│   │   │   ├── page.tsx              # Approval list
│   │   │   └── [id]/                 # Approval detail + action
│   │   ├── inventory/                # Inventory management
│   │   │   ├── page.tsx              # Inventory overview
│   │   │   ├── vms/                  # VM inventory list & detail
│   │   │   ├── assets/               # Hardware asset management
│   │   │   └── licenses/             # Software license management
│   │   ├── my-vms/                   # User's own VMs
│   │   │   ├── page.tsx              # My VM list
│   │   │   └── [vmId]/               # My VM detail
│   │   ├── reports/                  # Reports & analytics
│   │   ├── notifications/            # Notification center
│   │   ├── profile/                  # User profile management
│   │   ├── unauthorized/             # 403 page
│   │   └── providers/                # Client-side providers
│   ├── components/
│   │   ├── Navbar.tsx                # Top navigation bar
│   │   ├── Sidebar.tsx               # Responsive sidebar navigation
│   │   ├── NotificationBell.tsx      # Real-time notification bell
│   │   ├── SearchBar.tsx             # Global search
│   │   ├── Pagination.tsx            # Pagination component
│   │   ├── StatusBadge.tsx           # Colored status indicator
│   │   ├── Loader.tsx               # Loading spinner
│   │   ├── RouteLoader.tsx           # Route change indicator
│   │   ├── skeletons.tsx             # Skeleton loading states
│   │   ├── ui/                       # Shadcn/UI components (18 files)
│   │   ├── dashboard/                # Dashboard widgets
│   │   │   ├── SummaryStatCard.tsx    # Metric card
│   │   │   ├── PermissionGate.tsx    # Role-based UI gating
│   │   │   ├── RoleSwitcher.tsx      # Role view switcher
│   │   │   ├── DashboardSkeleton.tsx # Loading state
│   │   │   ├── dashboardRegistry.tsx # Widget registry
│   │   │   └── widgets/              # Dashboard widget collection
│   │   ├── analytics/                # Analytics visualization
│   │   │   ├── InventoryChart.tsx    # Inventory bar/pie charts
│   │   │   ├── RecentActivity.tsx    # Activity feed
│   │   │   ├── StatCard.tsx          # Analytics stat card
│   │   │   └── StatusDistribution.tsx # Status donut chart
│   │   ├── charts/                   # Chart components
│   │   │   └── ResourceGauge.tsx     # Resource usage gauge
│   │   ├── alerts/                   # Alert components
│   │   └── vms/                      # VM-specific components
│   ├── context/
│   │   └── LoadingContext.tsx         # Global loading state
│   ├── lib/
│   │   ├── authOptions.ts            # NextAuth configuration
│   │   ├── auth.ts                   # Auth utility helpers
│   │   ├── prisma.ts                 # Prisma client (pg adapter)
│   │   ├── redis.ts                  # Redis client + cache utilities
│   │   ├── roles.ts                  # RBAC role definitions & checks
│   │   ├── workflow.ts               # Approval workflow engine
│   │   ├── notifications.ts          # Notification creation & dispatch
│   │   ├── email.ts                  # SMTP email service
│   │   ├── rate-limit.ts             # Redis sliding window rate limiter
│   │   ├── api-response.ts           # Standardized API response helpers
│   │   ├── validation.ts             # VM access validation
│   │   ├── export-utils.ts           # CSV, Excel, PDF export
│   │   ├── utils.ts                  # cn() + isAdmin() utilities
│   │   ├── services/
│   │   │   ├── minio.service.ts      # MinIO object storage service
│   │   │   ├── notification.service.ts # Notification service layer
│   │   │   └── role.service.ts       # Role management service
│   │   ├── validations/
│   │   │   └── utils.ts              # Validation utilities
│   │   ├── admin/                    # Admin-specific utilities
│   │   ├── analytics/                # Analytics computation
│   │   ├── dashboard/                # Dashboard data aggregation
│   │   ├── errors/                   # Error handling utilities
│   │   ├── notifications/            # Notification utilities
│   │   ├── reports/                  # Report generation logic
│   │   ├── types/                    # Internal lib types
│   │   └── utils/
│   │       └── logger.ts             # Structured logging utility
│   ├── types/                        # TypeScript type definitions
│   │   ├── enums.ts                  # All business enums (14 enums)
│   │   ├── requests.ts               # Request-related types
│   │   ├── vm.ts                     # VM-related types
│   │   ├── inventory.ts              # Inventory types
│   │   ├── approvals.ts              # Approval types
│   │   ├── reports.ts                # Report types
│   │   ├── dashboard.ts              # Dashboard types
│   │   ├── users.ts                  # User types
│   │   ├── audit.ts                  # Audit log types
│   │   ├── customization.ts          # Customization types
│   │   ├── merge-requests.ts         # Merge request types
│   │   ├── responses.ts              # API response types
│   │   ├── index.ts                  # Type barrel exports
│   │   └── next-auth.d.ts            # NextAuth module augmentation
│   └── proxy.ts                       # Auth and rate limiting network boundary (Next.js 16)
├── prisma/
│   ├── schema.prisma                 # Database schema (595 lines, 20 models)
│   ├── seed.ts                       # Database seeder
│   └── seed.sql                      # SQL seed data
├── data/                             # Seed data files
│   ├── UserList.json                 # User seed data
│   ├── VmList.json                   # VM seed data
│   ├── server_req.csv                # Request history
│   └── server_req.xlsx               # Request spreadsheet
├── scripts/
│   ├── check-minio.ts                # MinIO connectivity check
│   └── check-workflows.ts            # Workflow configuration check
├── docker-compose.yml                # Multi-service orchestration
├── Dockerfile                        # Multi-stage production build
├── next.config.mjs                   # Next.js config (standalone output)
└── package.json                      # Dependencies & scripts
```

### Architectural Patterns

1. **Server Actions Pattern** — All business logic lives in `src/app/actions/` as Next.js Server Actions (23 files, ~220KB of logic). These are called directly from React components without intermediate API routes.

2. **API Routes** — Used only for external-facing endpoints (auth, file download, cron webhooks, CRUD APIs that need REST semantics).

3. **Prisma with pg Adapter** — Uses `@prisma/adapter-pg` with a native `pg` connection pool for optimal PostgreSQL performance.

4. **Redis-Backed Caching** — Read-through cache with configurable TTL; graceful fallback when Redis is unavailable.

5. **MinIO Object Storage** — S3-compatible file storage for attachments (security reports, Software Requirements Specification (SRS) documents).

6. **Role-Based Dashboard Registry** — Dashboard widgets are registered per role and rendered conditionally.

---

## 4. Database Schema

### Entity-Relationship Overview

```
User ──┬── UserRole ── Role
       ├── Request ──┬── Approval
       │             ├── Attachment
       │             ├── AdditionalDisk
       │             ├── FirewallPort
       │             ├── NetworkAccessEntry
       │             ├── VmSpec
       │             ├── VmInstance
       │             └── CustomizationRequest
       ├── VmInstance ──┬── VmSpec (current + history)
       │               ├── CustomizationRequest
       │               ├── CustomizationHistory
       │               └── AuditLog
       ├── Notification
       └── AuditLog

Asset ──── VmInstance (host mapping)
SoftwareLicense ──── Asset

ApprovalWorkflow (configurable per request type)
SystemSetting (key-value configuration store)
```

### Models (20 total)

#### User
System user with multi-role support.

| Field | Type | Description |
|---|---|---|
| `id` | String (UUID) | Primary key |
| `name` | String | Full name |
| `email` | String | Unique login email |
| `password` | String | bcrypt-hashed password |
| `designation` | String? | Job title |
| `organization` | String? | Organization/department |
| `contact` | String? | Phone number |
| `isActive` | Boolean | Account active flag |

#### Role / UserRole
Many-to-many role assignment.

| Role Name | Description |
|---|---|
| `REQUESTER` | Can submit VM requests |
| `DEVELOPER` | Developer role |
| `APPROVER_L1` | Level 1 approver (Section Officer) |
| `APPROVER_L2` | Level 2 approver (Deputy Director) |
| `APPROVER_L3` | Level 3 approver (Director MIS) |
| `APPROVER_L4` | Level 4 approver (escalation) |
| `DC_OPS` | Data Center Operations (provisioning) |
| `ADMIN` | System administrator |

#### Request
Core entity for all infrastructure requests.

| Field | Type | Description |
|---|---|---|
| `id` | String (UUID) | Primary key |
| `requestType` | RequestType | `NEW_VM`, `CLONE_VM`, `K8S_NAMESPACE`, `VIRTUAL_IP`, `CUSTOMIZED`, `RENEWAL`, `DECOMMISSION` |
| `status` | RequestStatus | Current workflow status |
| `requestId` | String? | Human-readable ID (auto-generated) |
| `projectName` | String? | Project name |
| `systemName` | String | System/application name |
| `purpose` | String | Request justification |
| `environment` | Environment | `DEVELOPMENT`, `STAGING`, `PRODUCTION`, `TESTING` |
| `quantity` | Int | Number of VMs requested |
| `serverType` | ServerType | `APPLICATION`, `MAIL`, `DATABASE`, `FTP`, `OTHER` |
| `vcpu` | Int? | Requested vCPU count |
| `ramGb` | Int? | Requested RAM in GB |
| `storageGb` | Int? | Requested storage in GB |
| `osName` / `osVersion` | String? | Operating system details |
| `osLicenseBy` | LicenseProvider? | `REQUESTER`, `PARTNER`, `OPEN_SOURCE` |
| `subdomain` | String? | Requested subdomain |
| `sslProvider` | SSLProvider? | `REQUESTER` or `MIS` |
| `requiredPublicIP` | Boolean | Whether public IP is needed |
| `vpnRequired` | Boolean | VPN access requirement |
| `frontendTech` / `backendTech` | String? | Technology stack info |
| `dataBase` | String? | Database technology |
| `expectedEndDate` | DateTime? | Project end date |
| `renewalRequired` | Boolean | Whether renewal is needed |
| `renewalPeriodMonths` | Int? | Renewal period in months |
| `vaReportSubmitted` | Boolean | Vulnerability assessment report uploaded |
| `justificationSubmitted` | Boolean | Software Requirements Specification (SRS) document uploaded |
| `credentialsDelivered` | Boolean | Whether VM credentials were delivered |
| `sourceVmId` | String? | Source VM for clone operations |
| `targetVmId` | String? | Target VM for decommission |
| `kubernetesOption` | Boolean | K8s namespace requested |
| `kubernetesNamespace` | String? | K8s namespace name |
| `virtualIpType` | String? | `PUBLIC` or `PRIVATE` |
| `assignedIpAddress` | String? | Assigned IP address |

**Alternative contact fields:** `alternativePersonName`, `alternativePersonDesignation`, `alternativePersonOrganization`, `alternativePersonContact`, `alternativePersonEmail`

**Developer fields:** `developerId`, `developerName`, `developerDesignation`, `developerOrganization`, `developerContact`, `developerEmail`

#### VmInstance
A provisioned virtual machine.

| Field | Type | Description |
|---|---|---|
| `id` | String (UUID) | Primary key |
| `requestId` | String? | Originating request |
| `sequenceNumber` | Int | VM number within a request |
| `ownerId` | String? | FK to User |
| `hostname` | String? | Unique hostname |
| `ipAddress` | String? | Unique private IP |
| `publicIpAddress` | String? | Public IP if assigned |
| `status` | VmStatus | `ACTIVE`, `SUSPENDED`, `RETIRED` |
| `environment` | Environment? | Deployment environment |
| `subdomain` | String? | Assigned subdomain |
| `renewalDate` | DateTime? | Next renewal date |
| `decommissionedAt` | DateTime? | When decommissioned |
| `hasRemoteAccess` | Boolean | Remote access enabled |
| `vpnRequired` | Boolean | VPN access required |
| `currentSpecId` | String? | FK to current VmSpec |
| `hostAssetId` | String? | FK to physical host Asset |

**Unique constraint:** `(requestId, sequenceNumber)`

#### VmSpec
Resource specification snapshot for a VM (versioned).

| Field | Type | Description |
|---|---|---|
| `id` | String (UUID) | Primary key |
| `vmInstanceId` | String | FK to VmInstance |
| `vcpu` | Int | CPU core count |
| `ramGb` | Int | RAM in GB |
| `storageGb` | Int | Storage in GB |
| `osName` / `osVersion` | String? | Operating system |
| `raid` | Raid? | `RAID0`, `RAID1`, `RAID5`, `RAID10`, `NONE` |
| `effectiveFrom` | DateTime | When this spec became active |
| `appliedById` | String? | Who applied this spec |
| `sourceRequestId` | String? | Originating request |
| `customizationRequestId` | String? | If from a customization |

Each VmSpec also has child collections: `VmSpecDisk`, `VmSpecFirewallPort`, `VmSpecNetworkAccess`.

#### CustomizationRequest
Request to modify an existing VM's resources.

| Field | Type | Description |
|---|---|---|
| `id` | String (UUID) | Primary key |
| `targetVmId` | String | VM to customize |
| `vcpu` / `ramGb` / `storageGb` | Int? | Requested new values |
| `status` | CustomizationStatus | Workflow status |
| `purpose` | String? | Reason for change |
| `requesterId` | String? | Who requested |

Has its own approval chain, additional disk inputs, firewall port inputs, and network access inputs.

#### CustomizationHistory
Audit trail of VM spec changes over time.

| Field | Type | Description |
|---|---|---|
| `vmId` | String | FK to VmInstance |
| `beforeSpecId` | String | Previous VmSpec |
| `afterSpecId` | String | New VmSpec |
| `appliedById` | String? | Who applied the change |
| `reason` | String? | Change reason |

#### Approval
Individual approval decision within a workflow.

| Field | Type | Description |
|---|---|---|
| `entityType` | ApprovalEntityType | `REQUEST` or `CUSTOMIZATION` |
| `level` | Int | Approval level (1-4) |
| `approverId` | String | FK to User |
| `decision` | ApprovalDecision | `PENDING`, `APPROVED`, `REJECTED`, `RETURNED`, `FORWARDED` |
| `comments` | String? | Approver's remarks |
| `requestId` | String? | FK to Request |
| `customizationRequestId` | String? | FK to CustomizationRequest |

#### Asset
Physical hardware asset in the datacenter.

| Field | Type | Description |
|---|---|---|
| `type` | AssetType | `SERVER`, `ROUTER`, `SWITCH`, `FIREWALL`, `STORAGE`, `UPS`, `CONSOLE_SERVER`, `OTHER` |
| `name` | String | Asset name |
| `vendor` / `model` | String? | Manufacturer details |
| `serial` | String? | Unique serial number |
| `location` | String? | Physical location |
| `warrantyExpiry` | DateTime? | Warranty end date |
| `cpuCores` / `ramGb` / `storageGb` | Int? | Hardware specs (for servers) |
| `interfaces` / `throughputGbps` | Int? / Float? | Network specs |
| `capacityTb` / `noOfDisks` | Float? / Int? | Storage specs |

#### SoftwareLicense
Software license tracking.

| Field | Type | Description |
|---|---|---|
| `name` | String | License name |
| `vendor` | String | Vendor name |
| `expiryDate` | DateTime? | License expiration |
| `maintenanceExpiry` | DateTime? | Maintenance contract end |
| `type` | String | License type |

**Unique constraint:** `(name, vendor)`

#### ApprovalWorkflow
Configurable approval chain per request type.

| Field | Type | Description |
|---|---|---|
| `requestType` | String | e.g., `NEW_VM`, `DECOMMISSION` |
| `level` | Int | Step number in the chain |
| `role` | String | Required role |
| `roleLabel` | String? | Human-readable label |
| `isFinal` | Boolean | Whether this is a terminal approval level |

**Unique constraint:** `(requestType, level)`

#### SystemSetting
Key-value store for runtime configuration.

| Field | Type | Description |
|---|---|---|
| `key` | String | Primary key (e.g., `smtp_host`, `smtp_password`) |
| `value` | String | Setting value |
| `category` | String | `general`, `smtp`, `storage` |
| `isSecret` | Boolean | Whether value should be masked |

#### Notification
In-app notification system.

| Field | Type | Description |
|---|---|---|
| `userId` | String | FK to recipient |
| `type` | String | Notification type |
| `message` | String | Notification text |
| `link` | String? | Deep link URL |
| `isRead` | Boolean | Read status |

#### AuditLog
Comprehensive action tracking.

| Field | Type | Description |
|---|---|---|
| `actorId` | String | FK to User who performed the action |
| `action` | String | Action identifier |
| `entityType` | String? | Entity type affected |
| `entityId` | String? | Entity ID affected |
| `details` | Json? | Structured event data |
| `vmId` | String? | Related VM if applicable |

---

## 5. Authentication & Authorization

### Authentication Flow

```
┌──────────┐     ┌──────────────┐     ┌────────┐     ┌──────────┐
│  Client   │────>│  NextAuth.js │────>│ Prisma │────>│   User   │
│  (Login)  │<────│  Credentials │<────│ Query  │<────│  Table   │
└──────────┘     └──────────────┘     └────────┘     └──────────┘
                        │
                   JWT Token
              (id, email, name, roles,
               designation, organization,
               contact)
```

**Login Sequence:**
1. User submits email + password to `/api/auth/[...nextauth]`
2. `authorize()` finds user by email with roles eagerly loaded
3. Verifies password with `bcrypt.compare()`
4. Checks `isActive` flag
5. Extracts role names: `user.roles.map(ur => ur.role.name)`
6. Returns JWT containing full user profile + role array

**Session Data:** The JWT token carries `id`, `email`, `name`, `designation`, `contact`, `organization`, and `roles[]`.

### Middleware

The proxy network boundary (`src/proxy.ts`) runs on every request and handles:

1. **JWT Token Extraction** — `getToken()` from `next-auth/jwt` (with custom generic cookie names)
2. **API Rate Limiting** — All non-auth API routes are rate-limited via Redis (100 req/min)
3. **Authentication Redirects:**
   - Authenticated user visiting `/auth` → redirect to `/`
   - Unauthenticated user visiting any protected page → redirect to `/auth`

---

## 6. Role-Based Access Control (RBAC)

### Role Hierarchy

| Role | Label | Capabilities |
|---|---|---|
| `ADMIN` | System Admin | Full system access, user management, settings, workflows |
| `DC_OPS` | DC Operations | VM provisioning, inventory management, asset management |
| `APPROVER_L1` | Section Officer | Level 1 approvals |
| `APPROVER_L2` | Deputy Director | Level 2 approvals |
| `APPROVER_L3` | Director MIS | Level 3 approvals (final for most request types) |
| `APPROVER_L4` | Escalation Approver | Level 4 approvals (escalation) |
| `REQUESTER` | Requester | Submit requests, view own VMs |
| `DEVELOPER` | Developer | Linked as developer on requests |

### Role Check Functions

| Function | Description |
|---|---|
| `isManagementRole(roles)` | Returns true for ADMIN, DC_OPS, or any APPROVER |
| `canManageInventory(roles)` | Returns true only for ADMIN or DC_OPS |
| `hasRole(roles, target)` | Checks if user has a specific role |
| `canUserApproveAtLevel(roles, level)` | Checks if user can approve at a specific level |
| `canUserApprove(roles, level)` | Level-string variant ("L1", "L2", "L3", "L4", "DCOPS") |
| `isAdmin(roles)` | Returns true for any management role |

### Access Control Matrix

| Feature | ADMIN | DC_OPS | APPROVER | REQUESTER |
|---|:---:|:---:|:---:|:---:|
| Submit Requests | ✅ | ❌ | ❌ | ✅ |
| Approve Requests | ✅ | ❌ | ✅ (by level) | ❌ |
| Provision VMs | ✅ | ✅ | ❌ | ❌ |
| View All Requests | ✅ | ✅ | ✅ | Own only |
| Manage Inventory | ✅ | ✅ | ❌ | ❌ |
| Manage Assets | ✅ | ✅ | ❌ | ❌ |
| Manage Licenses | ✅ | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ | Limited |
| Audit Logs | ✅ | ❌ | ❌ | ❌ |
| View Own VMs | ✅ | ✅ | ✅ | ✅ |

---

## 7. Approval Workflow Engine & In-Flight Modifications

### Architecture

The workflow engine (`src/lib/workflow.ts`) is a **configurable, multi-level approval system** that supports different approval chains per request type.

### Default Workflow Configuration

#### Standard Requests (NEW_VM, CLONE_VM, K8S_NAMESPACE, VIRTUAL_IP, CUSTOMIZED, RENEWAL, VPN_ACCESS, HORIZON_ACCESS)

```
Level 1: APPROVER_L1 (Section Officer)      → Can forward to L2
Level 2: APPROVER_L2 (Deputy Director)       → Can forward to L3
Level 3: APPROVER_L3 (Director MIS)          → Final approval
Level 4: DC_OPS (DCOPS)                      → Execution/Provisioning
```

#### Decommission Requests

```
Level 1: APPROVER_L1 (Section Officer)       → Final approval
Level 2: DC_OPS (DCOPS)                      → Execution
```

### Status Transitions

```
DRAFT → PENDING_L1 → PENDING_L2 → PENDING_L3 → APPROVED → PROVISIONED → CLOSED
                                                    ↓
                                              PARTIALLY_PROVISIONED
                    
Any PENDING_Lx → REJECTED (terminal)
Any PENDING_Lx → RETURNED (back to requester for modification with revision notes)
RETURNED → (Requester amends & resubmits) → PENDING_L1 (re-enters workflow)
```

### Approval Decisions

| Decision | Effect |
|---|---|
| `APPROVED` | Advances to next level, or marks request as APPROVED if final level |
| `REJECTED` | Terminates the workflow; request status becomes REJECTED |
| `RETURNED` | Sends request back to requester with required revision notes |
| `FORWARDED` | Skips to next approval level (e.g. L3 forwarding to L4 Director) |

### In-Flight Request Modifications (Approver Quick Adjustments)

In high-throughput environments, minor requested parameter changes (such as downsizing RAM from 64GB to 32GB or pruning 1 test VM out of 3 from a Horizon/VPN access request) should **not** force the request back to `DRAFT` and restart the approval chain.

The platform provides atomic **In-Flight Modifications** during approval review:

1. **Horizon & VPN Resource Pruning**:
   - Approvers can uncheck/remove individual VMs or namespaces directly from `requestResources`.
   - The pruned items are removed from the database in an atomic transaction.
2. **Resource Resizing**:
   - Approvers can adjust `vcpu`, `ramGb`, `storageGb`, and `quantity` for VM, Upgrade, and K8s requests.
   - Associated `vmSpecifications` are synchronized simultaneously.
3. **Audit Diff Recording**:
   - Computes explicit change diffs (e.g., `RAM: 64GB → 32GB`, `Removed Resources: [winsvr-02]`).
   - Automatically writes a `REQUEST_MODIFIED_IN_FLIGHT` record in `AuditLog`.
4. **Requester Notification**:
   - Dispatches in-app notification and email to the requester stating: *"Your request was approved with modifications by [Approver Name]: [Diff summary]"*.

### Workflow Functions

| Function | Description |
|---|---|
| `getWorkflowConfig(requestType)` | Get workflow config (DB → cache → defaults) |
| `getAllWorkflowConfigs()` | Get all workflow configs |
| `getNextLevel(currentLevel, workflow)` | Get the next approval level |
| `getLevelByRole(role, workflow)` | Find level by role name |
| `getTotalLevels(workflow)` | Count total levels |
| `canForward(level, workflow)` | Whether current level can forward |
| `getStatusForLevel(level)` | Map level number to status string |
| `isFinalLevel(level, workflow)` | Check if this is the final approval |
| `isExecutionLevel(level, workflow)` | Check if this is a DC_OPS execution level |
| `modifyAndApproveRequest(params)` | Atomically adjust request resources and approve with audit diffs |
| `updateRequestInFlight(id, mods, notes)` | Save in-flight parameter adjustments without immediate approval |
| `initializeDefaultWorkflows()` | Seed all default workflow configs |

### Caching

- Workflow configs are cached in memory/Redis with a **5-minute TTL**
- Cache is automatically invalidated on workflow CRUD operations
- Fallback to defaults if database is unavailable

---

## 8. Server Actions Reference

The system uses **Server Action files** containing all business logic. Here is a summary by domain:

### Request Management

| File | Key Functions |
|---|---|
| `request-actions.ts` | `createRequest()`, `updateRequest()`, `submitRequest()`, `getRequests()`, `getDetailedRequest()` (with `auditLogs` & `requestResources`), `getRequestsForApproval()` |
| `clone-actions.ts` | `createCloneRequest()`, `getSourceVmDetails()` |
| `k8s-actions.ts` | `createK8sNamespaceRequest()`, `submitK8sRequest()`, `executeK8sRequest()` |
| `access-actions.ts` | `createAccessRequest()`, `executeVpnRequestDirect()`, `executeHorizonRequestDirect()` |
| `vip-actions.ts` | `createVirtualIpRequest()`, `submitVipRequest()` |
| `decommission-actions.ts` | `createDecommissionRequest()`, `executeDecommission()` |
| `customization-actions.ts` | `createCustomizationRequest()`, `submitCustomization()`, `applyCustomization()` |

### Approval Workflow & In-Flight Modification

| File | Key Functions |
|---|---|
| `approval-actions.ts` | `handleApprovalDecision()`, `forwardToLevel()`, `modifyAndApproveRequest()`, `updateRequestInFlight()`, `executeRequest()`, `executeRequestWithVmInputs()` |

### VM Management

| File | Key Functions |
|---|---|
| `vm-actions.ts` | `provisionVm()`, `getVmDetails()`, `updateVmStatus()`, `getVmsByOwner()` |
| `vm-management-actions.ts` | `suspendVm()`, `reactivateVm()`, `transferOwnership()`, `updateHostMapping()` |

### Inventory & Assets

| File | Key Functions |
|---|---|
| `inventory-actions.ts` (3KB) | `getInventoryStats()`, `getInventoryOverview()` |
| `asset-actions.ts` (5KB) | `createAsset()`, `updateAsset()`, `deleteAsset()`, `getAssets()` |
| `license-actions.ts` (4KB) | `createLicense()`, `updateLicense()`, `deleteLicense()`, `getLicenses()` |

### Administration

| File | Key Functions |
|---|---|
| `admin-actions.ts` (6KB) | `getAdminOverview()`, `getSystemHealth()` |
| `user-actions.ts` (14KB) | `createUser()`, `updateUser()`, `deleteUser()`, `assignRole()`, `removeRole()`, `resetPassword()` |
| `settings-actions.ts` (5KB) | `getSettings()`, `updateSettings()`, `getSmtpSettings()`, `updateSmtpSettings()` |
| `audit-actions.ts` (2KB) | `getAuditLogs()`, `createAuditEntry()` |

### Reporting & Dashboard

| File | Key Functions |
|---|---|
| `dashboard-actions.ts` (3KB) | `getDashboardStats()`, `getRecentActivity()` |
| `home-actions.ts` (7KB) | `getHomeData()`, `getStatusCounts()` |
| `report-actions.ts` (18KB) | `getVmReport()`, `getApprovalReport()`, `getHardwareReport()`, `getUserReport()` |
| `report-tabular-actions.ts` (15KB) | `getTabularVmData()`, `getTabularRequestData()`, `getTabularApprovalData()` |
| `analytics-actions.ts` (1KB) | `getAnalyticsData()` |
| `notification-actions.ts` (2KB) | `getNotifications()`, `markAsRead()`, `markAllAsRead()` |
| `file-actions.ts` (1KB) | `getFileUrl()` |

---

## 9. API Routes Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/[...nextauth]` | NextAuth.js credential authentication |

### Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/requests` | Authenticated | List requests with filters |
| `GET` | `/api/requests/[id]` | Authenticated | Get request details |

### Inventory

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/inventory/stats` | DC_OPS+ | Inventory statistics |

### Files

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/files/[...path]` | Authenticated | Download file from MinIO via presigned URL |

### Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/health` | Admin | System health check (DB, Redis, MinIO) |
| `GET/PUT` | `/api/admin/settings` | Admin | System settings CRUD |
| `GET` | `/api/admin/backup` | Admin | Full database backup export (all 44 models) |
| `POST` | `/api/admin/backup` | Admin | Full database restore with dependency-ordered reinsertion |

### Profile

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET/PUT` | `/api/profile` | Authenticated | User profile management |

### Cron Jobs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cron/vm-expiry` | Check VM renewal expirations |
| `GET` | `/api/cron/license-expiry` | Check software license expirations |

---

## 10. 4-Tier Role-Based Dashboards & Frontend Pages

### 4-Tier Role-Based Actionable Dashboards

The portal features four dedicated, role-tailored dashboard experiences driven by `src/components/dashboard/dashboardRegistry.tsx` and optimized with Redis caching (10-second TTL):

```
                       ┌──────────────────────┐
                       │   /dashboard Entry   │
                       └──────────┬───────────┘
                                  │ (getPrimaryRole)
        ┌────────────────┬────────┴────────┬────────────────┐
        ▼                ▼                 ▼                ▼
┌──────────────┐ ┌──────────────┐  ┌──────────────┐ ┌──────────────┐
│    ADMIN     │ │    DC_OPS    │  │   APPROVER   │ │  REQUESTER   │
│  Dashboard   │ │  Dashboard   │  │  Dashboard   │ │  Dashboard   │
└──────────────┘ └──────────────┘  └──────────────┘ └──────────────┘
```

#### 1. 👑 Admin Dashboard (`AdminWidgets.tsx`)
- **Core Mission**: *"Is the whole platform operating correctly, and what needs attention?"*
- **Top 8 KPI Cards**: Total VMs (Active / Suspended / Retired), Total Requests (This month / Pending), Pending Approvals (L1 / L2 / L3 / L4), Pending DC_OPS Execution, Active Users, Expiring VMs (30d / 60d / 90d), Expiring Licenses (30d / 60d / 90d), Subsystem Alerts count.
- **Request Lifecycle Pipeline Bar**: Visual 8-stage progress tracker (`Draft → L1 → L2 → L3 → L4 → DC_OPS → Provisioned → Closed`) with clickable filter counts.
- **Resource Allocation Table**: Total, Allocated, Available, and % Utilization metrics for CPU Cores, RAM (GB/TB), and Block Storage.
- **Live Subsystem Health Monitor**: Real-time status pills and latency tracking for PostgreSQL, Redis, MinIO, Application Server, and SMTP Mailer.
- **Attention & Expiry Hub**: Interactive tabbed view for expiring VMs, software licenses, and requests stuck $> 48\text{h}$.
- **Platform Audit Feed & Administrative Shortcuts**: Quick access to Manage Users, Workflows, Audit Logs, Inventory, Settings, and Email.

#### 2. ⚙️ DC_OPS Dashboard (`DcopsWidgets.tsx`)
- **Core Mission**: *"What infrastructure deployments and operations do I need to execute today?"*
- **Top 8 Operational KPIs**: Pending Provisioning, Provisioned Today, Active VMs, Available CPU, Available RAM, Available Storage, Expiring VMs (30d), Open Operations.
- **Infrastructure Execution Queue**: Table of approved requests awaiting deployment with VM counts, waiting time, priority badge (`HIGH` / `NORMAL` / `LOW`), and direct **Execute** buttons.
- **Multi-VM Provisioning Progress**: Sub-status tracking cards for multi-instance deployments (e.g. `VM 1 ✓ Provisioned`, `VM 2 ● Pending`).
- **Resource Capacity Gauges**: Visual utilization gauges with over-allocation warnings ($> 85\%$).
- **Operational Action Alerts**: Critical alerts for storage capacity, license expiration, and aging execution queues.

#### 3. ✍️ Approver Dashboard (`ApproverWidgets.tsx`)
- **Core Mission**: *"What requires my decision, and where are the bottlenecks?"*
- **Top 4 Decision KPIs**: Pending My Approval, Aging Approvals ($> 48\text{h}$), Returned for Revision, Approved This Month.
- **Pending Decision Queue**: Level-filtered cards with requester details, department, system name, resource snapshot (vCPU, RAM, Disk, VM count, Access type), hours waiting, and **Review & Decide** buttons.
- **Returned Requests Queue**: Tracks requests returned to requesters awaiting their revisions.
- **My Approval History**: Decision audit trail for this approver.

#### 4. 👤 Requester Dashboard (`RequesterWidgets.tsx`)
- **Core Mission**: *"What is happening with my requests and my provisioned VMs?"*
- **Action Required Banner**: High-priority alert banner for returned requests with reviewer comments and an instant **Edit & Resubmit** button.
- **Top 6 KPIs**: My Requests, In Review, Action Required, Approved, Active VMs, Expiring VMs.
- **Request Status Tracker**: Clickable pipeline chips (`Drafts`, `In Review`, `Returned`, `Approved`, `Provisioned`, `Rejected`).
- **My Allocated Virtual Machines Table**: Hostnames, IPs, environments, resource specs, and renewal countdown badges.
- **Quick Resource Shortcuts**: `+ New VM`, `+ K8s Namespace`, `+ Clone VM`, `+ Customization`, `+ Renewal`.

---

### Request Detail View & Audit History (`RequestDetail.tsx`)

- **Audit Trail & Revision History Section**: Renders chronological events directly on the request detail view:
  - 🛠️ `REQUEST_MODIFIED_IN_FLIGHT`: Displays visual change diff pills (`RAM: 64GB → 32GB`, `Removed Resources: [winsvr-02]`) and approver justification notes.
  - ✍️ `APPROVAL_DECISION`: Shows approval decisions, levels, approver name, designation, and comments.
  - 🚀 `EXECUTE_REQUEST` / `PROVISION_VM`: Shows provisioning execution and actor.
- **Approval Panel with In-Flight Adjustments (`ApprovalPanel.tsx`)**:
  - **Adjust & Approve Modal**: Allows approvers to resize CPU/RAM/Disk and uncheck individual VMs from access lists before approving.
  - **Return for Revision Modal**: Allows approvers to return requests with specific amendment instructions.
  - **Forward to Director Modal**: Enables escalation to Level 4.

---

## 11. Notification System

### Types

| Type | Trigger | Recipients |
|---|---|---|
| `APPROVAL_REQUIRED` | Request submitted / forwarded | L1, L2, L3 Approvers |
| `STATUS_UPDATE` | Approval decision made | Requester |
| `DIRECTOR_ESCALATION` | Request escalated to L4 | L4 Approver |
| `EXECUTION_READY` | Request fully approved | DC_OPS users |

### Architecture

1. **In-App Notifications** — Stored in `Notification` table, displayed via `NotificationBell` component
2. **Email Notifications** — Sent via SMTP in parallel (non-blocking, with retry)
3. **Real-Time Updates** — Bell icon polls for unread count

### Functions

| Function | Description |
|---|---|
| `createNotification(userId, type, message, link?)` | Create in-app notification |
| `notifyApprovers(requestId, systemName)` | Notify all L1-L3 approvers |
| `notifyRequester(userId, systemName, status)` | Notify requester of status change |
| `notifyDirector(userId, systemName, requestId)` | Notify L4 for escalation |
| `notifyDCOps(requestId, systemName)` | Notify DC_OPS of approved request |

---

## 12. Email Service & Final Execution Notifications

### Architecture

The email service (`src/lib/email.ts`) implements a production-grade SMTP integration:

- **Dynamic SMTP Config** — Reads from `SystemSetting` table (category: `smtp`), falls back to environment variables
- **Password Encryption** — SMTP passwords are AES-256-CBC encrypted with configurable key
- **Retry Logic** — 3 attempts with exponential backoff (1s, 2s, 3s)
- **Smart Failure** — Retries on transient errors; stops immediately on auth/DNS failures
- **HTML Templates** — Branded email templates with MIS DC Portal styling
- **XSS Prevention** — All dynamic content is HTML-escaped

### Execution & Provisioning Deployment Emails

Upon final execution by DC_OPS or direct approval actions (`executeRequest`, `executeRequestWithVmInputs`, `executeK8sRequest`, `executeVpnRequestDirect`, `executeHorizonRequestDirect`), the notification service automatically formats and dispatches comprehensive deployment emails to the **Requester** and **Developer**:

| Deployment Type | Notification Function | Content Included |
|---|---|---|
| **VM Provisioning** | `sendDeploymentSuccessNotification()` | Hostnames, IP addresses, Public IPs, Subdomains, vCPU, RAM, Storage, OS details |
| **VPN Access** | `sendVpnAccessDeploymentNotification()` | VPN username, Full name, VPN Profile, VPN IP, Assigned VM/Namespace list, Expiry |
| **Horizon Access** | `sendHorizonAccessDeploymentNotification()` | Horizon username, Full name, Assigned IP, VM/Namespace permissions list |
| **K8s Namespace** | `sendK8sNamespaceDeploymentNotification()` | Namespace name, Supervisor IP, Cluster name, Node group sizes & specs |
| **VM Upgrade / Decommission** | `sendStatusUpdateNotification()` | Target VM hostname, upgraded resource specs, execution notes |

### SMTP Configuration Keys

| Key | Description |
|---|---|
| `smtp_host` | SMTP server hostname |
| `smtp_port` | SMTP port (587/465) |
| `smtp_secure` | TLS enabled |
| `smtp_email` | Sender email / auth user |
| `smtp_password` | Encrypted password |
| `smtp_from` | From address display |

---

## 13. File Storage (MinIO)

### Configuration

MinIO provides S3-compatible object storage for file attachments:

| Setting | Default |
|---|---|
| Endpoint | `minio` (Docker) / `localhost` |
| Port | `9000` |
| Console Port | `9001` |
| Bucket | `datacenter` |
| Access Key | `minioadmin` |
| SSL | `false` |

### Service Functions

| Function | Description |
|---|---|
| `getMinioClient()` | Singleton client initialization |
| `ensureBucketExists()` | Auto-create bucket if missing |
| `uploadFile(buffer, fileName, folder, contentType)` | Upload file with unique key generation |
| `uploadBuffer(buffer, originalFileName, folder)` | Upload with auto content-type detection |
| `deleteFile(key)` | Remove file from bucket |
| `getFileUrl(key, expiresIn)` | Generate presigned download URL (default: 1 hour) |
| `listFiles(prefix)` | List all files under a prefix |

### File Path Convention
```
attachments/{timestamp}-{sanitized_filename}
```

### Supported File Types

PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, GIF, TXT, ZIP, RAR

### Attachment Types (Prisma enum)

| Type | Purpose |
|---|---|
| `SECURITY_REPORT` | Vulnerability assessment report |
| `JUSTIFICATION` | Software Requirements Specification (SRS) document for the request |

---

## 14. Caching & Rate Limiting (Redis)

### Redis Architecture

- **Master + 2 Replicas** — `redis-master`, `redis-replica-1`, `redis-replica-2`
- **Persistence** — AOF (Append Only File) enabled
- **Auto-reconnect** — Retry strategy with exponential backoff (50ms * attempt, max 2s)
- **Graceful degradation** — System continues without Redis (rate limiting bypassed, cache disabled)

### Cache Utilities

| Function | Description |
|---|---|
| `getCachedData(key, fetchFn, ttlSeconds)` | Read-through cache (default: 1 hour TTL) |
| `setCachedData(key, data, ttlSeconds)` | Write-through cache |
| `invalidateCache(key | key[])` | Invalidate single or multiple keys |

### Rate Limiting

**Algorithm:** Sliding window counter using Redis Sorted Sets

| Limiter | Limit | Window |
|---|---|---|
| `rateLimitApi()` | 100 requests | 60 seconds |
| `rateLimitSensitive()` | 5 requests | 60 seconds |

**Response Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Failure Mode:** Open — requests are allowed if Redis is unavailable.

---

## 15. Audit Logging & History Trail

### Fields

| Field | Description |
|---|---|
| `actorId` | User who performed the action |
| `action` | Action type string (e.g. `REQUEST_MODIFIED_IN_FLIGHT`, `APPROVAL_APPROVED_L1`, `EXECUTE_REQUEST`) |
| `entityType` | Affected entity type (e.g., `REQUEST`, `CUSTOMIZATION`, `VM_INSTANCE`, `USER`) |
| `entityId` | Affected entity ID |
| `details` | Structured JSON containing before/after diffs, approver notes, and parameters |
| `vmId` | Related VM (optional) |
| `timestamp` | When the action occurred |

### Audited Actions & Diffs

| Action | When Triggered | Metadata Captured |
|---|---|---|
| `CREATE_REQUEST` | New request created/submitted | Request type, initial resource specifications, requester |
| `EDIT_REQUEST` | Requester amends request content | Modified fields, previous vs updated values |
| `REQUEST_MODIFIED_IN_FLIGHT` | Approver modifies resources before approving | Array of human-readable diffs (`RAM: 64GB → 32GB`, `Removed Resources: [winsvr-02]`), original specs, modified specs, approver justification notes |
| `APPROVAL_APPROVED_L[n]` | Approver signs off at Level n | Level, approver ID, comments, escalation targets |
| `APPROVAL_RETURNED` | Approver returns request for revision | Return notes, required amendments, approver ID |
| `EXECUTE_REQUEST` / `REQUEST_PROVISIONED` | DC_OPS completes provisioning | Provisioned VM counts, IP addresses, execution notes |
| `CHANGE_PASSWORD` | Administrator changes user credentials | Target user ID, admin ID, timestamp |

### Indexed For Performance

- `(actorId)`, `(actorId, timestamp)` — User activity queries
- `(entityType, entityId)` — Entity history queries (used by Request Detail view)
- `(timestamp)` — Time-range queries
- `(vmId)` — VM-specific audit trail

---

## 16. Reporting & Analytics

### Report Categories

| Report | File | Description |
|---|---|---|
| **VM Reports** | `report-actions.ts` | VM distribution by environment, status, owner; resource utilization |
| **Approval Reports** | `report-actions.ts` | Approval pipeline, decision timelines, bottleneck analysis |
| **Hardware Reports** | `report-actions.ts` | Asset inventory, warranty status, capacity utilization |
| **User Reports** | `report-actions.ts` | User activity, request volume, role distribution |
| **Tabular Reports** | `report-tabular-actions.ts` | Paginated data tables for VMs, requests, and approvals |

### Dashboard Widgets

| Widget | Component | Roles |
|---|---|---|
| Summary Stat Cards | `SummaryStatCard.tsx` | All |
| Inventory Chart | `InventoryChart.tsx` | Management |
| Status Distribution | `StatusDistribution.tsx` | Management |
| Recent Activity | `RecentActivity.tsx` | All |
| Resource Gauge | `ResourceGauge.tsx` | DC_OPS, Admin |

### Analytics Components

- **StatCard** — Key metric display with trend indicator
- **InventoryChart** — Bar/Pie chart of inventory distribution
- **StatusDistribution** — Donut chart of request status breakdown
- **RecentActivity** — Timeline feed of recent system events

---

## 17. Export System

### Supported Formats

| Format | Function | Description |
|---|---|---|
| **CSV** | `exportToCsv()` / `exportToCSV()` | Standard CSV with proper quoting and escaping |
| **Excel** | `exportToExcel()` | Excel XML format (no xlsx library dependency) |
| **PDF** | `exportToPdf()` | HTML table exported as downloadable HTML file |

All export functions accept an array of row objects and generate a client-side download.

---

## 18. Security

### Global Security Headers (next.config.mjs)

The security headers are globally applied on all responses via `next.config.mjs`:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
                         style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; 
                         font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';
```

### Signature Masking (custom-server.js)

To prevent security scanner identification of the underlying technology stack, a custom wrapper `custom-server.js` intercepts Node's `http.createServer` at runtime to:
- Completely strip `X-Powered-By` and `Server` headers from all responses.
- Mask internal routing assets by prefixing `/assets/` and rewriting back to `/_next/` internally.
- Use generic session and CSRF cookie names (`__sess`, `__cb_url`, `__csrf`).

### Password Security

- **Hashing:** bcrypt via `bcryptjs`
- **Minimum length:** Enforced via frontend validation

### SMTP Password Encryption

- **Algorithm:** AES-256-CBC
- **Key:** `EMAIL_ENCRYPTION_KEY` environment variable (32 characters)
- **Format:** `{iv_hex}:{encrypted_hex}`

### Rate Limiting

- API routes: 100 requests/minute per user
- Sensitive endpoints: 5 requests/minute per user
- Redis-backed sliding window algorithm

### Email XSS Prevention

All dynamic content in emails is HTML-escaped via `escapeHtml()` function.

---

## 19. Infrastructure & Deployment

### Docker Services

| Service | Image | Container | Ports | Purpose |
|---|---|---|---|---|
| `app` | Custom (Node 22 Alpine) | `datacenter-app` | `80:3000` | Next.js application |
| `db` | `postgres:16-alpine` | `pg-db` | `5432:5432` | PostgreSQL database |
| `redis-master` | `redis:7-alpine` | `redis-master` | `6379:6379` | Redis primary |
| `redis-replica-1` | `redis:7-alpine` | `redis-replica-1` | — | Redis replica |
| `redis-replica-2` | `redis:7-alpine` | `redis-replica-2` | — | Redis replica |
| `minio` | `minio/minio` | `minio-server` | `9000, 9001` | Object storage |

### Docker Build Stages

```
Stage 1 (deps):    Node 22 Alpine → npm ci + prisma generate
Stage 2 (builder): Copy deps → full build → next build (standalone)
Stage 3 (runner):  Minimal image → copy standalone output + prisma + data
```

### Health Checks

| Service | Check | Interval | Retries |
|---|---|---|---|
| PostgreSQL | `pg_isready -U postgres` | 5s | 5 |
| Redis | `redis-cli ping \| grep PONG` | 5s | 5 |
| MinIO | `curl -f http://localhost:9000/minio/health/live` | 10s | 5 |

### Startup Command
```bash
npx prisma migrate deploy && node server.js
```

### Persistent Volumes

| Volume | Service | Purpose |
|---|---|---|
| `pg-data` | PostgreSQL | Database files |
| `minio-data` | MinIO | Object storage |
| `redis-master-data` | Redis Master | AOF persistence |
| `redis-replica-1-data` | Redis Replica 1 | Replica AOF |
| `redis-replica-2-data` | Redis Replica 2 | Replica AOF |

### Next.js Configuration

```javascript
{
  output: 'standalone',  // Self-contained deployment
  webpack: {
    // Client-side: exclude Node.js built-in modules
    resolve.fallback: { fs: false, net: false, tls: false, dns: false }
  }
}
```

---

## 20. Environment Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:password@db:5432/datacenter?sslmode=disable
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=datacenter

# Authentication
NEXTAUTH_URL=http://datacenter.dghs.gov.bd:80
NEXTAUTH_SECRET=<min-32-char-secret>

# MinIO Object Storage
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=datacenter
MINIO_USE_SSL=false

# Redis
REDIS_URL=redis://redis-master:6379

# Email (optional — can be configured via admin UI)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
EMAIL_ENCRYPTION_KEY=<32-char-key>

# Application
NEXT_PUBLIC_APP_URL=http://datacenter.dghs.gov.bd
NEXT_PUBLIC_EMAIL=noreply@datacenter.dghs.gov.bd
```

---

## 21. Seed Data & Initial Setup

### NPM Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `next dev` | Start development server |
| `build` | `next build` | Production build (standalone) |
| `start` | `next start` | Start production server |
| `lint` | `next lint` | Run ESLint |
| `postinstall` | `prisma generate` | Auto-generate Prisma client |
| `db:seed` | `tsx prisma/seed.ts` | Seed all data |
| `seed:users` | `tsx prisma/seed.ts --users` | Seed users only |
| `seed:vms` | `tsx prisma/seed.ts --vms` | Seed VMs only |
| `seed:clear` | `tsx prisma/seed.ts --clear` | Clear seeded data |
| `seed:clear-all` | `tsx prisma/seed.ts --clear-all` | Clear all data |

### Seed Data Files

| File | Size | Purpose |
|---|---|---|
| `data/UserList.json` | 9KB | User accounts with roles |
| `data/VmList.json` | 155KB | VM instances with specs |
| `data/server_req.csv` | 304KB | Historical request data |
| `data/server_req.xlsx` | 58KB | Request spreadsheet data |
| `data/user.csv` | 5KB | User data (CSV format) |
| `data/server_request_3_table.sql` | 401KB | SQL import for 3-table request data |

### Setup Steps

1. Clone the repository
2. Copy `.env.production` and configure values
3. Run `docker compose up -d` (starts all services)
4. App automatically runs `npx prisma migrate deploy` on startup
5. Run `docker exec datacenter-app npm run db:seed` for initial data
6. Access the application at `http://localhost:80`

---

## 22. Cron Jobs

### VM Expiry Check

**Endpoint:** `GET /api/cron/vm-expiry`

Scans all active VMs with `renewalDate` and sends notifications to owners and DC_OPS when VMs are approaching expiration.

### License Expiry Check

**Endpoint:** `GET /api/cron/license-expiry`

Scans all software licenses with `expiryDate` and sends alerts for upcoming and overdue license renewals.

### Scheduling

---

## 23. Live Subsystem Health Monitoring Engine

### Architecture

The platform includes a dedicated, non-blocking health check engine (`src/lib/dashboard/systemHealth.ts`) that executes parallel diagnostic probes on all core infrastructure services:

```
┌─────────────────────────────────────────────────────────────┐
│             checkSystemHealth() Parallel Probes             │
└──────────────┬──────────────┬──────────────┬──────────────┬─┘
               │              │              │              │
        ┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
        │  PostgreSQL ││ Redis Cache ││ MinIO Store ││ Node App/SMTP│
        │ `SELECT 1`  ││ `ping()`    ││`listBuckets`││ Heap/Config │
        └─────────────┘└─────────────┘└─────────────┘└─────────────┘
```

### Probes & Status Thresholds

| Subsystem | Check Mechanism | Latency / Metrics | Status Output |
|---|---|---|---|
| **PostgreSQL Database** | `prisma.$queryRaw\`SELECT 1\`` | Query duration in ms | `healthy` ($< 1500\text{ms}$), `warning` ($> 1500\text{ms}$), `error` |
| **Redis Cache Cluster** | `redis.ping()` & connection status | Ping round-trip in ms | `healthy` ($< 500\text{ms}$), `warning` (memory fallback), `error` |
| **MinIO Object Storage** | `minioClient.listBuckets()` | API round-trip in ms | `healthy` ($< 2000\text{ms}$), `warning` (fallback), `error` |
| **Application Server** | `process.memoryUsage().heapUsed` | Heap memory in MB, Node uptime | `healthy` ($< 1024\text{MB}$), `warning` ($> 1024\text{MB}$) |
| **SMTP Mailer Service** | `SystemSetting` query & env check | Host configuration check | `healthy` (configured), `warning` (unconfigured) |

---

## Appendix A: All Enums

| Enum | Values |
|---|---|
| `RequestType` | `NEW_VM`, `CLONE_VM`, `K8S_NAMESPACE`, `VIRTUAL_IP`, `CUSTOMIZED`, `RENEWAL`, `DECOMMISSION` |
| `RequestStatus` | `DRAFT`, `PENDING_L1`, `PENDING_L2`, `PENDING_L3`, `PENDING_L4`, `APPROVED`, `REJECTED`, `PROVISIONED`, `PARTIALLY_PROVISIONED`, `CLOSED`, `REQUESTER_APPROVED` |
| `CustomizationStatus` | `DRAFT`, `PENDING_L1`, `PENDING_L2`, `PENDING_L3`, `PENDING_L4`, `APPROVED`, `REJECTED`, `APPLIED` |
| `ApprovalDecision` | `PENDING`, `APPROVED`, `REJECTED`, `RETURNED`, `FORWARDED` |
| `ApprovalEntityType` | `REQUEST`, `CUSTOMIZATION` |
| `Environment` | `DEVELOPMENT`, `STAGING`, `PRODUCTION`, `TESTING` |
| `ServerType` | `APPLICATION`, `MAIL`, `DATABASE`, `FTP`, `OTHER` |
| `VmStatus` | `ACTIVE`, `SUSPENDED`, `RETIRED` |
| `Protocol` | `TCP`, `UDP`, `OTHER` |
| `NetworkAccess` | `LOCAL`, `INTERNET`, `REMOTE` |
| `LicenseProvider` | `REQUESTER`, `PARTNER`, `OPEN_SOURCE` |
| `SSLProvider` | `REQUESTER`, `MIS` |
| `Raid` | `RAID0`, `RAID1`, `RAID5`, `RAID10`, `NONE` |
| `AttachmentType` | `SECURITY_REPORT`, `JUSTIFICATION` (representing Software Requirements Specification (SRS)) |
| `AssetType` | `SERVER`, `ROUTER`, `SWITCH`, `FIREWALL`, `STORAGE`, `UPS`, `CONSOLE_SERVER`, `OTHER` |

---

## Appendix B: Database Indexes

The schema uses extensive indexing for query performance:

### Request Indexes
- `(requesterId)`, `(status)`, `(environment)`
- `(requesterId, status)`, `(environment, status)`
- `(submittedAt)`, `(targetVmId)`, `(sourceVmId)`
- `(requestType, targetVmId)`

### VmInstance Indexes
- `(ownerId)`, `(status)`
- `(ownerId, status)`, `(environment, status)`
- `(hostAssetId)`

### Approval Indexes
- `(requestId)`, `(customizationRequestId)`
- `(approverId, decision)`, `(entityType, decision)`

### AuditLog Indexes
- `(actorId)`, `(vmId)`, `(timestamp)`
- `(entityType, entityId)`, `(actorId, timestamp)`

### Other Indexes
- VmSpec: `(vmInstanceId)`, `(effectiveFrom)`
- CustomizationRequest: `(targetVmId)`, `(status)`, `(requesterId)`, `(createdAt)`
- CustomizationHistory: `(vmId)`, `(beforeSpecId)`, `(afterSpecId)`, `(appliedById)`
- ApprovalWorkflow: `(requestType)`
- SystemSetting: `(category)`

---

## Appendix C: Utility Scripts

### MinIO Health Check
```bash
npx tsx scripts/check-minio.ts
```
Verifies MinIO connectivity and bucket existence.

### Workflow Verification
```bash
npx tsx scripts/check-workflows.ts
```
Validates that all approval workflow configurations are correctly set up in the database.

---

> **End of System Documentation**

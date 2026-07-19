# Graph Report - .  (2026-07-06)

## Corpus Check
- 233 files · ~118,687 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1171 nodes · 2926 edges · 69 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: imports: 1068 · contains: 899 · imports_from: 755 · calls: 141 · method: 48 · inherits: 15

## God Nodes (most connected - your core abstractions)
1. `Button` - 59 edges
2. `Card` - 47 edges
3. `CardContent` - 47 edges
4. `Badge()` - 36 edges
5. `CardHeader` - 36 edges
6. `authOptions` - 36 edges
7. `Input` - 35 edges
8. `ROLES` - 35 edges
9. `CardTitle` - 33 edges
10. `cn()` - 32 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (40): ApprovalFunnelItem, DepartmentBreakdownItem, EnvDistributionItem, ExportReportRow, fetchApprovalReport(), fetchHardwareReport(), fetchUserReport(), fetchVmReport() (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (19): createDecommissionRequest(), fetchAllVms(), AssetModalProps, DeleteConfirmationModalProps, LicenseModalProps, VmExecutionInput, VmExecutionModalProps, Button (+11 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (11): getAdminMetrics(), AuditActivityItem, StatsCardProps, RequestSummaryProps, EmailSettings, InventoryStats, Setting, CardDescription (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (26): getDcCapacityReport(), getRenewalsReport(), getRequestsReport(), getUserAllocationReport(), getVmInventoryReport(), Pagination(), PaginationProps, ReportsDashboardClient() (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (15): getNotifications(), getUnreadCount(), markAllAsRead(), markAsRead(), NotificationItem, geistMono, geistSans, metadata (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (14): decrypt(), EmailSettings, encrypt(), getEmailSettings(), getTransporter(), saveEmailSettings(), sendApprovalNotification(), sendEmail() (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (25): cancelCustomizationRequest(), createAuditLog(), createCustomizationRequest(), customizationCreateSchema, CustomizationRequest, customizationUpdateSchema, deleteCustomizationRequest(), getCustomizationRequest() (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (21): getAllActiveUsers(), createAuditLog(), createManualVm(), createVm(), deleteVm(), fetchVmDetailsSerialized(), renewVmRequest(), updateVm() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (18): generateApprovals(), Attachment, createCloneRequest(), Attachment, createK8sNamespaceRequest(), Attachment, createRequest(), RequestFilters (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (18): executeRequest(), ProvisionResult, VmExecutionInput, VmProvisioningInput, ApprovalLevel, canForward(), createWorkflowLevel(), DEFAULT_WORKFLOW_CONFIG (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (18): getRequests(), getRequestStats(), Alert, LogEntryProps, Props, ROLE_OPTIONS, RequestStats, RequestType (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (10): getAuditLogs(), getInventoryMetrics(), InventoryMetrics, AuditPageProps, AuditExplorerClient(), getCurrentUser(), requireAuth(), authOptions (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (18): StatCard(), ApprovalReportAnalytics, ApprovalReportResult, ApprovalReportRow, statusColors, HardwareReportAnalytics, HardwareReportResult, HardwareReportRow (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (14): getAttachmentUrl(), StatCardProps, REQUEST_TYPES, requiredFields, RequestStepper(), Step, steps, cn() (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (17): getUserVmDetails(), actionColors, AuditLog, UserVmModalProps, Input, Table, TableBody, TableCaption (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (12): assetBaseSchema, createAsset(), deleteAsset(), fetchAllAssets(), fetchAssetDetailsWithLicenses(), updateAsset(), Asset, Asset (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (11): ChartData, ChartType, DEFAULT_COLORS, InventoryChart(), InventoryChartProps, SummaryStatCard(), SummaryStatCardProps, CardContent (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (23): createUser(), createWorkflowLevel(), deleteUser(), deleteWorkflowLevel(), getAllRoles(), getAuditActions(), getAuditEntities(), getAuditLogs() (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (18): AssetFilters(), AssetFiltersProps, DEFAULT_FILTERS, AssetRow, AssetTableSection(), AssetTableSectionProps, DisplayAsset, InventoryClientProps (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (14): EmailParams, escapeHtml(), getApprovalEmailHtml(), getEmailTemplate(), getExecutionEmailHtml(), getSmtpConfig(), getStatusUpdateEmailHtml(), htmlToText() (+6 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (11): HomeDashboardData, fetchDashboardData(), MetricColor, PermissionGateProps, canManageInventory(), canUserApprove(), canUserApproveAtLevel(), hasRole() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (17): Approval, BaseCustomizationRequest, BaseRequest, DashboardRequest, AdditionalDiskInput, CustomizationRequest, FirewallPortInput, NetworkAccessInput (+9 more)

### Community 22 - "Community 22"
Cohesion: 0.11
Nodes (8): CustomizationRequestDetails(), Timeline(), TimelineProps, DetailRowProps, EntityType, SideDetailProps, SpecBlockProps, UtilizationCardProps

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (4): MANAGEMENT_ROLES, RoleService, UserRole, UserRoles

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (10): changePassword(), createRole(), createUser(), deleteRole(), getRequesters(), updateOwnProfile(), updateRole(), updateUserDetails() (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (11): getSystemSummary(), getUserVms(), getUserVmStats(), getVmDetails(), PaginatedUserVms, SubdomainSummary, SystemSummary, UserVmData (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (11): fetchLicenseAnalytics(), createLicense(), deleteLicense(), fetchLicenseDetails(), fetchLicenseDetailsWithAssets(), licenseSchema, updateLicense(), updateLicenseSchema (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (2): Card, Skeleton()

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (8): AppError, BadRequestError, ConflictError, ForbiddenError, InternalServerError, NotFoundError, UnauthorizedError, ValidationError

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (13): ApprovalDecision, ApprovalEntityType, ApprovalLevel, AttachmentType, LicenseProvider, NetworkAccess, NotificationType, Protocol (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (7): getDetailedRequest(), submitRequest(), ApprovalPanel(), CardProps, DetailItemProps, RequestDetails(), VmInstanceList()

### Community 31 - "Community 31"
Cohesion: 0.19
Nodes (14): getRecentVmActivity(), getVmAnalytics(), getVmByDomain(), getVmByOwner(), getVmResourceAllocation(), getVmStatus(), getVmSummary(), VmActivity (+6 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (11): DashboardData, DashboardRegistry(), DashboardRegistryProps, AdminDashboardData, AdminDashboardStats, ApprovalDistribution, AuditLogEntry, MonthlyRequestTrend (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (6): deleteDecommissionRequest(), getDecommissionRequestList(), submitDecommissionRequest(), adapter, globalForPrisma, pool

### Community 34 - "Community 34"
Cohesion: 0.14
Nodes (3): CreateWorkflowInput, UpdateWorkflowInput, WorkflowLevel

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (11): AssetFormFieldsProps, Asset, AssetFormData, BaseAssetFormData, FirewallFormData, License, OtherAssetFormData, RouterFormData (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.14
Nodes (3): MergedRequest, ApiResponse, PaginatedResponse

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (10): Actor, AuditLog, AuditLogDetails, Notification, SerializedAuditLog, SerializedVmSpecHistory, VmInstance, VmSpec (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (12): getHardwareAnalytics(), getHardwareByCategory(), getHardwareByLocation(), getHardwareByType(), getHardwareSummary(), getRecentHardwareActivity(), HardwareActivity, HardwareAnalytics (+4 more)

### Community 39 - "Community 39"
Cohesion: 0.17
Nodes (5): AuditAction, AuditEntity, AuditLogEntry, AuditLogParams, PaginatedAuditLogs

### Community 40 - "Community 40"
Cohesion: 0.17
Nodes (4): CreateUserInput, PaginatedUsers, UpdateUserInput, UserListParams

### Community 41 - "Community 41"
Cohesion: 0.24
Nodes (11): getExpiringLicenses(), getLicenseAnalytics(), getLicenseByType(), getLicenseByVendor(), getLicenseSummary(), getRecentLicenseActivity(), LicenseActivity, LicenseByType (+3 more)

### Community 42 - "Community 42"
Cohesion: 0.20
Nodes (6): StatusDistribution(), StatusDistributionProps, StatusItem, CapacityDashboardClient(), CapacityMetrics, UsageRowProps

### Community 43 - "Community 43"
Cohesion: 0.21
Nodes (4): getAdminDashboardData(), getPrimaryRole(), getRoleLabel(), RoleSwitcher()

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (8): getAuditTrailReport(), SheetContent, SheetContentProps, SheetDescription, SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 45 - "Community 45"
Cohesion: 0.25
Nodes (10): DcopsDashboardData, DcopsDashboardStats, EnvironmentDistribution, getDcopsDashboardData(), getDcopsStats(), getEnvironmentDistribution(), getProvisioningQueue(), getServerUtilization() (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (10): adapter, clearAll(), clearInventory(), clearRequests(), main(), normalizeName(), pool, prisma (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.33
Nodes (10): deleteFile(), ensureBucketExists(), getContentType(), getFileUrl(), getMinioClient(), listFiles(), minioPort, uploadBuffer() (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (7): fetchAssetUtilization(), fetchHardwareAnalytics(), fetchVmAnalytics(), AssetUtilization, AssetWithVms, getAssetUtilization(), VmOnAsset

### Community 49 - "Community 49"
Cohesion: 0.31
Nodes (5): getDirSize(), getSettings(), getSystemHealth(), saveSettings(), updateSetting()

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (5): actionColors, actionIcons, ActivityItem, RecentActivity(), RecentActivityProps

### Community 51 - "Community 51"
Cohesion: 0.31
Nodes (8): getRecentActivity(), getRequesterDashboardData(), getRequesterStats(), getResourceAllocation(), MyRecentActivity, MyResourceAllocation, RequesterDashboardData, RequesterDashboardStats

### Community 52 - "Community 52"
Cohesion: 0.22
Nodes (5): getCachedData(), invalidateCache(), redis, LogContext, LogLevel

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (7): AdminSettingsPage(), formatBytes(), Setting, SystemHealth, TabsContent, TabsList, TabsTrigger

### Community 54 - "Community 54"
Cohesion: 0.25
Nodes (4): AssetListClient(), AssetModal(), DeleteConfirmationModal(), PhysicalAsset

### Community 55 - "Community 55"
Cohesion: 0.32
Nodes (3): RenewButton(), BaseVmInstance, VmCardProps

### Community 56 - "Community 56"
Cohesion: 0.36
Nodes (5): rateLimit(), rateLimitApi(), RateLimitResponse, rateLimitSensitive(), config

### Community 57 - "Community 57"
Cohesion: 0.39
Nodes (1): Logger

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (5): forwardToLevel(), handleApprovalDecision(), ApproverDashboardClient(), ApproverRequest, REQUEST_TYPE_CONFIG

### Community 59 - "Community 59"
Cohesion: 0.29
Nodes (2): RequestForm(), Request

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (2): DashboardSkeleton(), DashboardSkeletonProps

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (4): provisionVMs(), ProvisionVMModal(), ProvisionVMModalProps, VmInstanceInput

### Community 62 - "Community 62"
Cohesion: 0.40
Nodes (4): deleteRequest(), RequestList(), RequestListProps, detailsRequest

### Community 63 - "Community 63"
Cohesion: 0.50
Nodes (2): AdminClientLayout(), navItems

### Community 64 - "Community 64"
Cohesion: 0.50
Nodes (1): Asset

### Community 65 - "Community 65"
Cohesion: 0.50
Nodes (3): JWT, Session, User

### Community 66 - "Community 66"
Cohesion: 0.67
Nodes (1): navItems

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (1): VmStatus

### Community 72 - "Community 72"
Cohesion: 1.00
Nodes (1): { PrismaClient }

## Knowledge Gaps
- **283 isolated node(s):** `pool`, `adapter`, `prisma`, `{ PrismaClient }`, `VmExecutionInput` (+278 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 27`** (2 nodes): `Card`, `Skeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `Logger`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `RequestForm()`, `Request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `DashboardSkeleton()`, `DashboardSkeletonProps`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `AdminClientLayout()`, `navItems`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `Asset`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `navItems`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `VmStatus`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `{ PrismaClient }`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Button` connect `Community 1` to `Community 2`, `Community 12`, `Community 50`, `Community 14`, `Community 58`, `Community 18`, `Community 54`, `Community 10`, `Community 6`, `Community 7`, `Community 4`, `Community 61`, `Community 55`, `Community 30`, `Community 13`, `Community 62`, `Community 22`, `Community 26`, `Community 25`, `Community 59`, `Community 53`, `Community 44`, `Community 3`, `Community 42`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `ROLES` connect `Community 20` to `Community 17`, `Community 15`, `Community 11`, `Community 8`, `Community 0`, `Community 49`, `Community 24`, `Community 63`, `Community 2`, `Community 12`, `Community 50`, `Community 14`, `Community 58`, `Community 1`, `Community 13`, `Community 4`, `Community 32`, `Community 43`, `Community 22`, `Community 26`, `Community 59`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `authOptions` connect `Community 11` to `Community 17`, `Community 9`, `Community 15`, `Community 8`, `Community 6`, `Community 20`, `Community 33`, `Community 4`, `Community 0`, `Community 3`, `Community 49`, `Community 24`, `Community 7`, `Community 25`, `Community 63`, `Community 2`, `Community 12`, `Community 43`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `pool`, `adapter`, `prisma` to the rest of the system?**
  _283 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04625346901017576 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0960960960960961 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12857142857142856 - nodes in this community are weakly interconnected._
# Graph Report - .  (2026-07-07)

## Corpus Check
- 240 files · ~295,358 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1208 nodes · 3041 edges · 71 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: imports: 1117 · contains: 929 · imports_from: 791 · calls: 141 · method: 48 · inherits: 15

## God Nodes (most connected - your core abstractions)
1. `Button` - 61 edges
2. `Card` - 49 edges
3. `CardContent` - 49 edges
4. `ROLES` - 40 edges
5. `authOptions` - 39 edges
6. `CardHeader` - 38 edges
7. `Input` - 37 edges
8. `Badge()` - 36 edges
9. `CardTitle` - 35 edges
10. `cn()` - 32 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (80): getAuditTrailReport(), getDcCapacityReport(), getRenewalsReport(), getRequestsReport(), getUserAllocationReport(), getUserVmDetails(), getVmInventoryReport(), getRequests() (+72 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (40): ApprovalFunnelItem, DepartmentBreakdownItem, EnvDistributionItem, ExportReportRow, fetchApprovalReport(), fetchHardwareReport(), fetchUserReport(), fetchVmReport() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (21): ChartData, ChartType, DEFAULT_COLORS, InventoryChart(), InventoryChartProps, DashboardData, DashboardRegistry(), DashboardRegistryProps (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (22): getSystemSummary(), getUserVms(), getUserVmStats(), getVmDetails(), PaginatedUserVms, SubdomainSummary, SystemSummary, updateVmSystemName() (+14 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (9): RequestSummaryProps, EmailSettings, InventoryStats, Setting, CardContent, CardDescription, CardFooter, CardHeader (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (15): assetBaseSchema, createAsset(), deleteAsset(), fetchAllAssets(), fetchAssetDetailsWithLicenses(), updateAsset(), Asset, AssetListClient() (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (18): getAllActiveUsers(), AssetModalProps, DeleteConfirmationModal(), DeleteConfirmationModalProps, EditVmModalProps, UserOption, LicenseModalProps, ManualVmModal() (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (17): Attachment, getCloneableVms(), getSourceVmDetails(), getAttachmentUrl(), Attachment, getNamespaceOptions(), REQUEST_TYPES, RequestForm() (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (10): getAuditLogs(), getInventoryMetrics(), InventoryMetrics, AuditPageProps, AuditExplorerClient(), getCurrentUser(), requireAuth(), authOptions (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (23): createUser(), createWorkflowLevel(), deleteUser(), deleteWorkflowLevel(), getAllRoles(), getAuditActions(), getAuditEntities(), getAuditLogs() (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (18): AssetFilters(), AssetFiltersProps, DEFAULT_FILTERS, AssetRow, AssetTableSection(), AssetTableSectionProps, DisplayAsset, InventoryClientProps (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (10): getNotifications(), getUnreadCount(), markAllAsRead(), markAsRead(), NotificationItem, NotificationBell(), NavItem, cn() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (12): actionColors, actionIcons, ActivityItem, RecentActivity(), RecentActivityProps, StatCardProps, StatusDistribution(), StatusDistributionProps (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (15): EmailParams, escapeHtml(), getApprovalEmailHtml(), getEmailTemplate(), getExecutionEmailHtml(), getSmtpConfig(), getStatusUpdateEmailHtml(), htmlToText() (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (17): Approval, BaseCustomizationRequest, BaseRequest, DashboardRequest, AdditionalDiskInput, CustomizationRequest, FirewallPortInput, NetworkAccessInput (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (11): assignTagsToRequest(), assignTagsToVm(), createComplianceTag(), deleteComplianceTag(), getComplianceTags(), ComplianceTagItem, Checkbox, Label (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (8): geistMono, geistSans, metadata, RouteLoader(), LoadingContext, LoadingContextType, LoadingProvider(), useLoading()

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (8): CustomizationRequestDetails(), Timeline(), TimelineProps, DetailRowProps, EntityType, SideDetailProps, SpecBlockProps, UtilizationCardProps

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (4): MANAGEMENT_ROLES, RoleService, UserRole, UserRoles

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (10): changePassword(), createRole(), createUser(), deleteRole(), getRequesters(), updateOwnProfile(), updateRole(), updateUserDetails() (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (13): ApprovalLevel, canForward(), createWorkflowLevel(), DEFAULT_WORKFLOW_CONFIG, fetchWorkflowFromDb(), getLevelByLevel(), getNextLevel(), getStatusForLevel() (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (9): HomeDashboardData, PermissionGateProps, canManageInventory(), canUserApprove(), canUserApproveAtLevel(), hasRole(), MANAGEMENT_ROLES, Role (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (4): EmailPayload, NotificationPayload, NotificationService, NotificationType

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (11): fetchLicenseAnalytics(), createLicense(), deleteLicense(), fetchLicenseDetails(), fetchLicenseDetailsWithAssets(), licenseSchema, updateLicense(), updateLicenseSchema (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (12): createAuditLog(), createManualVm(), createVm(), deleteVm(), fetchVmDetailsSerialized(), renewVmRequest(), updateVm(), updateVmResources() (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (2): Card, Skeleton()

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (9): CustomizationFormValues, CustomizationModal(), EditModeContentProps, Props, RenewButton(), BaseVmInstance, VmCardProps, VmStatus (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (14): AccessType, ApprovalDecision, ApprovalEntityType, ApprovalLevel, AttachmentType, K8sNodeRole, LicenseProvider, NetworkAccess (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (8): AppError, BadRequestError, ConflictError, ForbiddenError, InternalServerError, NotFoundError, UnauthorizedError, ValidationError

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (15): cancelCustomizationRequest(), createAuditLog(), createCustomizationRequest(), customizationCreateSchema, CustomizationRequest, customizationUpdateSchema, deleteCustomizationRequest(), getCustomizationRequest() (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (6): deleteDecommissionRequest(), getDecommissionRequestList(), submitDecommissionRequest(), adapter, globalForPrisma, pool

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (8): getDetailedRequest(), submitRequest(), ApprovalPanel(), CardProps, DetailItemProps, RequestDetails(), VmInstanceList(), Person

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (10): createAccessRequest(), getAccessableVms(), generateApprovals(), createCloneRequest(), createK8sNamespaceRequest(), createRequest(), createSystemUpgradeRequest(), getUpgradeableVms() (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (9): Attachment, RequestFilters, RequestWithRelations, createNotification(), notifyApprovers(), notifyDCOps(), notifyDirector(), notifyRequester() (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.19
Nodes (14): getRecentVmActivity(), getVmAnalytics(), getVmByDomain(), getVmByOwner(), getVmResourceAllocation(), getVmStatus(), getVmSummary(), VmActivity (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (3): CreateWorkflowInput, UpdateWorkflowInput, WorkflowLevel

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (10): Actor, AuditLog, AuditLogDetails, Notification, SerializedAuditLog, SerializedVmSpecHistory, VmInstance, VmSpec (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.17
Nodes (7): executeRequest(), ProvisionResult, VmExecutionInput, VmProvisioningInput, fetchDashboardData(), MetricColor, UserRole

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
Cohesion: 0.18
Nodes (4): getAdminDashboardData(), getCachedData(), invalidateCache(), redis

### Community 43 - "Community 43"
Cohesion: 0.21
Nodes (5): DashboardSkeleton(), DashboardSkeletonProps, getPrimaryRole(), getRoleLabel(), RoleSwitcher()

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (10): DcopsDashboardData, DcopsDashboardStats, EnvironmentDistribution, getDcopsDashboardData(), getDcopsStats(), getEnvironmentDistribution(), getProvisioningQueue(), getServerUtilization() (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.24
Nodes (7): rateLimit(), rateLimitApi(), RateLimitResponse, rateLimitSensitive(), config, LogContext, LogLevel

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (10): adapter, clearAll(), clearInventory(), clearRequests(), main(), normalizeName(), pool, prisma (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.33
Nodes (10): deleteFile(), ensureBucketExists(), getContentType(), getFileUrl(), getMinioClient(), listFiles(), minioPort, uploadBuffer() (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (7): getCustomizationRequests(), fetchAllVms(), StatusBadge(), CustomizationStatus, Environment, canEdit(), canSubmit()

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (9): AssetFormData, BaseAssetFormData, FirewallFormData, License, OtherAssetFormData, RouterFormData, ServerFormData, StorageFormData (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (7): fetchAssetUtilization(), fetchHardwareAnalytics(), fetchVmAnalytics(), AssetUtilization, AssetWithVms, getAssetUtilization(), VmOnAsset

### Community 51 - "Community 51"
Cohesion: 0.31
Nodes (5): getDirSize(), getSettings(), getSystemHealth(), saveSettings(), updateSetting()

### Community 52 - "Community 52"
Cohesion: 0.31
Nodes (8): getRecentActivity(), getRequesterDashboardData(), getRequesterStats(), getResourceAllocation(), MyRecentActivity, MyResourceAllocation, RequesterDashboardData, RequesterDashboardStats

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (7): AdminSettingsPage(), formatBytes(), Setting, SystemHealth, TabsContent, TabsList, TabsTrigger

### Community 54 - "Community 54"
Cohesion: 0.22
Nodes (7): SheetContent, SheetContentProps, SheetDescription, SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 55 - "Community 55"
Cohesion: 0.36
Nodes (3): createDecommissionRequest(), Textarea, DecommissionModalProps

### Community 56 - "Community 56"
Cohesion: 0.39
Nodes (1): Logger

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (5): forwardToLevel(), handleApprovalDecision(), ApproverDashboardClient(), ApproverRequest, REQUEST_TYPE_CONFIG

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (3): getAdminMetrics(), AuditActivityItem, StatsCardProps

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (3): AssetFormFieldsProps, Asset, Switch

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (2): EditVmModal(), VmListClient()

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

### Community 66 - "Community 66"
Cohesion: 0.50
Nodes (2): client, minioPort

### Community 68 - "Community 68"
Cohesion: 0.50
Nodes (3): JWT, Session, User

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (1): navItems

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (2): ApiResponse, PaginatedResponse

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (1): VmStatus

### Community 76 - "Community 76"
Cohesion: 1.00
Nodes (1): { PrismaClient }

## Knowledge Gaps
- **290 isolated node(s):** `pool`, `adapter`, `prisma`, `{ PrismaClient }`, `minioPort` (+285 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 25`** (2 nodes): `Card`, `Skeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `Logger`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `EditVmModal()`, `VmListClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `AdminClientLayout()`, `navItems`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `Asset`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `client`, `minioPort`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `navItems`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (2 nodes): `ApiResponse`, `PaginatedResponse`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `VmStatus`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `{ PrismaClient }`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Button` connect `Community 26` to `Community 58`, `Community 0`, `Community 12`, `Community 4`, `Community 6`, `Community 57`, `Community 10`, `Community 5`, `Community 11`, `Community 61`, `Community 31`, `Community 7`, `Community 62`, `Community 15`, `Community 60`, `Community 48`, `Community 55`, `Community 17`, `Community 23`, `Community 3`, `Community 53`, `Community 16`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `ROLES` connect `Community 21` to `Community 32`, `Community 9`, `Community 5`, `Community 8`, `Community 7`, `Community 1`, `Community 33`, `Community 51`, `Community 15`, `Community 19`, `Community 3`, `Community 63`, `Community 58`, `Community 37`, `Community 0`, `Community 12`, `Community 57`, `Community 6`, `Community 11`, `Community 2`, `Community 43`, `Community 4`, `Community 17`, `Community 23`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `authOptions` connect `Community 8` to `Community 32`, `Community 9`, `Community 37`, `Community 5`, `Community 7`, `Community 29`, `Community 21`, `Community 30`, `Community 11`, `Community 1`, `Community 0`, `Community 33`, `Community 51`, `Community 15`, `Community 19`, `Community 24`, `Community 3`, `Community 63`, `Community 58`, `Community 43`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `pool`, `adapter`, `prisma` to the rest of the system?**
  _290 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.054901960784313725 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04625346901017576 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07017543859649122 - nodes in this community are weakly interconnected._
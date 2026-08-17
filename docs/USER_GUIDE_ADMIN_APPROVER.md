# MIS Datacenter Portal — Admin & Approver User Guide

This guide describes how **Approvers** (Section Officers, Deputy Directors, and Directors) and **Administrators** evaluate incoming requests, manage approval queues, configure workflow chains, and manage system users.

---

## Table of Contents
1. [Dashboard & Approval Queue](#1-dashboard--approval-queue)
2. [Evaluating Requests & Decisions](#2-evaluating-requests--decisions)
   - [Approve / Forward](#approve--forward)
   - [Return to Requester](#return-to-requester)
   - [Reject](#reject)
3. [User & Role Management (Admin Only)](#3-user--role-management-admin-only)
4. [Workflow Engine Configuration (Admin Only)](#4-workflow-engine-configuration-admin-only)
5. [System Settings & SMTP Configuration (Admin Only)](#5-system-settings--smtp-configuration-admin-only)

---

## 1. Dashboard & Approval Queue
When you log in with an approver or admin role, you have access to the **Approver Dashboard**:
- **Pending Approvals Queue**: Displays all VM requests, K8s namespace requests, customization requests, and decommission requests currently waiting at your designated approval level.
- **Workflow Pipeline Widget**: Shows how many requests are sitting at Level 1, Level 2, Level 3, and DC Operations.

To review pending items, click **Approvals** in the sidebar.

---

## 2. Evaluating Requests & Decisions

Select a request from the queue to view its complete specifications, contact details, VM specs, network requirements, and uploaded documents (SRS/VA report).

You can perform the following actions:

### Approve / Forward
- **What it does**: Confirms your approval of the request.
- **Result**:
  - If you are at L1 or L2, the request is **Forwarded** to the next level in the chain.
  - If you are the final approver (L3/Director MIS), the request status changes to **Approved** and lands in the DC Operations execution queue for provisioning.
- **Action**: Enter any optional comments and click **Approve**.

### Return to Requester
- **What it does**: Sends the request back to the requester for correction (e.g., if resources requested are too high or documentation is incomplete).
- **Result**: Request status changes to **Returned**. The requester can edit and resubmit, which returns the request to Level 1.
- **Action**: You **must** provide a descriptive comment explaining what needs to be changed, then click **Return**.

### Reject
- **What it does**: Denies the request permanently.
- **Result**: The request is terminated. Status changes to **Rejected**. It cannot be resubmitted.
- **Action**: Enter details explaining the rejection and click **Reject**.

---

## 3. User & Role Management (Admin Only)

System Administrators can access the **User Management** panel under **Admin Tools** > **Users**.

### Tasks
- **Create User**: Click **Add User**, enter details (name, email, password, designation, organization), and assign roles.
- **Assign Roles**: Users can have multiple roles (e.g., a user can be both `REQUESTER` and `APPROVER_L1`).
- **Deactivate/Activate User**: Toggle the account status. Deactivated users cannot log in.
- **Reset Password**: Generate a temp password or reset a locked account.

---

## 4. Workflow Engine Configuration (Admin Only)

The portal routes requests based on rules configured under **Admin Tools** > **Workflows**.

### Key Rules
- **NEW_VM / CLONE_VM / K8S_NAMESPACE / VIRTUAL_IP / CUSTOMIZED**: Configured for 4 levels (L1: Section Officer → L2: Deputy Director → L3: Director MIS → L4: DC Operations Execution).
- **DECOMMISSION**: Configured for a shorter 2-level chain (L1: Section Officer Approval → L2: DC Operations Execution).
- **Customizing levels**: Admins can change which role is responsible for which level.

---

## 5. System Settings & SMTP Configuration (Admin Only)

Admins configure global settings under **Admin Tools** > **Settings**:
- **SMTP Settings**: Configure the mail host, port, username, password, and security mode (SSL/TLS). This enables the system to dispatch automated emails for approval queues, status updates, and provisioning notices.
- **System Health**: Check database connections, Redis caching connectivity, and MinIO object storage health status.

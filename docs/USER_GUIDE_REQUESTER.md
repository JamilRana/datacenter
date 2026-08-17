# MIS Datacenter Portal — Requester User Guide

Welcome to the **MIS Datacenter Portal**. This guide provides step-by-step instructions for Requesters to submit infrastructure requests, track approval workflows, manage active virtual machines, and request resource updates.

---

## Table of Contents
1. [Logging In & Account Setup](#1-logging-in--account-setup)
2. [Creating Infrastructure Requests](#2-creating-infrastructure-requests)
   - [Requesting Virtual Machines (VMs)](#requesting-virtual-machines-vms)
   - [Requesting Kubernetes (K8s) Namespaces](#requesting-kubernetes-k8s-namespaces)
   - [Requesting Virtual IPs (VIPs)](#requesting-virtual-ips-vips)
3. [Required Documentation (SRS & VA Reports)](#3-required-documentation-srs--va-reports)
4. [Tracking & Managing Requests](#4-tracking--managing-requests)
5. [Customizing Active VMs](#5-customizing-active-vms)
6. [Decommissioning VMs](#6-decommissioning-vms)

---

## 1. Logging In & Account Setup
1. Open your web browser and navigate to the portal: `http://datacenter.dghs.gov.bd` (or your local environment link).
2. Enter your **Email Address** and **Password** on the login page.
3. Upon logging in, you will be redirected to the **Requester Dashboard**, displaying status counts of your active VMs, pending requests, and recent activity.

---

## 2. Creating Infrastructure Requests

To submit a request, click **New Request** in the sidebar navigation or from the dashboard action panel.

### Requesting Virtual Machines (VMs)
1. Select **New VM** from the **Request Type** dropdown.
2. Fill in the **General Information**:
   - **System Name**: Name of the application/service (e.g., *National Health Registry*).
   - **Project Name**: Associated project code or initiative.
   - **Environment**: Select `Development`, `Staging`, `Testing`, or `Production`.
   - **Server Type**: E.g., `Application`, `Database`, `Mail`, `FTP`, etc.
3. Enter alternative contact information if someone else will also coordinate technical deployment.
4. If you have developers associated with the project, add their details so they are notified when VMs are provisioned.
5. Under **VM Specifications**:
   - Specify **Quantity**: Number of VMs requested.
   - Enter resources per VM: **vCPUs**, **RAM (GB)**, and **Storage (GB)**.
   - Select **Operating System** (OS) and version.
6. Under **Network Requirements**:
   - Specify whether a **Public IP** is required.
   - Specify if **VPN Access** is required.
   - Enter any **Firewall Rules** (Ports, Protocols, Source/Destination IPs).
7. Upload the required **Software Requirements Specification (SRS)** and **Vulnerability Assessment (VA) Report** (see Section 3).

### Requesting Kubernetes (K8s) Namespaces
If your application runs in containers and you require a Kubernetes cluster namespace:
1. Select **K8s Namespace** as the **Request Type**.
2. Specify the desired **Namespace Name** (lowercase, alphanumeric).
3. Set up resource specifications for your Node Groups (e.g., `Control Plane` vs. `Worker Nodes`), detailing the number of nodes, vCPU, and RAM per node.
4. Upload the required SRS document.

### Requesting Virtual IPs (VIPs)
For load balancing or proxy routing:
1. Select **Virtual IP** as the **Request Type**.
2. Choose the IP class: `Public` or `Private`.
3. Provide details about the target VMs/services that will receive traffic.

---

## 3. Required Documentation (SRS & VA Reports)

To prevent resource sprawl and ensure security compliance, the portal enforces document validation:
- **Software Requirements Specification (SRS)**: **Mandatory** for all new VM, clone, and K8s namespace requests. You must upload a document explaining the software requirements and system architecture before submitting.
- **Vulnerability Assessment (VA) Report**: Required for **Production** environment requests. Ensure a security assessment has been carried out and attach the report.

*Supported formats: PDF, DOC, DOCX, PNG, JPG, ZIP.*

---

## 4. Tracking & Managing Requests

All requests you create will appear under the **My Requests** page.

### Workflow Statuses
- **Draft**: Saved but not yet submitted. You can edit all details.
- **Pending L1 / L2 / L3**: Awaiting review by the approval chain.
- **Approved**: Request passed all approvals and is now in the DC Operations execution queue.
- **Provisioned**: DC Operations has finished provisioning your resources. You will receive an email containing IP addresses, credentials, and connection instructions.
- **Returned**: The approver requested changes. Edit your request, address their comments, and click **Resubmit** to send it back through the approval chain.

---

## 5. Customizing Active VMs

If an active VM runs out of storage, RAM, or requires a port update:
1. Navigate to **My VMs** in the sidebar.
2. Select the VM you want to modify and click **Request Customization**.
3. Fill in the requested resources (e.g., additional storage size, upgraded vCPU, new firewall ports).
4. Provide a business justification for the change.
5. Click **Submit Customization**. This request undergoes L1-L3 approval before being applied by DC Operations.

---

## 6. Decommissioning VMs

When a system or VM is no longer needed:
1. Navigate to **My VMs** in the sidebar.
2. Select the VM and click **Decommission Request**.
3. Choose the decommission target and provide a justification.
4. Submit the request. Once approved, the VM is powered down and retired by the DC Operations team.

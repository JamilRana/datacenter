# MIS Datacenter Portal — DC Operations User Guide

This guide describes how **DC Operations** (DCOPS) officers process approved requests, provision virtual machines individually or in bulk, configure Kubernetes namespaces, provision VPN/Horizon access credentials, and manage hardware/license inventory.

---

## Table of Contents
1. [Dashboard & Execution Queue](#1-dashboard--approval-queue)
2. [VM Provisioning & Execution Form](#2-vm-provisioning--execution-form)
   - [Handling Multiple VMs in a Single Request](#handling-multiple-vms-in-a-single-request)
   - [Executing a VM](#executing-a-vm)
3. [Kubernetes Namespace Provisioning](#3-kubernetes-namespace-provisioning)
4. [VPN & Horizon Access Provisioning](#4-vpn--horizon-access-provisioning)
   - [Provisioning VPN Access](#provisioning-vpn-access)
   - [Provisioning VMware Horizon Access](#provisioning-vmware-horizon-access)
5. [Inventory & Asset Tracking](#5-inventory--asset-tracking)
   - [Hardware Assets](#hardware-assets)
   - [Software Licenses](#software-licenses)

---

## 1. Dashboard & Execution Queue
When logging in with the `DC_OPS` role, your landing page is the **DC Ops Dashboard**:
- Shows quick metrics on total provisioned VMs, active hardware hosts, expiring licenses, and open execution items.
- Access the queue by clicking **Approvals** (or **Execution Queue**) in the sidebar. This contains requests marked as `APPROVED` by the Director MIS and waiting for physical provisioning.

---

## 2. VM Provisioning & Execution Form

### Handling Multiple VMs in a Single Request
If a user requests multiple VMs (e.g. Quantity: 3), the execution page lists **all requested VMs individually**:
- Each VM is tracked with its own hostname, IP address, public IP, and specific resources.
- You can provision VMs one by one, saving details individually.
- This prevents overwriting VM data and allows you to track progress if some VMs are finished and others are pending.

### Executing a VM
1. Open the request detail page.
2. Under the VM List, click **Execute** next to the specific VM item.
3. Fill in the provisioning form:
   - **Hostname**: Enter the assigned hostname in the cluster.
   - **IP Address**: Private IP address allocated to the VM.
   - **Public IP**: (Optional) Public IP if requested and approved.
   - **Subdomain**: (Optional) DNS subdomain.
   - **Resources (vCPU, RAM, Storage)**: Prefilled from the request spec. Adjust if actual allocated specs differ.
   - **Select Host Hostname**: Map the VM to its physical server host from the dropdown.
4. Click **Submit Execution**.
5. Once all requested VMs are provisioned, the request status advances to **PROVISIONED**, and an email notification with hostnames, IPs, and credentials is automatically sent to the requester and developers.

---

## 3. Kubernetes Namespace Provisioning

For containerized requests (`K8S_NAMESPACE`):
1. Locate the request in the queue and click **Execute**.
2. Input the final **Namespace Name** and the cluster's **Supervisor IP**.
3. The system automatically creates the `K8sCluster`, `K8sNodeGroup`, and worker/control-plane node structures.
4. Click **Provision**.
5. The system marks the request as **PROVISIONED** and dispatches a detailed email notification to the user containing the namespace details, supervisor IP, cluster name, and a breakdown of node groups.

---

## 4. VPN & Horizon Access Provisioning

When a request requires additional network access (VPN or VMware Horizon client connection):

### Provisioning VPN Access
1. Scroll to the network access section on the execution page.
2. Select **Provision VPN**.
3. Fill out the form:
   - **VPN Username**: Assigned LDAP or VPN system username.
   - **VPN IP**: Private IP address allocated on the VPN network.
   - **VPN Profile**: E.g., `Full Tunnel`, `Split Tunnel`.
   - **Select VMs/Namespaces**: Link the specific VMs or Kubernetes namespaces the user is allowed to access.
   - **Expiration Date**: (Optional) Access duration.
   - **Notes**: Instructions on how to download the configuration file.
4. Submit the form. This creates a `VpnUser` and `VpnAssignment` records.
5. The system dispatches a VPN Access credentials email to the user.

### Provisioning VMware Horizon Access
For remote desktop/VDI access:
1. Select **Provision Horizon**.
2. Fill out the form:
   - **Horizon Username**: Virtual desktop account username.
   - **Assigned Access IP**: (Optional) Gateway IP.
   - **Select VMs/Namespaces**: Link VM resources.
3. Submit the form to create `HorizonUser` and `HorizonAssignment` records.
4. The system dispatches a Horizon Access email to the user.

---

## 5. Inventory & Asset Tracking

DC Ops is responsible for keeping datacenter records updated under the **Inventory** menu.

### Hardware Assets
Track physical components located inside datacenter racks:
- **Add Asset**: Specify type (`Server`, `Router`, `Switch`, `Firewall`, `Storage`, `UPS`, etc.), vendor, model, serial number, physical location, and warranty expiration.
- **Server Resources**: If the asset is a server host, input total CPU cores, RAM (GB), and storage. These are selected when mapping VMs to physical hosts.

### Software Licenses
Manage system licenses:
- Track software product name, vendor, type, purchase date, and expiration.
- Setup maintenance windows and track contract documents.
- Automated alerts warn DC Ops on the dashboard when a license is within 30 days of expiry.

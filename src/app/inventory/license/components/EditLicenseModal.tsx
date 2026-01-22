// app/inventory/licenses/components/EditLicenseModal.tsx
"use client";

import { updateLicense } from "@/app/actions/license-actions";
import { License } from "@/types/inventory";
import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  license: License;
};

export default function EditLicenseModal({ isOpen, onClose, license }: Props) {
  const [formData, setFormData] = useState({
    id: license.id,
    name: license.name,
    vendor: license.vendor,
    expiryDate: license.expiryDate
      ? license.expiryDate.toISOString().split("T")[0]
      : "",
    maintenanceExpiry: license.maintenanceExpiry
      ? license.maintenanceExpiry.toISOString().split("T")[0]
      : "",
    notes: license.notes || "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(formData).forEach(([key, value]) => fd.append(key, value));
    fd.append("type", "SOFTWARE");
    await updateLicense(fd);
    onClose();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Edit License</h2>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="id" value={formData.id} />
          <input type="hidden" name="type" value="SOFTWARE" />

          <div className="mb-3">
            <label className="block text-sm">Name *</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm">Vendor *</label>
            <input
              name="vendor"
              value={formData.vendor}
              onChange={handleChange}
              required
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm">Expiry Date</label>
            <input
              name="expiryDate"
              type="date"
              value={formData.expiryDate}
              onChange={handleChange}
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm">Maintenance Expiry</label>
            <input
              name="maintenanceExpiry"
              type="date"
              value={formData.maintenanceExpiry}
              onChange={handleChange}
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full border px-2 py-1 rounded"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Update
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

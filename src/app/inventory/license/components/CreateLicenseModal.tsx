// app/inventory/licenses/components/CreateLicenseModal.tsx
"use client";

import { createLicense } from "@/app/actions/license-actions";
import { useState } from "react";

export default function CreateLicenseModal() {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await createLicense(formData);
    setIsOpen(false);
    window.location.reload();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Add License
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add New License</h2>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="type" value="SOFTWARE" />

          <div className="mb-3">
            <label className="block text-sm">Name *</label>
            <input
              name="name"
              required
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm">Vendor *</label>
            <input
              name="vendor"
              required
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm">Expiry Date</label>
            <input
              name="expiryDate"
              type="date"
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm">Maintenance Expiry</label>
            <input
              name="maintenanceExpiry"
              type="date"
              className="w-full border px-2 py-1 rounded"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm">Notes</label>
            <textarea
              name="notes"
              className="w-full border px-2 py-1 rounded"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
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

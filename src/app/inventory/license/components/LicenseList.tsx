// app/inventory/licenses/components/LicenseList.tsx
"use client";

import { deleteLicense } from "@/app/actions/license-actions";
import { format } from "date-fns";
import EditLicenseModal from "./EditLicenseModal";
import { useState } from "react";
import { License } from "@/types/inventory";

type Props = {
  licenses: License[];
};

export default function LicenseList({ licenses }: Props) {
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [licenseToDelete, setLicenseToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (licenseToDelete) {
      await deleteLicense(licenseToDelete);
      setIsDeleteConfirmOpen(false);
      setLicenseToDelete(null);
      window.location.reload();
    }
  };

  // Optional: Add expiry status badge (e.g., "Expiring Soon", "Expired")
  const getExpiryStatus = (date: Date | null | undefined) => {
    if (!date) return null;
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0)
      return { text: "Expired", color: "bg-red-100 text-red-800" };
    if (diffDays <= 30)
      return { text: "Expiring Soon", color: "bg-yellow-100 text-yellow-800" };
    return { text: "Active", color: "bg-green-100 text-green-800" };
  };

  return (
    <>
      {/* License Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {licenses.length === 0 ? (
          <div className="col-span-full text-center py-10 text-gray-500">
            No licenses found. Add one to get started.
          </div>
        ) : (
          licenses.map((license) => {
            const expiryStatus = getExpiryStatus(license.expiryDate);
            return (
              <div
                key={license.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 flex flex-col h-full"
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {license.name}
                  </h3>
                  {expiryStatus && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${expiryStatus.color}`}
                    >
                      {expiryStatus.text}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mt-1">
                  Vendor: {license.vendor}
                </p>

                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <div>
                    <span className="font-medium">Expiry:</span>{" "}
                    {license.expiryDate
                      ? format(license.expiryDate, "PPP")
                      : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Maintenance:</span>{" "}
                    {license.maintenanceExpiry
                      ? format(license.maintenanceExpiry, "PPP")
                      : "—"}
                  </div>
                  {license.notes && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="font-medium">Notes:</span>{" "}
                      {license.notes}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedLicense(license);
                      setIsEditOpen(true);
                    }}
                    className="flex-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setLicenseToDelete(license.id);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="flex-1 text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 py-1.5 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Modal */}
      {selectedLicense && (
        <EditLicenseModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          license={selectedLicense}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Delete License?
              </h3>
              <p className="mt-2 text-gray-600">
                This action cannot be undone. The license will be permanently
                removed.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                Delete
              </button>
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-gray-400 focus:outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

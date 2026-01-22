// app/inventory/licenses/components/LicenseCards.tsx
"use client";

import { format, isPast } from "date-fns";
import { useState } from "react";
import DeleteLicenseButton from "./DeleteLicenseButton";
import { License } from "@/types/inventory";

type Props = {
  licenses: License[];
};

export default function LicenseCards({ licenses }: Props) {
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (licenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No licenses found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {licenses.map((license) => {
        const isExpired = license.expiryDate && isPast(license.expiryDate);
        const isMaintenanceExpired =
          license.maintenanceExpiry && isPast(license.maintenanceExpiry);

        return (
          <div
            key={license.id}
            className="bg-white border rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col"
          >
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-block px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full">
                    {license.type}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 line-clamp-1">
                    {license.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{license.vendor}</p>
                </div>
                {(isExpired || isMaintenanceExpired) && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    ⚠️ Expired
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-700">
                {license.expiryDate && (
                  <div>
                    <span className="font-medium">Expiry:</span>{" "}
                    <span
                      className={
                        isExpired ? "text-red-600 font-medium" : "text-gray-900"
                      }
                    >
                      {format(license.expiryDate, "PPP")}
                    </span>
                  </div>
                )}

                {license.maintenanceExpiry && (
                  <div>
                    <span className="font-medium">Maintenance:</span>{" "}
                    <span
                      className={
                        isMaintenanceExpired
                          ? "text-orange-600 font-medium"
                          : "text-gray-900"
                      }
                    >
                      {format(license.maintenanceExpiry, "PPP")}
                    </span>
                  </div>
                )}

                {license.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-gray-600 italic line-clamp-2">
                      {license.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-gray-50 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedLicense(license);
                  setIsEditOpen(true);
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <DeleteLicenseButton id={license.id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

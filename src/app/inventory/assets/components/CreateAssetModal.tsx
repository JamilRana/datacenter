// src/app/inventory/assets/components/CreateAssetModal.tsx
"use client";

import { createAsset } from "@/app/actions/asset-actions";
import { AssetType } from "@prisma/client"; // ✅ Import the enum directly
import { useState } from "react";

export default function CreateAssetModal() {
  const [isOpen, setIsOpen] = useState(false);
  // ✅ Initialize with a valid enum value
  const [assetType, setAssetType] = useState<AssetType>(AssetType.SERVER);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // ✅ Form data doesn't automatically handle the "false" hidden input 
    // logic for checkboxes well. Let's ensure types are correct.
    await createAsset(formData);
    setIsOpen(false);
    window.location.reload();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
      >
        Add Asset
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add New Asset</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="type" value={assetType} />

          {/* Asset Type Selector */}
          <div>
            <label className="block text-sm font-medium mb-1">Asset Type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as typeof assetType)}
              className="w-full border rounded px-3 py-2"
            >
              {Object.values(AssetType).map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Name *" name="name" required />
            <InputField label="Provider" name="vendor" />
            <InputField label="Model" name="model" />
            <InputField label="Serial Number" name="serial" />
            <InputField label="Location" name="location" />
            <InputField
              label="Warranty Expiry"
              name="warrantyExpiry"
              type="date"
            />
          </div>

          {/* Conditional Fields */}
          {(assetType === "SERVER" || assetType === "STORAGE") && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Resource Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assetType === "SERVER" && (
                  <>
                    <InputField
                      label="CPU Cores"
                      name="cpuCores"
                      type="number"
                    />
                    <InputField label="RAM (GB)" name="ramGb" type="number" />
                    <InputField
                      label="Storage (GB)"
                      name="storageGb"
                      type="number"
                    />
                    <InputField
                      label="Graphics Card Model"
                      name="graphicsCardModel"
                    />
                  </>
                )}
                {assetType === "STORAGE" && (
                  <>
                    <InputField
                      label="Capacity (TB)"
                      name="capacityTb"
                      type="number"
                    />
                    <InputField
                      label="Number of Disks"
                      name="noOfDisks"
                      type="number"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {assetType === "ROUTER" && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Network Specs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Interfaces"
                  name="interfaces"
                  type="number"
                />
                <InputField
                  label="Throughput (Gbps)"
                  name="throughputGbps"
                  type="number"
                />
              </div>
            </div>
          )}

          {assetType === "SWITCH" && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Switch Specs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Interfaces"
                  name="interfaces"
                  type="number"
                />
                <div className="flex items-center">
                  <label className="mr-2">VLAN Support</label>
                  <input type="checkbox" name="vlanSupport" value="true" />
                  <input type="hidden" name="vlanSupport" value="false" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Save Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InputField({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full border rounded px-3 py-2"
      />
    </div>
  );
}

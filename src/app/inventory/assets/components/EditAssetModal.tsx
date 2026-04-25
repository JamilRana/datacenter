// src/app/inventory/assets/components/EditAssetModal.tsx
"use client";

import { updateAsset } from "@/app/actions/asset-actions";
import { AssetType } from "@prisma/client";
interface Asset {
  id: string;
  name: string;
  vendor: string | null;
  model: string | null;
  serial: string | null;
  type: string;
  location: string | null;
  warrantyExpiry: Date | string | null;
  cpuCores: number | null;
  ramGb: number | null;
  storageGb: number | null;
  graphicsCardModel: string | null;
  graphicsCardSpec: string | null;
  interfaces: number | null;
  throughputGbps: number | null;
  vlanSupport: boolean | null;
  capacityTb: number | null;
  noOfDisks: number | null;
}

import { useState, useEffect } from "react";

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
}

export default function EditAssetModal({
  isOpen,
  onClose,
  asset,
}: EditAssetModalProps) {
  const [assetType, setAssetType] = useState(asset.type);
  const [formData, setFormData] = useState<Partial<Asset>>({ ...asset });

  // Sync formData when asset prop changes (e.g., after refetch)
  useEffect(() => {
    setFormData({ ...asset });
    setAssetType(asset.type);
  }, [asset]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();

    // Always include id and type
    fd.append("id", asset.id);
    fd.append("type", assetType);

    // Append all fields (empty strings become undefined in Zod)
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "id" || key === "createdAt" || key === "updatedAt") return;
      if (value instanceof Date) {
        fd.append(key, value.toISOString());
      } else if (value !== null && value !== undefined) {
        fd.append(key, String(value));
      }
    });

    await updateAsset(fd);
    onClose();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Asset</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset Type Selector (disabled since type shouldn't change after creation) */}
          <div>
            <label className="block text-sm font-medium mb-1">Asset Type</label>
            <select
              value={assetType}
              disabled
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
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
            <InputField
              label="Name *"
              name="name"
              value={formData.name || ""}
              onChange={handleChange}
              required
            />
            <InputField
              label="Provider"
              name="vendor"
              value={formData.vendor || ""}
              onChange={handleChange}
            />
            <InputField
              label="Model"
              name="model"
              value={formData.model || ""}
              onChange={handleChange}
            />
            <InputField
              label="Serial Number"
              name="serial"
              value={formData.serial || ""}
              onChange={handleChange}
            />
            <InputField
              label="Location"
              name="location"
              value={formData.location || ""}
              onChange={handleChange}
            />
            <InputField
              label="Warranty Expiry"
              name="warrantyExpiry"
              type="date"
              value={
                formData.warrantyExpiry
                  ? new Date(formData.warrantyExpiry)
                      .toISOString()
                      .split("T")[0]
                  : ""
              }
              onChange={handleChange}
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
                      value={formData.cpuCores ?? ""}
                      onChange={handleChange}
                    />
                    <InputField
                      label="RAM (GB)"
                      name="ramGb"
                      type="number"
                      value={formData.ramGb ?? ""}
                      onChange={handleChange}
                    />
                    <InputField
                      label="Storage (GB)"
                      name="storageGb"
                      type="number"
                      value={formData.storageGb ?? ""}
                      onChange={handleChange}
                    />
                    <InputField
                      label="Graphics Card Model"
                      name="graphicsCardModel"
                      value={formData.graphicsCardModel || ""}
                      onChange={handleChange}
                    />
                  </>
                )}
                {assetType === "STORAGE" && (
                  <>
                    <InputField
                      label="Capacity (TB)"
                      name="capacityTb"
                      type="number"
                      value={formData.capacityTb ?? ""}
                      onChange={handleChange}
                    />
                    <InputField
                      label="Number of Disks"
                      name="noOfDisks"
                      type="number"
                      value={formData.noOfDisks ?? ""}
                      onChange={handleChange}
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
                  value={formData.interfaces ?? ""}
                  onChange={handleChange}
                />
                <InputField
                  label="Throughput (Gbps)"
                  name="throughputGbps"
                  type="number"
                  value={formData.throughputGbps ?? ""}
                  onChange={handleChange}
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
                  value={formData.interfaces ?? ""}
                  onChange={handleChange}
                />
                <div className="flex items-center">
                  <label className="mr-2">VLAN Support</label>
                  <input
                    type="checkbox"
                    name="vlanSupport"
                    checked={!!formData.vlanSupport}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Update Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reusable input field component
function InputField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
        value={value}
        onChange={onChange}
        required={required}
        className="w-full border rounded px-3 py-2"
      />
    </div>
  );
}

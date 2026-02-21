// src/app/inventory/assets/components/AssetList.tsx
"use client";

import { deleteAsset } from "@/app/actions/asset-actions";
import { AssetType } from "@/types/enums";

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  model: string | null;
  vendor: string | null;
  serial: string | null;
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
  createdAt: Date | string;
}

import { format } from "date-fns";
import { useState } from "react";
import CreateAssetModal from "./CreateAssetModal";
import EditAssetModal from "./EditAssetModal";

export default function AssetList({ assets }: { assets: Asset[] }) {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (assetToDelete) {
      await deleteAsset(assetToDelete);
      setIsDeleteConfirmOpen(false);
      setAssetToDelete(null);
      window.location.reload();
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Assets ({assets.length})</h2>
        <CreateAssetModal />
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No assets found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between">
                <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {asset.type}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {asset.model || "—"} • {asset.vendor || "—"}
              </p>

              <div className="mt-3 text-sm text-gray-700 space-y-1">
                {asset.location && <div>📍 {asset.location}</div>}
                {asset.warrantyExpiry && (
                  <div>
                    🛡️ Warranty: {format(asset.warrantyExpiry, "MMM yyyy")}
                  </div>
                )}
                {(asset.cpuCores || asset.ramGb) && (
                  <div>
                    💻 {asset.cpuCores ? `${asset.cpuCores} cores` : ""}{" "}
                    {asset.ramGb ? `• ${asset.ramGb} GB RAM` : ""}
                  </div>
                )}
                {asset.capacityTb && <div>🗄️ {asset.capacityTb} TB</div>}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedAsset(asset);
                    setIsEditOpen(true);
                  }}
                  className="flex-1 text-sm bg-indigo-50 text-indigo-700 py-1.5 rounded-lg hover:bg-indigo-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setAssetToDelete(asset.id);
                    setIsDeleteConfirmOpen(true);
                  }}
                  className="flex-1 text-sm bg-red-50 text-red-700 py-1.5 rounded-lg hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateAssetModal />
      {selectedAsset && (
        <EditAssetModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          asset={selectedAsset}
        />
      )}

      {/* Delete Confirmation */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold">Delete Asset?</h3>
            <p className="text-gray-600 mt-2">This cannot be undone.</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg"
              >
                Delete
              </button>
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg"
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

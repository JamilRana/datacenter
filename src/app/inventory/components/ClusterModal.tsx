// src/app/inventory/components/ClusterModal.tsx
"use client";

import React, { useState } from "react";
import { createCluster, updateCluster } from "@/app/actions/cluster-actions";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClusterModal({ 
  cluster, 
  mode, 
  onSave 
}: { 
  cluster?: any;
  mode: "create" | "edit";
  onSave: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && cluster) {
      formData.set("id", cluster.id);
    }

    try {
      const res = mode === "create" ? await createCluster(formData) : await updateCluster(formData);
      if (res.success) {
        setIsOpen(false);
        onSave();
      } else {
        setError(res.error || "An error occurred");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {mode === "create" ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-1.5"
        >
          Add Cluster
        </button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-y-auto p-6 text-left">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {mode === "create" ? "Add New Cluster" : "Edit Cluster"}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cluster Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={cluster?.name || ""}
                  placeholder="e.g. dc-sddc-cls01"
                  className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 border-gray-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  name="description"
                  defaultValue={cluster?.description || ""}
                  placeholder="Describe the cluster hardware or use-case..."
                  rows={3}
                  className="w-full border rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 border-gray-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium"
                >
                  {loading ? "Saving..." : "Save Cluster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

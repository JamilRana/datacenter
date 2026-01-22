// app/inventory/licenses/components/DeleteLicenseButton.tsx
"use client";

import { deleteLicense } from "@/app/actions/license-actions";
import { useRouter } from "next/navigation";

export default function DeleteLicenseButton({ id }: { id: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this license?")) {
      await deleteLicense(id);
      router.refresh(); // revalidates the page
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="text-sm font-medium text-red-600 hover:text-red-800"
    >
      Delete
    </button>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchVmDetails } from "@/app/actions/vm-actions";
import { CustomizationForm } from "../../components/CustomizationForm";

export default function CustomizeVmPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [vm, setVm] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth");
    }
  }, [status, router]);

  useEffect(() => {
    async function getVm() {
      try {
        const data = await fetchVmDetails(params.id);
        if (data) {
          // Flatten data for CustomizationForm
          setVm({
            id: data.id,
            hostname: data.hostname,
            vcpu: data.currentSpec?.vcpu || 0,
            ramGb: data.currentSpec?.ramGb || 0,
            additionalDiskGb: 0, // Initial value for form
          });
        }
      } catch (error) {
        console.error("Failed to fetch VM:", error);
      } finally {
        setLoading(false);
      }
    }
    if (session) getVm();
  }, [params.id, session]);

  if (status === "loading" || loading) return <div className="p-10 text-center">Loading...</div>;
  if (!vm) return <div className="p-10 text-center">VM not found.</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Request VM Customization</h1>
      <CustomizationForm vm={vm} userId={session?.user?.id || ""} />
    </div>
  );
}

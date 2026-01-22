// components/RouteLoader.tsx
import { useLoading } from "@/context/LoadingContext";

export function RouteLoader() {
  const { loading } = useLoading();

  if (!loading) return null;

  return (
    <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
      <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  );
}

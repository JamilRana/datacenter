// src/app/inventory/vms/[id]/components/Badge.tsx
export function Badge({
  children,
  color = "bg-gray-100 text-gray-800",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${color}`}>
      {children}
    </span>
  );
}

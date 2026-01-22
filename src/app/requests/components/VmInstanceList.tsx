// src/app/requests/components/VmInstanceList.tsx
export function VmInstanceList({ vms }: { vms: any[] }) {
  return (
    <div>
      <h2 className="font-semibold mb-2">Provisioned VMs</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vms.map((vm) => (
          <div key={vm.id} className="border p-4 rounded">
            <p>
              <strong>{vm.hostname || `VM ${vm.sequenceNumber}`}</strong>
            </p>
            {vm.ipAddress && <p>IP: {vm.ipAddress}</p>}
            <p>Status: {vm.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

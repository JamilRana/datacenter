"use client";

import { useState } from "react";
import { createRole, updateRole, deleteRole } from "@/app/actions/user-actions";
import { Role } from "@/types/users";

interface Props {
  roles: Role[];
}

export default function RoleTable({ roles }: Props) {
  const [roleList, setRoleList] = useState<Role[]>(roles);
  const [newRole, setNewRole] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleCreate = async () => {
    if (!newRole.trim()) return;

    try {
      await createRole(newRole);
      setRoleList([
        ...roleList,
        { id: crypto.randomUUID(), name: newRole.toUpperCase() },
      ]);
      setNewRole("");
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateRole(id, editValue);
      setRoleList(roleList.map(r =>
        r.id === id ? { ...r, name: editValue.toUpperCase() } : r
      ));
      setEditingId(null);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this role?")) return;

    try {
      await deleteRole(id);
      setRoleList(roleList.filter(r => r.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow space-y-4">
      <h2 className="text-xl font-semibold">Role Management</h2>

      {/* Create Role */}
      <div className="flex gap-2">
        <input
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          placeholder="New role name"
          className="border px-3 py-2 rounded w-60"
        />
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Role
        </button>
      </div>

      {/* Role List */}
      <table className="w-full border">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 text-left">Role Name</th>
            <th className="p-2 w-40">Actions</th>
          </tr>
        </thead>
        <tbody>
          {roleList.map(role => (
            <tr key={role.id} className="border-t">
              <td className="p-2">
                {editingId === role.id ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="border px-2 py-1 rounded"
                  />
                ) : (
                  role.name
                )}
              </td>
              <td className="p-2 space-x-2">
                {editingId === role.id ? (
                  <>
                    <button
                      onClick={() => handleUpdate(role.id)}
                      className="text-green-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-gray-600"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(role.id);
                        setEditValue(role.name);
                      }}
                      className="text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="text-red-600"
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

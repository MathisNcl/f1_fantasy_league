"use client";

import { useState } from "react";
import { Role } from "@prisma/client";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
};

type Props = {
  users: UserRow[];
};

const ROLE_CYCLE: Record<Role, Role> = {
  USER: "CONTRIBUTOR",
  CONTRIBUTOR: "USER",
  ADMIN: "ADMIN",
};

const ROLE_LABELS: Record<Role, string> = {
  USER: "USER",
  CONTRIBUTOR: "CONTRIBUTEUR",
  ADMIN: "ADMIN",
};

const ROLE_BADGE: Record<Role, string> = {
  USER: "bg-gray-700 text-gray-300",
  CONTRIBUTOR: "bg-blue-900 text-blue-300",
  ADMIN: "bg-yellow-900 text-yellow-300",
};

export default function UsersList({ users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState<string | null>(null);

  async function toggleRole(userId: string, currentRole: Role) {
    const newRole = ROLE_CYCLE[currentRole];
    if (newRole === currentRole) return; // ADMIN ne change pas
    setLoading(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Utilisateurs ({users.length})
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="text-left pb-3 font-medium">Nom</th>
              <th className="text-left pb-3 font-medium">Email</th>
              <th className="text-left pb-3 font-medium">Rôle</th>
              <th className="text-left pb-3 font-medium">Inscrit le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="py-3 pr-4 text-white font-medium">{user.name}</td>
                <td className="py-3 pr-4 text-gray-300">{user.email}</td>
                <td className="py-3 pr-4">
                  {user.role === "ADMIN" ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleRole(user.id, user.role)}
                      disabled={loading === user.id}
                      title={`Passer à ${ROLE_LABELS[ROLE_CYCLE[user.role]]}`}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-offset-gray-900 transition-all disabled:opacity-50 ${ROLE_BADGE[user.role]} ${user.role === "CONTRIBUTOR" ? "hover:ring-blue-500" : "hover:ring-gray-500"}`}
                    >
                      {loading === user.id ? "..." : ROLE_LABELS[user.role]}
                    </button>
                  )}
                </td>
                <td className="py-3 text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">Cliquez sur le badge USER/CONTRIBUTEUR pour basculer le rôle.</p>
    </div>
  );
}

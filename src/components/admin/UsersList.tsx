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

export default function UsersList({ users }: Props) {
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
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === "ADMIN"
                        ? "bg-yellow-900 text-yellow-300"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="py-3 text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

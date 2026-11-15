import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./ui/skeleton";
import { Card } from "./ui/card";
import { DesktopOnly, MobileCardList } from "./ResponsiveList";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

interface UsersTableProps {
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export default function UsersTable({ onEdit, onDelete }: UsersTableProps) {
  const { data: session } = authClient.useSession();
  const {
    data: users,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await api.get<{ users: User[] }>("/api/users");
      return data.users;
    },
  });

  if (error) {
    return <ErrorAlert message="Failed to fetch users" />;
  }

  return (
    <>
      <MobileCardList isLoading={isLoading}>
        {users?.map((user) => (
          <Card key={user.id} className="flex-row items-start justify-between gap-3 px-4">
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-navy">{user.name}</p>
              <p className="truncate">{user.email}</p>
              <Badge variant={user.role === Role.Admin ? "default" : "secondary"}>
                {user.role}
              </Badge>
            </div>
            <UserActions
              user={user}
              canDelete={user.id !== session?.user.id}
              onEdit={onEdit}
              onDelete={onDelete}
              className="shrink-0"
            />
          </Card>
        ))}
      </MobileCardList>
      <DesktopOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8 rounded" />
                    </TableCell>
                  </TableRow>
                ))
              : users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === Role.Admin ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <UserActions
                        user={user}
                        canDelete={user.id !== session?.user.id}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </DesktopOnly>
    </>
  );
}

function UserActions({
  user,
  canDelete,
  onEdit,
  onDelete,
  className,
}: UsersTableProps & { user: User; canDelete: boolean; className?: string }) {
  return (
    <div className={className}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(user)}
        aria-label={`Edit ${user.name}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(user)}
          aria-label={`Delete ${user.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

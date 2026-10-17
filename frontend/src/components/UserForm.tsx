import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "shared/schemas/users.ts";
import { Role } from "shared/constants/role.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface UserFormProps {
  user?: UserData;
  onSuccess: () => void;
}

export default function UserForm({ user, onSuccess }: UserFormProps) {
  const isEdit = !!user;
  const queryClient = useQueryClient();

  const form = useForm<CreateUserInput | UpdateUserInput>({
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      role: user?.role ?? Role.Volunteer,
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: CreateUserInput | UpdateUserInput) => {
      if (isEdit) {
        const { data } = await api.put(`/api/users/${user.id}`, payload);
        return data.user;
      }
      const { data } = await api.post("/api/users", payload);
      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      form.reset();
      mutation.reset();
      onSuccess();
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      className="flex h-full min-h-0 flex-col"
      autoComplete="off"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="Full name"
            aria-invalid={!!form.formState.errors.name}
            {...form.register("name")}
          />
          <ErrorMessage message={form.formState.errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            autoComplete="off"
            aria-invalid={!!form.formState.errors.email}
            {...form.register("email")}
          />
          <ErrorMessage message={form.formState.errors.email?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder={isEdit ? "Leave blank to keep current" : "Minimum 8 characters"}
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register("password")}
          />
          <ErrorMessage message={form.formState.errors.password?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <NativeSelect id="role" {...form.register("role")}>
            <NativeSelectOption value={Role.Volunteer}>Volunteer</NativeSelectOption>
            <NativeSelectOption value={Role.Admin}>Admin</NativeSelectOption>
          </NativeSelect>
          <ErrorMessage message={form.formState.errors.role?.message} />
        </div>
      </div>
      <div className="shrink-0 space-y-4 pt-4">
        {mutation.error && (
          <ErrorAlert
            error={mutation.error}
            fallback={`Failed to ${isEdit ? "update" : "create"} user`}
          />
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {isEdit
              ? mutation.isPending
                ? "Saving..."
                : "Save Changes"
              : mutation.isPending
                ? "Creating..."
                : "Create User"}
          </Button>
        </div>
      </div>
    </form>
  );
}

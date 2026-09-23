import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import ErrorMessage from "./ErrorMessage";

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  if (isPending) {
    return null;
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    const { error: signInError } = await authClient.signIn.email(values);

    if (signInError) {
      setError("root", { message: signInError.message ?? "Unable to sign in." });
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
          <ErrorMessage message={errors.email?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <ErrorMessage message={errors.password?.message} />
        </div>
        <ErrorMessage message={errors.root?.message} />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </main>
  );
}

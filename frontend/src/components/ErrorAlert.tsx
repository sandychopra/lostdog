import { isAxiosError } from "axios";

interface ErrorAlertProps {
  message?: string;
  error?: unknown;
  fallback?: string;
}

export default function ErrorAlert({ message, error, fallback = "Something went wrong" }: ErrorAlertProps) {
  const text =
    message ??
    (isAxiosError(error) && typeof error.response?.data?.error === "string"
      ? error.response.data.error
      : fallback);

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {text}
    </div>
  );
}

import { isAxiosError } from "axios";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

interface ErrorAlertProps {
  message?: string;
  error?: unknown;
  fallback?: string;
}

export default function ErrorAlert({
  message,
  error,
  fallback = "Something went wrong",
}: ErrorAlertProps) {
  const text =
    message ??
    (isAxiosError(error) && typeof error.response?.data?.error === "string"
      ? error.response.data.error
      : fallback);

  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 px-3">
      <CircleAlert />
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { Alert, AlertDescription } from "./ui/alert";

// Offline mode is out of scope for MVP (docs/project-scope.md), so this only
// warns; form contents stay on screen and can be submitted once reconnected.
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="sticky top-0 z-40 px-4 pt-2 sm:px-6">
      <Alert className="mx-auto max-w-6xl border-gold bg-gold/15 text-navy">
        <WifiOff />
        <AlertDescription className="text-navy">
          You&apos;re offline. Changes won&apos;t save until you reconnect.
        </AlertDescription>
      </Alert>
    </div>
  );
}

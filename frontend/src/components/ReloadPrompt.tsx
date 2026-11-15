import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

// Registers the service worker (registerType: "prompt" in vite.config.ts) and
// asks before switching to a new version, instead of reloading under a
// volunteer mid-way through a shift report.
export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Card
        role="status"
        className="w-full max-w-sm flex-row items-center justify-between gap-3 px-4 shadow-lg"
      >
        <p className="text-sm text-navy">A new version is available.</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button onClick={() => void updateServiceWorker(true)}>Reload</Button>
        </div>
      </Card>
    </div>
  );
}

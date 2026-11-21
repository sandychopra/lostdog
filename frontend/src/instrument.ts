import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router";
import * as Sentry from "@sentry/react";
import { API_BASE } from "./lib/config";

// Imported first by frontend.tsx so Sentry.init runs before the app renders.
// Only when PUBLIC_SENTRY_DSN is set; `bun test` never loads this file.
const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.PUBLIC_SENTRY_RELEASE || undefined,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration(),
    ],
    // Every trace in dev; a sample in production builds.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Send trace headers to our API so frontend and backend traces connect.
    tracePropagationTargets: [API_BASE],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

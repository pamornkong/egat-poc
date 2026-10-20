"use client";

import ErrorScreen from "./components/error-screen";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen code="unexpected" onRetry={reset} />;
}

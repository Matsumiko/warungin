import { createFileRoute } from "@tanstack/react-router";
import { healthCheck } from "@/lib/auth";

export const Route = createFileRoute("/api/health")({
  head: () => ({ meta: [] }),
  loader: async () => {
    const result = await healthCheck();
    return { health: result };
  },
  component: HealthCheck,
});

function HealthCheck() {
  const { health } = Route.useLoaderData();

  return <pre style={{ fontFamily: "monospace" }}>{JSON.stringify(health, null, 2)}</pre>;
}

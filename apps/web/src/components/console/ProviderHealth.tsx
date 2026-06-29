/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Provider health status indicator and test connection functionality.
*/
import { useState } from "react";
import { Badge, Button, Spinner, Tooltip, useToast } from "@/components/ui";
import type { Provider } from "@/platform/api/types";

type HealthStatus = "unknown" | "checking" | "healthy" | "unhealthy";

interface ProviderHealthProps {
  provider: Provider;
  compact?: boolean;
}

export function ProviderHealth({ provider, compact = false }: ProviderHealthProps) {
  const [status, setStatus] = useState<HealthStatus>("unknown");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function testConnection() {
    setStatus("checking");
    setError(null);

    try {
      const config = provider.config_json ?? {};
      const endpoint = config.token_endpoint ?? config.authorization_endpoint;

      if (!endpoint || typeof endpoint !== "string") {
        throw new Error("No endpoint configured");
      }

      const response = await fetch(endpoint, {
        method: "HEAD",
        mode: "no-cors",
      });

      setStatus("healthy");
      toast({ tone: "success", title: `${provider.name} is reachable` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setError(message);
      setStatus("unhealthy");
      toast({ tone: "error", title: `${provider.name}`, description: message });
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <HealthBadge status={status} />
        {status === "unknown" && (
          <Button variant="ghost" size="sm" onClick={testConnection}>
            Test
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <HealthBadge status={status} />
        <Button
          variant="secondary"
          size="sm"
          onClick={testConnection}
          disabled={status === "checking"}
        >
          {status === "checking" ? (
            <>
              <Spinner className="h-4 w-4" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function HealthBadge({ status }: { status: HealthStatus }) {
  switch (status) {
    case "checking":
      return (
        <Badge tone="neutral">
          <Spinner className="h-3 w-3" />
          Checking
        </Badge>
      );
    case "healthy":
      return (
        <Tooltip label="Provider endpoint is reachable">
          <Badge tone="success">Healthy</Badge>
        </Tooltip>
      );
    case "unhealthy":
      return (
        <Tooltip label="Cannot reach provider endpoint">
          <Badge tone="danger">Unreachable</Badge>
        </Tooltip>
      );
    default:
      return (
        <Tooltip label="Connection not tested yet">
          <Badge tone="muted">Unknown</Badge>
        </Tooltip>
      );
  }
}

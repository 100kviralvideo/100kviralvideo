"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    SwaggerUIBundle?: (options: {
      url: string;
      dom_id: string;
      deepLinking: boolean;
      persistAuthorization: boolean;
      tryItOutEnabled: boolean;
    }) => unknown;
    ui?: unknown;
  }
}

export function SwaggerDocs() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (document.querySelector('link[data-swagger-ui="true"]')) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    link.dataset.swaggerUi = "true";
    document.head.appendChild(link);
  }, []);

  const initializeSwagger = useCallback(() => {
    if (!window.SwaggerUIBundle) {
      setError("Swagger UI failed to load. Please refresh the page.");
      return;
    }

    window.ui = window.SwaggerUIBundle({
      url: "/api/openapi",
      dom_id: "#swagger-ui",
      deepLinking: true,
      persistAuthorization: true,
      tryItOutEnabled: true,
    });
    setError(null);
  }, []);

  return (
    <>
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onReady={initializeSwagger}
        onError={() =>
          setError("Swagger UI failed to load from the CDN. Please refresh.")
        }
      />
      {error ? (
        <div className="p-6 text-sm text-red-700">{error}</div>
      ) : (
        <div id="swagger-ui" />
      )}
    </>
  );
}

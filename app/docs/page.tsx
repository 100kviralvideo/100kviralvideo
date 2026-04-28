import Script from "next/script";

export const metadata = {
  title: "API Docs | Viral Video Publisher",
};

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-white">
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
      />
      <div id="swagger-ui" />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
      />
      <Script id="swagger-ui-init" strategy="afterInteractive">
        {`
          window.addEventListener("load", function () {
            window.ui = SwaggerUIBundle({
              url: "/api/openapi",
              dom_id: "#swagger-ui",
              deepLinking: true,
              persistAuthorization: true,
              tryItOutEnabled: true,
            });
          });
        `}
      </Script>
    </main>
  );
}

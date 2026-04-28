import { SwaggerDocs } from "./swagger-docs";

export const metadata = {
  title: "API Docs | Viral Video Publisher",
};

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-white">
      <SwaggerDocs />
    </main>
  );
}

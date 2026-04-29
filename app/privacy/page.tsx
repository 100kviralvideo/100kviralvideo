export const metadata = {
  title: "Privacy Policy | 100K Viral Video",
  description: "Privacy policy for the 100K Viral Video publisher dashboard.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-5 py-10 text-zinc-950 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-zinc-500">100K Viral Video</p>
        <h1 className="mt-2 text-3xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: April 29, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-950">
            Information We Process
          </h2>
          <p>
            The service processes video publishing job details such as job IDs,
            video URLs, titles, captions, descriptions, hashtags, duration,
            approval flags, target platforms, publish results, and platform
            response IDs.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">
            Platform Authorization Data
          </h2>
          <p>
            OAuth tokens and API credentials are stored only as environment
            variables in the deployment environment. They are used server-side to
            publish approved content to connected platforms and are not displayed
            in the dashboard.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">
            History Storage
          </h2>
          <p>
            Publishing history may be stored in Google Sheets or temporary
            server memory so the dashboard can show recent clip status across
            YouTube Shorts, Instagram Reels, and TikTok.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">
            Sharing
          </h2>
          <p>
            Video and metadata are sent to the selected publishing platforms
            only when a publish job is submitted. The service does not sell
            personal information.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">
            Data Control
          </h2>
          <p>
            Connected platform access can be revoked through each platform&apos;s
            account or developer settings. Publishing history can be removed by
            deleting the corresponding rows from the configured Google Sheet.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">Contact</h2>
          <p>
            Questions about this privacy policy can be sent to the operator of
            this website through the contact channel listed in the connected app
            submission or hosting account.
          </p>
        </section>
      </article>
    </main>
  );
}

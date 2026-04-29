export const metadata = {
  title: "Terms of Service | 100K Viral Video",
  description: "Terms for using the 100K Viral Video publisher dashboard.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-5 py-10 text-zinc-950 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-zinc-500">100K Viral Video</p>
        <h1 className="mt-2 text-3xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: April 29, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-950">Use of the Service</h2>
          <p>
            100K Viral Video is a publishing workflow used to submit approved
            short-form video clips to connected social platforms. You may use
            the service only for content that you own, are authorized to use, or
            have cleared for publication.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">
            Content Responsibility
          </h2>
          <p>
            You are responsible for all videos, captions, descriptions,
            hashtags, publishing settings, and platform selections submitted
            through the service. Content must comply with applicable laws,
            platform policies, copyright rules, and community guidelines.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">
            Platform Connections
          </h2>
          <p>
            The service uses authorized platform APIs, including YouTube and
            TikTok, to publish or prepare video posts. Connected accounts may be
            revoked at any time through the relevant platform account settings.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">
            Availability
          </h2>
          <p>
            The service is provided as an operational tool and may be modified,
            interrupted, or unavailable due to platform API limits, hosting
            limits, maintenance, or third-party service changes.
          </p>

          <h2 className="pt-4 text-lg font-semibold text-zinc-950">Contact</h2>
          <p>
            Questions about these terms can be sent to the operator of this
            website through the contact channel listed in the connected app
            submission or hosting account.
          </p>
        </section>
      </article>
    </main>
  );
}

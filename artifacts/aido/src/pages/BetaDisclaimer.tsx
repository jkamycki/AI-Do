import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function BetaDisclaimer() {
  return (
    <div className="min-h-screen bg-[#FFF7F2] text-[#3B1C2B]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="mb-8 -ml-2 text-[#6F3E54] hover:text-[#8D294D] hover:bg-[#E6A6B7]/15 gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <div className="space-y-2 mb-10">
          <h1 className="font-serif text-4xl">Beta Disclaimer</h1>
          <p className="text-sm text-[#6F3E54]">Last updated: May 13, 2026</p>
        </div>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <p>
              A.IDO is a public beta. That means everything you see is
              functional but still evolving — features may change, break, or be
              removed without notice. Please use the Service with that in mind,
              especially around irreversible wedding-day decisions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Service Status</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                The Service is provided <em>as-is</em> and <em>as-available</em>{" "}
                with no uptime guarantee.
              </li>
              <li>
                The Service is currently <strong>free of charge</strong>. We
                have no paid features today; if we introduce them in the future,
                you'll get advance notice and an opportunity to opt out.
              </li>
              <li>
                Features may be added, removed, or substantially redesigned
                without prior warning.
              </li>
              <li>
                You may experience bugs, downtime, or unexpected behavior.
                Please report issues via the in-app support widget or email{" "}
                <a
                  className="text-[#8D294D] underline underline-offset-4"
                  href="mailto:support@aidowedding.net"
                >
                  support@aidowedding.net
                </a>
                .
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Data &amp; Backups
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                While we take reasonable care to back up the database, you
                should keep your own independent copy of critical wedding
                details (final guest list, signed vendor contracts, payment
                records, etc.).
              </li>
              <li>
                You can delete your account at any time from Settings → Account.
              </li>
              <li>
                See the Data Handling page for what's stored, where, and for how
                long.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              AI-Generated Output
            </h2>
            <p>
              Many features rely on AI providers (OpenAI and Groq) and produce
              probabilistic, AI-generated output. A.IDO is not a lawyer or law
              firm, and AI output is not legal advice. Always review before
              relying on it for real decisions. Specifically:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                <strong>Aria, the planning assistant,</strong> can take actions
                in your workspace via tool calls (add a vendor, schedule a
                payment, mark a guest, etc.). Server-side validators reject
                obviously bad inputs, but you should still review what was
                added.
              </li>
              <li>
                <strong>The contract analyzer</strong> is AI-generated and
                informational only; it is <em>not</em> legal advice and is not a
                substitute for a real attorney reviewing your vendor contracts.
              </li>
              <li>
                <strong>Vendor email drafts</strong> never auto-send — you
                choose what goes out.
              </li>
              <li>
                <strong>Day-of coordinator</strong> output is general guidance,
                not professional emergency advice.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Reporting Issues
            </h2>
            <p>
              If something looks wrong, especially around payments, guest data,
              or your wedding website going live prematurely, report it
              immediately via the in-app support chat (Aria can file a ticket on
              your behalf) or email{" "}
              <a
                className="text-[#8D294D] underline underline-offset-4"
                href="mailto:support@aidowedding.net"
              >
                support@aidowedding.net
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Limitation of Liability
            </h2>
            <p className="uppercase text-[#3B1C2B]/80 text-xs tracking-wide">
              By using the beta you accept that A.IDO and its operators are not
              liable for indirect, incidental, or consequential damages, lost
              profits, lost data, or wedding-day disruptions arising from your
              use of the Service. The full Limitation of Liability section is in
              the Terms of Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              No Professional Advice
            </h2>
            <p>
              A.IDO provides planning software and AI assistance only. Nothing
              in the Service is legal, financial, accounting, mental-health, or
              emergency-response advice, and no fiduciary duty is created
              between you and A.IDO. You should consult qualified professionals
              for high-stakes decisions.
            </p>
          </section>
        </div>

        <div className="border-t border-[#E6A6B7]/45 pt-6 mt-12 flex items-center justify-between text-xs text-[#6F3E54]">
          <p>
            © {new Date().getFullYear()} A.IDO — AI Wedding Planning OS. All
            rights reserved.
          </p>
          <Link href="/" className="hover:text-[#3B1C2B]">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

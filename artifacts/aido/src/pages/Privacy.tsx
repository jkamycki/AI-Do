import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
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
          <h1 className="font-serif text-4xl">Privacy Policy</h1>
          <p className="text-sm text-[#6F3E54]">Last updated: May 31, 2026</p>
        </div>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">1. Who We Are</h2>
            <p>
              A.IDO is an AI-assisted wedding-planning platform operated by the
              team at aidowedding.net (the "Service," "we," "us"). This Privacy
              Policy explains what information we collect, how we use it, and
              the choices you have.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              2. Information We Collect
            </h2>
            <p>
              <strong>From you, when you create an account:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Identity and contact data (name, email, optional phone, profile
                photo) handled by our authentication provider, Clerk.
              </li>
              <li>
                Wedding profile (couple names, wedding date, venue, location,
                ceremony / reception times, guest count, budget, theme).
              </li>
              <li>Preferred language for UI and AI responses.</li>
            </ul>
            <p>
              <strong>From you, when you use the planner:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Vendor records (contact info, contracts you upload, deposit
                amounts, partial payments, paid-in-full status, next payment
                dates, receipts, payment milestones, notes).
              </li>
              <li>
                Guest list (name, email, phone, address, dietary notes,
                plus-ones, RSVP status, RSVP messages, hotel needs, booked
                hotel-room counts, meal choices, table assignment).
              </li>
              <li>
                Guest collector submissions and invitation-link activity,
                including contact-info request tokens and delivery/status
                indicators.
              </li>
              <li>Wedding-party member directory.</li>
              <li>Hotel block details.</li>
              <li>Mood-board images (uploaded photos).</li>
              <li>Seating-chart layouts.</li>
              <li>
                Wedding website content (text, images, theme, schedule, registry
                links, RSVP responses, mobile/desktop layout settings, share
                links, and QR codes).
              </li>
              <li>
                Photo Drop settings and uploads, including disposable-camera
                session state, guest-submitted photos, owner approvals, and
                whether photos are portal-only or also published to the wedding
                website.
              </li>
              <li>
                Vendor Partner Network messages, saved partner records, and any
                partner inquiries you start from a public partner profile.
              </li>
              <li>Day-of timeline events.</li>
              <li>
                Budget financial reports, PDF/Excel exports, and related export
                metadata.
              </li>
              <li>
                Conversations with our AI assistant (Aria) and AI support
                assistant.
              </li>
              <li>Support tickets you file via the support widget.</li>
            </ul>
            <p>
              <strong>From your guests, on the public wedding website:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Name, email, attendance, meal choice, dietary notes, plus-one
                details, hotel needs, booked room counts, and any free-text
                message they include with their RSVP. Off-list
                guests can self-add via "RSVP anyway" — that data is also
                stored.
              </li>
              <li>
                Through guest collector links: name, mailing address, email,
                phone, plus-one information, meal notes, dietary notes, and
                submission timestamps.
              </li>
              <li>
                Through Photo Drop links or QR codes: photos guests choose to
                capture or upload, upload timestamps, and device/session signals
                used to enforce shot limits and prevent duplicate disposable
                camera rolls.
              </li>
            </ul>
            <p>
              <strong>From vendors who apply to partner with A.IDO:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Business contact details, category, service area, website,
                social links, public-facing about and services copy, starting
                price, logo, service photos, badge preferences, and application
                status.
              </li>
            </ul>
            <p>
              <strong>Automatically:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Standard server logs (IP address, user-agent, timestamps,
                request paths) for security and debugging.
              </li>
              <li>
                Basic product-analytics events (e.g. user login, feature
                first-use) to understand engagement.
              </li>
              <li>
                Cookies / local storage for authentication tokens, language
                preference, account-switching flow state, and UI state. We do
                not use third-party advertising or cross-site tracking cookies.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                To operate the Service — display your data, sync changes across
                collaborators, generate AI output, send transactional email
                (RSVP confirmations, support replies, collaborator invites,
                guest collector links, save-the-date and RSVP invitation links,
                reminders, vendor emails).
              </li>
              <li>
                To improve product quality and debug issues, using aggregate or
                anonymized signals where possible.
              </li>
              <li>
                To enforce our Terms, prevent abuse, and protect users
                (rate-limiting, fraud detection).
              </li>
              <li>To respond to your support requests.</li>
              <li>
                To review vendor partner applications, create approved public
                partner profiles, display partner badges, and route partner
                messages or inquiries.
              </li>
            </ul>
            <p>
              We do not sell your personal information. We do not use your data
              to train third-party AI models.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              4. AI Processing
            </h2>
            <p>
              When you use AI features (Aria, the support assistant, AI vendor
              email drafts, AI contract analysis, AI timeline / checklist / mood
              board generation, AI seating chart, AI day-of coordinator), the
              prompts and any necessary context (e.g. your guest count, vendor
              list, contract text) are transmitted to our third-party AI
              providers — currently <strong>OpenAI</strong> and{" "}
              <strong>Groq</strong> — for processing and returned to you. Per
              their policies at the time of writing, neither provider trains its
              public models on API customer data, and content is retained only
              briefly for abuse monitoring (≤30 days). We don't include your
              account email or wedding-website slug in AI prompts unless you
              explicitly type them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              5. Sharing Your Information
            </h2>
            <p>We share information only with:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                <strong>Workspace collaborators</strong> you invite (partner,
                planner, vendor) under role-based permissions.
              </li>
              <li>
                <strong>Subprocessors</strong> needed to run the Service: Clerk
                (auth), Resend (email delivery), OpenAI and Groq (AI inference),
                our hosting and database providers (currently Render and
                Postgres-as-a-service). See the Data Handling page for the full
                list and what each receives.
              </li>
              <li>
                <strong>Legal authorities</strong> if required by valid legal
                process or to protect rights, safety, and the integrity of the
                Service.
              </li>
              <li>
                <strong>Acquirers</strong> in the unlikely event of a sale,
                merger, or acquisition; you'll be notified before your
                information is transferred.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              6. Public Wedding Website
            </h2>
            <p>
              When you publish a wedding website, the content you mark as
              published becomes publicly accessible at your chosen URL and may
              be indexed by search engines unless you set a password. Anything
              you put on the public site (couple names, wedding date, venue,
              photos, schedule) is no longer private. RSVP submissions from your
              guests are stored in your private workspace, not displayed on the
              public site.
            </p>
            <p>
              Photo Drop uploads always go to your private portal first. Only
              photos you approve for the wedding website are displayed publicly,
              and the Service may enforce a maximum number of website-published
              Photo Drop photos to keep guest sites performant.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              7. Your Rights &amp; Choices
            </h2>
            <p>Depending on where you live, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>Access, correct, or export your personal data.</li>
              <li>
                Delete your account and the associated wedding workspace from
                Settings → Account.
              </li>
              <li>Withdraw consent for any optional processing.</li>
              <li>Object to or restrict processing in some circumstances.</li>
              <li>
                Lodge a complaint with your local data-protection authority.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact{" "}
              <a
                className="text-[#8D294D] underline underline-offset-4"
                href="mailto:support@aidowedding.net"
              >
                support@aidowedding.net
              </a>
              . We respond within a reasonable time — typically 30 days.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              8. Data Retention
            </h2>
            <p>
              We retain your data while your account is active. When you delete
              your account, we permanently remove your wedding profile, budget,
              checklist, timeline, vendors, contracts, mood board, guest list,
              seating charts, wedding party, hotel blocks, wedding website, and
              AI conversation history. Backups are retained for up to 30 days
              for disaster-recovery purposes and then purged. Aggregated,
              non-identifying analytics may be retained longer.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">9. Children</h2>
            <p>
              The Service is not directed to children under 18 and we do not
              knowingly collect their personal data. If you believe a minor has
              provided us information, contact us and we will delete it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              10. International Transfers
            </h2>
            <p>
              We are based in the United States. If you access the Service from
              outside the US, you consent to transferring your data to the US
              for processing. Where required (e.g. EU/EEA users), we rely on
              standard contractual clauses or equivalent transfer mechanisms
              with our subprocessors.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this policy from time to time. Material changes will
              be communicated by email or in-app notice. Continued use after the
              effective date constitutes acceptance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              12. Legal Basis &amp; Regional Disclosures
            </h2>
            <p>
              Where required by applicable law, we process personal data under
              one or more of the following legal bases: performance of a
              contract, legitimate interests, legal compliance, and consent.
              California residents may have rights to know, correct, delete, and
              limit certain uses of sensitive information. We do not sell or
              share personal information for cross-context behavioral
              advertising.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">13. Contact</h2>
            <p>
              Privacy questions or data-rights requests:{" "}
              <a
                className="text-[#8D294D] underline underline-offset-4"
                href="mailto:support@aidowedding.net"
              >
                support@aidowedding.net
              </a>
              .
            </p>
          </section>
        </div>

        <div className="border-t border-[#E6A6B7]/45 pt-6 mt-12 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6F3E54]">
          <p>
            © {new Date().getFullYear()} A.IDO — AI Wedding Planning OS. All
            rights reserved.
          </p>
          <Link href="/" className="hover:text-[#3B1C2B]">
            Home
          </Link>
          <Link href="/for-vendors/apply" className="hover:text-[#3B1C2B]">
            Vendors
          </Link>
        </div>
      </div>
    </div>
  );
}

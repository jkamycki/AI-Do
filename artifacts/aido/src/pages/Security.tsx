import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Security() {
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
          <h1 className="font-serif text-4xl">Security</h1>
          <p className="text-sm text-[#6F3E54]">Last updated: May 18, 2026</p>
        </div>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Authentication</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Authentication is handled by <strong>Clerk</strong>, an
                industry-standard auth provider supporting bcrypt password
                hashing, single sign-on, multi-factor authentication, and
                Have-I-Been-Pwned-checked password breach detection.
              </li>
              <li>
                Sessions are issued as short-lived JWTs and rotated
                automatically.
              </li>
              <li>
                Workspace access is enforced server-side via role-based
                permissions (owner, partner, planner, vendor) on every API
                request, scoped by profile ID.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Data In Transit
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                All traffic to the Service uses TLS 1.2+ (HTTPS). Plaintext HTTP
                is redirected to HTTPS.
              </li>
              <li>
                Webhooks from third-party providers (e.g. Resend) are
                signature-verified before processing.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Data At Rest</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Application data is stored in a managed Postgres database with
                encryption at rest enabled by the hosting provider.
              </li>
              <li>
                Uploaded files (mood-board photos, contract PDFs, Document
                Library files, member headshots, wedding-website hero images)
                are stored in object
                storage with access tokens — direct URLs are not publicly
                readable.
              </li>
              <li>
                Database backups are taken regularly by the hosting provider and
                retained per their policy (typically up to 30 days).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              AI Provider Boundary
            </h2>
            <p>
              When you use AI features, the relevant prompt and necessary
              context are sent to OpenAI or Groq. Per their API policies at the
              time of writing, they do not train public models on API customer
              data and retain content only briefly (≤30 days) for abuse
              monitoring. We do not include unrelated personal identifiers in
              prompts. Conversation history with our AI assistant (Aria) is
              stored in your account for resume-on-refresh and to give the model
              session context — you can clear conversations from the Aria
              sidebar.
            </p>
            <p>
              Document Library AI features may send extracted document text or
              image content to the configured AI provider so the Service can
              summarize documents, extract key fields, suggest checklist tasks,
              and suggest vendor links. Only use these features for documents
              you are comfortable processing through the AI boundary.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Application Security
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Server-side validators on every write endpoint (e.g. add_vendor
                refuses category-word names; RSVP endpoints require
                profile-scoped guest IDs).
              </li>
              <li>
                Document Library, contract, and vendor-contact endpoints are
                profile-scoped and protected by authenticated workspace access.
              </li>
              <li>
                Per-user rate limits on AI calls and aggressive limits on
                public, unauthenticated endpoints.
              </li>
              <li>
                Input sanitization in the AI assistant: tool-call envelopes the
                model occasionally writes as text are stripped before reaching
                the user.
              </li>
              <li>
                Content-Security-Policy and other security headers configured at
                the hosting layer.
              </li>
              <li>
                Dependencies tracked via Dependabot; security upgrades reviewed
                regularly.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Wedding-Website Privacy Controls
            </h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                You choose whether to publish your wedding website. Until you
                publish, the public URL returns 404.
              </li>
              <li>
                Optional <strong>password protection</strong> requires guests to
                enter a shared password before loading the page.
              </li>
              <li>
                RSVP submissions are stored in your private workspace, not
                displayed publicly.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Reporting a Vulnerability
            </h2>
            <p>
              If you believe you've found a security issue, please email{" "}
              <a
                className="text-[#8D294D] underline underline-offset-4"
                href="mailto:security@aidowedding.net"
              >
                security@aidowedding.net
              </a>
              with details and steps to reproduce. We will acknowledge within 5
              business days. Please do not publicly disclose the issue until
              we've had a reasonable opportunity to fix it.
            </p>
            <p>
              We don't currently run a bug-bounty program, but we appreciate
              good-faith reports and will credit researchers who request it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">No Guarantees</h2>
            <p className="text-[#3B1C2B]/80 text-sm">
              While we apply industry-standard practices, no system is perfectly
              secure. The Service is provided "as is" with the disclaimers in
              our{" "}
              <Link href="/terms" className="text-[#8D294D] underline underline-offset-4">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/beta" className="text-[#8D294D] underline underline-offset-4">
                Beta Disclaimer
              </Link>
              . You are responsible for keeping your own credentials safe and
              for retaining backups of important wedding data.
            </p>
            <p className="text-[#3B1C2B]/80 text-sm">
              We do not represent that our controls satisfy any specific
              certification framework (such as SOC 2, ISO 27001, HIPAA, or PCI
              DSS) unless we explicitly publish that status in writing.
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

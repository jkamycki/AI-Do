import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function Terms() {
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

        <div className="rounded-xl border border-[#E6A6B7]/60 bg-[#F2E2C6]/45 p-4 mb-8 flex items-start gap-3 text-[#6F3E54]">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-[#8D294D]" />
          <div className="space-y-1 text-sm leading-relaxed">
            <p className="font-semibold text-[#8D294D]">
              Draft — review with legal counsel before publishing.
            </p>
            <p>
              This page is an AI-assisted draft tailored to A.IDO's current
              feature set. It is not legal advice. Have a New York-licensed
              attorney review and finalize before relying on these terms for
              actual users.
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-10">
          <h1 className="font-serif text-4xl text-[#3B1C2B]">Terms of Service</h1>
          <p className="text-sm text-[#6F3E54]">Last updated: May 13, 2026</p>
        </div>

        <div className="space-y-8 leading-relaxed text-[#3B1C2B]">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using A.IDO ("the Service," "we," "us," or "our"),
              you agree to be bound by these Terms of Service ("Terms"). If you
              do not agree, do not access or use the Service. These Terms apply
              to all visitors, registered users, collaborators (partners,
              planners, vendors, family members invited to a workspace), and
              anyone who interacts with a wedding website published through the
              Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              2. Description of the Service
            </h2>
            <p>
              A.IDO is an AI-assisted wedding-planning platform. The Service
              currently provides:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                <strong>Wedding profile</strong> — couple names, wedding date,
                venue, guest count, budget, theme, and related details.
              </li>
              <li>
                <strong>AI timeline generator</strong> — drafts a
                minute-by-minute day-of schedule, downloadable as a PDF.
              </li>
              <li>
                <strong>Smart checklist</strong> — month-by-month task
                suggestions tailored to your wedding date.
              </li>
              <li>
                <strong>Budget manager</strong> — tracks estimated vs. actual
                costs, deposits, payment milestones, and vendor totals.
              </li>
              <li>
                <strong>Vendor tracking</strong> — store vendor contacts,
                contract status, deposit milestones, and notes.
              </li>
              <li>
                <strong>AI vendor email assistant</strong> — drafts professional
                emails to send to vendors.
              </li>
              <li>
                <strong>AI contract analyzer</strong> — uploads vendor contracts
                and surfaces summary plus flagged terms.
              </li>
              <li>
                <strong>Mood board</strong> — image collection and AI-assisted
                style suggestions; PDF export.
              </li>
              <li>
                <strong>Guest list &amp; invitations</strong> — guest data,
                dietary notes, RSVP tokens, save-the-date and digital invitation
                flows.
              </li>
              <li>
                <strong>Hotel blocks</strong> — booking link, code, room counts.
              </li>
              <li>
                <strong>Wedding party</strong> — bridesmaid / groomsmen /
                officiant directory.
              </li>
              <li>
                <strong>Seating chart</strong> — AI table generation,
                drag-to-rearrange editor, PDF export.
              </li>
              <li>
                <strong>Day-of coordinator</strong> — AI emergency helper used
                during the wedding day.
              </li>
              <li>
                <strong>Wedding website</strong> — couples publish a public
                guest site at a chosen URL with RSVP, schedule, registry,
                gallery, etc.
              </li>
              <li>
                <strong>Aria</strong> — an AI planning assistant that can read
                and (with confirmation) modify your data via tool calls.
              </li>
              <li>
                <strong>Workspace collaboration</strong> — invite a partner,
                planner, or vendor with role-based access.
              </li>
              <li>
                <strong>Support chat</strong> — an AI support assistant that can
                file support tickets on your behalf.
              </li>
            </ul>
            <p>
              The Service is provided for personal, non-commercial use unless
              otherwise agreed in writing. Features may be added, modified, or
              removed during the beta period without notice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              3. Beta Status &amp; No-Cost Use
            </h2>
            <p>
              A.IDO is currently offered free of charge as a public beta. We
              reserve the right to introduce paid features in the future, in
              which case we will provide reasonable advance notice and an
              opportunity to cancel or downgrade before any charge is incurred.
              By using the beta you accept that the Service may have bugs,
              partial features, downtime, or data loss; you should retain
              independent backups of important wedding details, guest lists,
              vendor records, invitations, uploaded files, and any other content
              you add to the Service. See also the Beta Disclaimer page.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">4. Eligibility</h2>
            <p>
              You must be at least 18 years old and able to enter into a legally
              binding contract in your jurisdiction. By agreeing to these Terms
              you represent that both conditions are met.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              5. Your Account &amp; Workspace
            </h2>
            <p>
              Authentication is handled by Clerk. You are responsible for
              keeping your credentials confidential and for every action taken
              under your account. When you invite collaborators (partner /
              planner / vendor), they receive scoped access to your wedding
              workspace under role-based permissions. You are responsible for
              who you invite and what they do with the access you grant. We may
              suspend or terminate accounts that violate these Terms or that
              show signs of compromise.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              6. Your Content &amp; Guest Data
            </h2>
            <p>
              You retain ownership of all content you upload (text, images,
              contracts, mood boards, vendor records, guest lists, RSVPs,
              wedding-website edits). By uploading you grant A.IDO a
              non-exclusive license to host, process, transmit, display, and
              back up that content solely to operate the Service for you and
              your workspace collaborators. You are responsible for ensuring you
              have the right to upload any third-party content (e.g. photos
              taken by your photographer) and for collecting any consents
              required to import your guests' personal data into the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              7. AI Features &amp; AI Output
            </h2>
            <p>
              The Service uses third-party AI providers (currently OpenAI and
              Groq) to generate text, suggestions, drafts, summaries, and
              structured data. AI output is generated probabilistically and may
              be inaccurate, incomplete, biased, or unsafe. You are responsible
              for reviewing all AI-generated content (timelines, emails,
              contract summaries, RSVP messages, etc.) before sending, signing,
              sharing, or relying on it. In particular:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                The AI <em>contract analyzer</em> is informational only and is
                not a substitute for a lawyer.
              </li>
              <li>
                The AI <em>vendor email assistant</em> drafts emails — you
                choose whether to send them.
              </li>
              <li>
                The AI <em>day-of coordinator</em> offers suggestions, not
                professional emergency or medical advice.
              </li>
              <li>
                The AI <em>planner (Aria)</em> can take actions in your
                workspace via tool calls; we apply server-side validation, but
                you are responsible for the final state of your data.
              </li>
            </ul>
            <p>
              We disclaim any warranty that AI output is accurate, fit for
              purpose, or non-infringing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              8. Wedding Website &amp; Public Content
            </h2>
            <p>
              When you publish a wedding website, content you mark as published
              becomes publicly accessible at the URL you choose (e.g.{" "}
              <span className="font-mono text-[#6F3E54]">
                aidowedding.net/w/your-slug
              </span>
              ) and may be indexed by search engines unless you set a password.
              Information your guests submit through the public RSVP flow
              (including off-list "RSVP anyway" submissions) is stored in your
              workspace and visible to your collaborators. You are responsible
              for compliance with applicable privacy laws when collecting guest
              data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              9. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                Upload content that is unlawful, defamatory, obscene, harassing,
                or infringes any third-party rights.
              </li>
              <li>
                Use the Service to send spam, harvest contact information, or
                impersonate others.
              </li>
              <li>
                Probe, scan, or attempt to circumvent security or rate-limiting
                controls.
              </li>
              <li>
                Reverse-engineer or scrape the Service, AI prompts, or AI
                outputs in bulk.
              </li>
              <li>
                Use the Service to operate a competing wedding-planning product.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              10. Third-Party Services
            </h2>
            <p>
              The Service integrates third-party providers including Clerk
              (authentication), Resend (transactional email), OpenAI and Groq
              (AI inference), and our hosting and database providers. Their use
              is governed by their own terms; we are not responsible for their
              acts or omissions. The Privacy Policy and Data Handling page
              describe what is shared with each.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              11. Disclaimer of Warranties
            </h2>
            <p className="uppercase text-[#3B1C2B]/80 text-xs tracking-wide">
              The Service is provided "as is" and "as available" without
              warranty of any kind, express or implied, including but not
              limited to merchantability, fitness for a particular purpose, and
              non-infringement. We do not warrant that the Service will be
              uninterrupted, secure, or error-free.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              12. Limitation of Liability
            </h2>
            <p className="uppercase text-[#3B1C2B]/80 text-xs tracking-wide">
              To the maximum extent permitted by law, A.IDO and its affiliates
              shall not be liable for indirect, incidental, special,
              consequential, or punitive damages, or for loss of profits,
              revenues, data, or goodwill, arising out of or related to the
              Service or these Terms. Total aggregate liability for any claim
              shall not exceed the amount you paid us in the twelve months
              preceding the claim — which during the beta period is $0.
            </p>
            <p className="uppercase text-[#3B1C2B]/80 text-xs tracking-wide">
              You are responsible for maintaining your own copies and backups of
              any information you enter, upload, import, generate, or store in
              the Service. To the maximum extent permitted by law, A.IDO is not
              responsible or liable for deletion, corruption, unauthorized
              access, failure to store, failure to retrieve, or loss of user
              content or wedding data, whether caused by user action,
              collaborator action, account deletion, third-party services,
              technical issues, bugs, outages, or other causes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              13. Indemnification
            </h2>
            <p>
              You agree to defend, indemnify, and hold harmless A.IDO, its
              officers, employees, and contractors from any claim, demand, loss,
              or expense arising out of your content, your use of the Service,
              your guest data handling, or your breach of these Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              14. Termination
            </h2>
            <p>
              You may delete your account at any time from Settings; doing so
              permanently removes your wedding profile, budget, checklist,
              timeline, vendors, contracts, guest list, seating, wedding party,
              and wedding website (subject to backup-retention windows described
              in Data Handling). We may suspend or terminate access for
              violations of these Terms. Once data is deleted, it may not be
              recoverable; you are solely responsible for exporting or saving
              any information you want to keep before deleting an account,
              workspace, guest, vendor, file, invitation, website, or other
              content.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              15. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. Material changes will
              be communicated by email or in-app notice with a reasonable period
              before taking effect. Continued use after the effective date
              constitutes acceptance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              16. Governing Law &amp; Dispute Resolution
            </h2>
            <p>
              These Terms are governed by the laws of the State of New York,
              USA, without regard to conflict-of-law rules. Before filing a
              claim, you agree to first contact us at support@aidowedding.net
              and attempt informal resolution for at least 30 days.
            </p>
            <p>
              If a dispute is not resolved informally, it will be resolved by
              final and binding individual arbitration in New York County, New
              York, under the Commercial Arbitration Rules of the American
              Arbitration Association, except that either party may seek
              injunctive relief in court for intellectual-property misuse or
              security abuse. You and A.IDO waive any right to a jury trial and
              any right to participate in a class, collective, consolidated, or
              representative action.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              17. Force Majeure
            </h2>
            <p>
              We are not liable for any delay or failure to perform caused by
              events beyond our reasonable control, including outages of cloud
              providers, internet failures, labor disputes, natural disasters,
              acts of war, terrorism, civil unrest, or government action.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">18. Contact</h2>
            <p>
              Questions about these Terms? Reach us at{" "}
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

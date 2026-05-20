import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function DataHandling() {
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
          <h1 className="font-serif text-4xl">Data Handling</h1>
          <p className="text-sm text-[#6F3E54]">Last updated: May 20, 2026</p>
        </div>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">What We Store</h2>
            <p>For each wedding workspace, we store:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>
                <strong>Profile</strong> — couple names, wedding date, venue,
                location (city/state/zip), ceremony &amp; reception times, guest
                count, total budget, theme, and preferred language. Language
                preference is stored per user so collaborators can use different
                languages in the same workspace.
              </li>
              <li>
                <strong>Budget</strong> — line items, manual expenses, payment
                logs, vendor totals, deposit milestones, partial-payment status,
                paid-in-full status, next payment dates, receipts, notes, and
                generated PDF / Excel financial reports.
              </li>
              <li>
                <strong>Checklist</strong> — month-by-month tasks and completion
                state.
              </li>
              <li>
                <strong>Timeline</strong> — minute-by-minute day-of events and
                any AI-generated drafts.
              </li>
              <li>
                <strong>Vendors</strong> — name, category, email, phone,
                contracts, deposit amount, contract-signed flag, notes.
              </li>
              <li>
                <strong>Vendor contacts</strong> - contacts synced from the
                vendor list plus manually added contacts, including name,
                optional business name, phone, email, type, source, and hidden
                status.
              </li>
              <li>
                <strong>Vendor messages</strong> — drafted, sent, and received
                emails (when wired through Resend).
              </li>
              <li>
                <strong>Contracts</strong> — uploaded contract PDFs and
                AI-generated summary / risk flags.
              </li>
              <li>
                <strong>Document Library</strong> - uploaded PDFs, DOCX files,
                JPGs, and PNGs; file names, file type, folder, tags, visibility,
                linked vendor, AI summary, extracted text, extracted fields,
                and suggested task information.
              </li>
              <li>
                <strong>Mood board</strong> — uploaded images and AI
                suggestions.
              </li>
              <li>
                <strong>Guest list</strong> — names, optional
                email/phone/address, dietary notes, plus-ones, RSVP status,
                table assignment, save-the-date / e-invite delivery status,
                selected meal choices, RSVP messages, hotel needs, "already
                booked" hotel responses, and booked room counts.
              </li>
              <li>
                <strong>Guest collector</strong> - guest-submitted names,
                mailing addresses, email addresses, phone numbers, meal notes,
                dietary notes, plus-one details, request tokens, and submission
                timestamps.
              </li>
              <li>
                <strong>Hotel blocks</strong> — hotel name, address, code, room
                counts, booking link.
              </li>
              <li>
                <strong>Wedding party</strong> — member names, roles, sides,
                photos, notes (email/phone fields removed).
              </li>
              <li>
                <strong>Seating chart</strong> — table layouts, guest-to-table
                assignments, themes per table.
              </li>
              <li>
                <strong>Wedding website</strong> — slug, theme/colors/fonts,
                custom text, hero photo, gallery, registry links, schedule, FAQ,
                RSVP responses, optional password, desktop/mobile responsive
                layout settings, and published/unpublished status.
              </li>
              <li>
                <strong>Aria conversations</strong> — your messages to Aria and
                her replies (resume-on-refresh).
              </li>
              <li>
                <strong>Support tickets</strong> — name, email, subject,
                message, status, our follow-up notes.
              </li>
              <li>
                <strong>Workspace collaborators</strong> — invited users and
                their assigned roles, invite tokens, invite status, invitee
                email, inviter ID, and timestamps.
              </li>
              <li>
                <strong>Operations and maintenance</strong> - support tickets,
                contact messages, feedback, improvement suggestions,
                maintenance-mode flags, maintenance messages, launch checklist
                items, test-account activity, backup metadata, and admin audit
                events.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Subprocessors</h2>
            <p>To run the Service we share data with these vendors:</p>
            <div className="overflow-x-auto rounded-lg border border-[#E6A6B7]/45">
              <table className="w-full text-sm">
                <thead className="bg-[#F2E2C6]/45 text-[#6F3E54] text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Subprocessor</th>
                    <th className="px-4 py-2.5 font-semibold">Purpose</th>
                    <th className="px-4 py-2.5 font-semibold">Data shared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6A6B7]/35">
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Clerk</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      Authentication, sessions, password breach checks
                    </td>
                    <td className="px-4 py-2.5 align-top text-[#3B1C2B]/80">
                      Email, password hash, profile photo, login events
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Resend</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      Transactional email (RSVP confirmations, invite links,
                      support replies, vendor emails)
                    </td>
                    <td className="px-4 py-2.5 align-top text-[#3B1C2B]/80">
                      Sender, recipient, subject, body
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>OpenRouter</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      AI inference (Aria, contract analyzer, Document Library
                      summary/extraction, mood board suggestions, etc.)
                    </td>
                    <td className="px-4 py-2.5 align-top text-[#3B1C2B]/80">
                      Prompt + context for the requested feature, which may
                      include document text or image content when you ask AI to
                      read or extract a document
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Render</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">API hosting</td>
                    <td className="px-4 py-2.5 align-top text-[#3B1C2B]/80">
                      All API traffic, server logs
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Vercel / Cloudflare</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      Frontend hosting and CDN
                    </td>
                    <td className="px-4 py-2.5 align-top text-[#3B1C2B]/80">
                      Static assets, request metadata, and uploaded file
                      storage/proxying where configured
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Neon</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      Serverless Postgres database with encryption at rest
                    </td>
                    <td className="px-4 py-2.5 align-top text-[#3B1C2B]/80">
                      All workspace data described above
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Cloudflare R2</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      Object storage for uploads and off-Neon logical database
                      backups where configured
                    </td>
                    <td className="px-4 py-2.5 align-top text-[#3B1C2B]/80">
                      Uploaded files, backup files, and metadata required to
                      enforce access controls
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>OpenStreetMap / Nominatim</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      Address autocomplete and distance lookup where enabled
                    </td>
                    <td className="px-4 py-2.5 align-top text-[#3B1C2B]/80">
                      Address search text, request metadata, and returned
                      geocoding results
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[#6F3E54] text-sm">
              We don't use third-party advertising networks, retargeting pixels,
              or session-replay tooling.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Retention</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>Workspace data is retained while your account is active.</li>
              <li>
                When you delete your account from Settings → Account, all
                wedding data (profile, budget, checklist, timeline, vendors,
                vendor contacts, contracts, Document Library files and metadata,
                guest list, seating, wedding party, hotel blocks,
                wedding website, AI conversations) is permanently deleted from
                the primary database.
              </li>
              <li>
                Neon database backups and off-Neon logical backups are retained
                for disaster recovery according to configured retention windows,
                typically about 30 days.
              </li>
              <li>
                Restore operations are admin-only. Before a restore, the system
                creates a pre-restore safety backup where backup storage is
                configured.
              </li>
              <li>
                Server logs are retained for security and debugging for
                typically 30 days.
              </li>
              <li>
                Aggregated, non-identifying analytics may be retained longer for
                product improvement.
              </li>
            </ul>
            <p className="text-sm text-[#6F3E54]">
              We may retain limited records longer when necessary to comply with
              legal obligations, resolve disputes, enforce our agreements,
              detect abuse, or complete tax/accounting requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Export &amp; Portability
            </h2>
            <p>Many surfaces of the Service support export:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-[#3B1C2B]/90">
              <li>The seating chart exports to PDF.</li>
              <li>The day-of timeline exports to PDF.</li>
              <li>The mood board exports to PDF.</li>
              <li>
                Budget summary and payment reports export to PDF and Excel.
              </li>
              <li>RSVP responses export to CSV.</li>
              <li>
                Documents and contracts can be downloaded from their original
                uploaded files where available.
              </li>
              <li>
                For a full account-data export, email{" "}
                <a
                  className="text-[#8D294D] underline underline-offset-4"
                  href="mailto:support@aidowedding.net"
                >
                  support@aidowedding.net
                </a>{" "}
                — we'll respond within a reasonable time, typically 30 days.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">
              Guest-Submitted Data
            </h2>
            <p>
              When a guest RSVPs through your public wedding website, their
              submission is stored in your private workspace. Off-list guests
              who use "RSVP anyway" are stored with the source flag{" "}
              <span className="font-mono text-[#6F3E54]">rsvp_self_add</span> and
              may also include guest messages, meal choices, plus-one details,
              hotel needs, "already booked" hotel responses, and room counts.
              Guest collector submissions are stored in the guest list or
              related request records.{" "}
              Off-list submissions also receive a notes line indicating they
              should be verified. As the workspace
              owner, you are the controller of your guests' data — please honor
              any deletion or correction requests they make to you directly.
            </p>
            <p>
              If you are using A.IDO as a couple, planner, or vendor
              coordinator, you are responsible for providing notices and
              obtaining permissions required to share guest personal data with
              us and your collaborators.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Contact</h2>
            <p>
              Questions about data handling, exports, or deletion:{" "}
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

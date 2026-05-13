import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function DataHandling() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="mb-8 -ml-2 text-zinc-300 hover:text-white hover:bg-white/10 gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-8 flex items-start gap-3 text-amber-100">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-300" />
          <div className="space-y-1 text-sm leading-relaxed">
            <p className="font-semibold text-amber-200">
              Draft — review with legal counsel before publishing.
            </p>
            <p>
              This page describes what we store, where we send it, and how long
              we keep it. Confirm everything matches production reality before
              publishing.
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-10">
          <h1 className="font-serif text-4xl">Data Handling</h1>
          <p className="text-sm text-zinc-300">Last updated: May 13, 2026</p>
        </div>

        <div className="space-y-8 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">What We Store</h2>
            <p>For each wedding workspace, we store:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-100">
              <li>
                <strong>Profile</strong> — couple names, wedding date, venue,
                location (city/state/zip), ceremony &amp; reception times, guest
                count, total budget, theme, preferred language.
              </li>
              <li>
                <strong>Budget</strong> — line items, manual expenses, payment
                logs, vendor totals, deposit milestones.
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
                <strong>Vendor messages</strong> — drafted, sent, and received
                emails (when wired through Resend).
              </li>
              <li>
                <strong>Contracts</strong> — uploaded contract PDFs and
                AI-generated summary / risk flags.
              </li>
              <li>
                <strong>Mood board</strong> — uploaded images and AI
                suggestions.
              </li>
              <li>
                <strong>Guest list</strong> — names, optional
                email/phone/address, dietary notes, plus-ones, RSVP status,
                table assignment, save-the-date / e-invite delivery status.
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
                RSVP responses, optional password.
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
                their assigned roles.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Subprocessors</h2>
            <p>To run the Service we share data with these vendors:</p>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-zinc-300 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Subprocessor</th>
                    <th className="px-4 py-2.5 font-semibold">Purpose</th>
                    <th className="px-4 py-2.5 font-semibold">Data shared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Clerk</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      Authentication, sessions, password breach checks
                    </td>
                    <td className="px-4 py-2.5 align-top text-zinc-200">
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
                    <td className="px-4 py-2.5 align-top text-zinc-200">
                      Sender, recipient, subject, body
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>OpenRouter</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      AI inference (Aria, contract analyzer, mood board
                      suggestions, etc.)
                    </td>
                    <td className="px-4 py-2.5 align-top text-zinc-200">
                      Prompt + context for the requested feature
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Render</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">API hosting</td>
                    <td className="px-4 py-2.5 align-top text-zinc-200">
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
                    <td className="px-4 py-2.5 align-top text-zinc-200">
                      Static assets, request metadata
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 align-top">
                      <strong>Neon</strong>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      Serverless Postgres database with encryption at rest
                    </td>
                    <td className="px-4 py-2.5 align-top text-zinc-200">
                      All workspace data described above
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-zinc-300 text-sm">
              We don't use third-party advertising networks, retargeting pixels,
              or session-replay tooling.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold">Retention</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-100">
              <li>Workspace data is retained while your account is active.</li>
              <li>
                When you delete your account from Settings → Account, all
                wedding data (profile, budget, checklist, timeline, vendors,
                contracts, guest list, seating, wedding party, hotel blocks,
                wedding website, AI conversations) is permanently deleted from
                the primary database.
              </li>
              <li>
                Database backups roll forward and are purged after roughly 30
                days.
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
            <p className="text-sm text-zinc-300">
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
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-100">
              <li>The seating chart exports to PDF.</li>
              <li>The day-of timeline exports to PDF.</li>
              <li>The mood board exports to PDF.</li>
              <li>RSVP responses export to CSV.</li>
              <li>
                For a full account-data export, email{" "}
                <a
                  className="text-amber-300 underline"
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
              <span className="font-mono text-zinc-300">rsvp_self_add</span> and
              a notes line indicating they should be verified. As the workspace
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
                className="text-amber-300 underline"
                href="mailto:support@aidowedding.net"
              >
                support@aidowedding.net
              </a>
              .
            </p>
          </section>
        </div>

        <div className="border-t border-white/10 pt-6 mt-12 flex items-center justify-between text-xs text-zinc-400">
          <p>
            © {new Date().getFullYear()} A.IDO — AI Wedding Planning OS. All
            rights reserved.
          </p>
          <Link href="/" className="hover:text-white">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

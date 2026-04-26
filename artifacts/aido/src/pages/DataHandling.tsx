import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function DataHandling() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-8 -ml-2 text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="space-y-2 mb-10">
          <h1 className="font-serif text-4xl text-foreground">Data Handling Statement</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 26, 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Overview</h2>
            <p>
              This Data Handling Statement explains in plain language how A.IDO collects, stores, processes,
              and retains data on your behalf. It is intended to complement our Privacy Policy and Terms of
              Service by providing a practical, transparent description of our data flows and responsibilities.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">2. Types of Data We Handle</h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-foreground">Account Data</p>
                <p className="text-sm">Your email address and display name collected during registration and managed by Clerk (our authentication provider).</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Wedding Profile Data</p>
                <p className="text-sm">Partner names, wedding date, venue, ceremony style, estimated guest count, and other profile information you provide.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Guest Data</p>
                <p className="text-sm">Guest names, contact details, RSVP status, meal preferences, dietary restrictions, seating assignments, and hotel information you enter.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Vendor Data</p>
                <p className="text-sm">Vendor names, categories, contact information, pricing, contract details, payment milestones, and email correspondence managed through the platform.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Financial Data</p>
                <p className="text-sm">Budget allocations, actual spend, vendor payments, and financial summaries. We do not process or store payment card information — no financial transactions occur through A.IDO.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">AI Conversation Data</p>
                <p className="text-sm">Messages you send to Aria, our AI assistant. These are transmitted to Anthropic for processing and stored in our database to maintain your conversation history. You can clear your history at any time.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Uploaded Files</p>
                <p className="text-sm">Contract documents and other files you upload to the Service are stored securely in our infrastructure and associated with your account.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">3. Where Your Data Lives</h2>
            <p>Your data is stored in the following systems:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Primary database:</strong> A managed PostgreSQL instance hosted in the cloud. All data is stored in a single database associated with your user account.</li>
              <li><strong>File storage:</strong> Uploaded files are stored in a secure object storage service (App Storage).</li>
              <li><strong>Authentication:</strong> Your account credentials and session data are managed by Clerk's infrastructure.</li>
              <li><strong>AI processing:</strong> Messages sent to Aria are transmitted to Anthropic's API for real-time processing. Anthropic does not use customer API data to train their models by default.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">4. Data Isolation and Multi-Tenancy</h2>
            <p>
              Each user's data is logically isolated within our database using user-specific identifiers. All
              queries are scoped to the authenticated user's account or workspaces they have been explicitly
              granted access to. We do not commingle data between unrelated accounts, and our API enforces
              server-side authorization checks on every request.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">5. Data Shared with Collaborators</h2>
            <p>
              When you invite a collaborator (e.g., a partner, planner, or day-of coordinator) to your
              workspace, they are granted access to the wedding data within that workspace according to their
              assigned role. You are responsible for choosing whom to invite. Collaborators may view, edit,
              or — depending on their role — delete data within the shared workspace. Revoking access removes
              their ability to access the workspace going forward but does not undo previous actions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Data Retention and Deletion</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Active accounts:</strong> Your data is retained for as long as your account exists and you continue using the Service.</li>
              <li><strong>Account deletion:</strong> When you delete your account through Settings, your wedding data and personal information are scheduled for removal from our active systems. This process may take up to 30 days.</li>
              <li><strong>AI conversation history:</strong> You can clear your Aria conversation history at any time using the "Clear all" function on the Aria page.</li>
              <li><strong>Backups:</strong> Deleted data may persist in encrypted backups for a limited period (typically up to 90 days) before being permanently purged.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Data Export</h2>
            <p>
              We encourage all users to regularly export their important wedding data. Where export tools are
              available within the app (e.g., guest list export, budget data), we encourage you to use them
              and store copies independently. A.IDO is not a system of record and should not be treated as
              your only copy of critical planning information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">8. No Sale of Data</h2>
            <p>
              We do not sell, rent, or trade your personal data or wedding planning information to any third
              party for marketing or commercial purposes. Your data is used solely to provide and improve the
              A.IDO Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Contact</h2>
            <p>
              For questions about how we handle your data, please contact us through the Help &amp; Feedback
              section within the app after signing in.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-border/40 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/logo.png" alt="A.IDO" className="h-10 w-auto object-contain" />
            <span className="font-semibold text-foreground">A.IDO</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} A.IDO — AI Wedding Planning OS. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

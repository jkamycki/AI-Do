import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
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
          <h1 className="font-serif text-4xl text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 26, 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Introduction</h2>
            <p>
              A.IDO ("we," "our," or "us") is committed to protecting your personal information. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use A.IDO — the
              AI-powered wedding planning platform. Please read this policy carefully. By using the Service, you
              consent to the practices described herein.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">2. Information We Collect</h2>
            <p>We collect the following categories of information:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account information:</strong> Your name, email address, and profile details provided during registration.</li>
              <li><strong>Wedding data:</strong> Guest lists, vendor details, budgets, timelines, seating arrangements, checklist items, contracts, and any other planning information you enter into the Service.</li>
              <li><strong>Communications:</strong> Messages you send to vendors via the Service, and any content you submit to the AI assistant (Aria).</li>
              <li><strong>Usage data:</strong> Pages visited, features used, clicks, session duration, and other interaction data collected automatically.</li>
              <li><strong>Device information:</strong> Browser type, operating system, IP address, and device identifiers.</li>
              <li><strong>Cookies and tracking technologies:</strong> We use cookies and similar technologies to maintain sessions, remember preferences, and analyze usage patterns.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Provide, maintain, and improve the Service.</li>
              <li>Process and respond to your requests, including AI assistant queries.</li>
              <li>Send you transactional messages such as account verification and notifications.</li>
              <li>Personalize your experience and deliver relevant features.</li>
              <li>Monitor and analyze usage trends to enhance functionality and user experience.</li>
              <li>Detect, investigate, and prevent fraudulent transactions and abuse.</li>
              <li>Comply with legal obligations and enforce our Terms of Service.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">4. AI Processing of Your Data</h2>
            <p>
              When you interact with Aria, our AI planning assistant, the content of your messages — including
              wedding details, vendor information, and planning questions — is transmitted to a third-party AI
              provider (Anthropic) for processing. This data is used solely to generate a response to your query.
              We do not sell your conversation data, and we configure our AI integrations to minimize data
              retention by the provider. Please do not share sensitive personal information (e.g., credit card
              numbers, government ID numbers) with the AI assistant.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">5. Sharing of Your Information</h2>
            <p>We do not sell your personal information. We may share your data with:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Service providers:</strong> Trusted third parties who assist in operating the Service (e.g., hosting, authentication, AI processing, email delivery) under appropriate confidentiality obligations.</li>
              <li><strong>Collaborators:</strong> Users you explicitly invite to your wedding workspace, in accordance with the permissions you grant them.</li>
              <li><strong>Legal authorities:</strong> When required by law, court order, or governmental authority, or to protect the rights, property, or safety of A.IDO, our users, or the public.</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Data Retention</h2>
            <p>
              We retain your personal information and wedding data for as long as your account is active or as
              needed to provide the Service. You may delete your account at any time through the Settings page.
              Upon deletion, we will remove your personal data from our active systems within a reasonable
              timeframe, though some information may remain in backups or logs for a limited period as required
              by law or for legitimate business purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Your Rights and Choices</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate or incomplete data.</li>
              <li>Request deletion of your personal data.</li>
              <li>Opt out of certain data processing activities.</li>
              <li>Data portability — receiving your data in a structured, machine-readable format.</li>
            </ul>
            <p>
              To exercise these rights, please contact us through the Help &amp; Feedback section within the app.
              We will respond to your request within a reasonable timeframe in accordance with applicable law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">8. Cookies</h2>
            <p>
              We use cookies to maintain your authentication session and remember your preferences. You can
              control cookie behavior through your browser settings; however, disabling certain cookies may
              prevent you from using some features of the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Children's Privacy</h2>
            <p>
              The Service is not directed at children under the age of 18. We do not knowingly collect personal
              information from minors. If you believe we have inadvertently collected data from a minor, please
              contact us and we will promptly delete it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will indicate the date of the latest
              revision at the top of this page. Your continued use of the Service after changes are posted
              constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">11. Contact</h2>
            <p>
              If you have questions or concerns about this Privacy Policy or our data practices, please contact
              us through the Help &amp; Feedback section within the app after signing in.
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

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function BetaDisclaimer() {
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
          <h1 className="font-serif text-4xl text-foreground">Beta Disclaimer</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 26, 2026</p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-6 py-5 mb-8">
          <p className="text-amber-400 font-semibold text-sm uppercase tracking-wide mb-1">Beta Software Notice</p>
          <p className="text-foreground/85 text-sm leading-relaxed">
            A.IDO is currently in <strong>public beta</strong>. Features, interfaces, and data handling are subject
            to change without notice. Use the Service with the understanding that it is a work in progress.
          </p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">1. What "Beta" Means</h2>
            <p>
              A product in beta is a pre-release version that is made available to users for the purpose of
              testing, feedback collection, and iterative improvement. Beta software has not undergone the full
              quality assurance process of a finished, production-grade product. While we work diligently to
              provide a reliable and useful experience, by using A.IDO during the beta phase you acknowledge
              and accept the inherent limitations described in this disclaimer.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">2. Known Limitations</h2>
            <p>During the beta period, users may encounter:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Bugs and errors</strong> that cause unexpected behavior or incorrect results.</li>
              <li><strong>Incomplete features</strong> that are still under development or partially implemented.</li>
              <li><strong>Data loss or corruption</strong> resulting from bugs, schema migrations, or server issues.</li>
              <li><strong>Performance degradation</strong> including slow load times or unresponsive UI.</li>
              <li><strong>Service outages or downtime</strong> during maintenance, deployments, or infrastructure events.</li>
              <li><strong>AI inaccuracies</strong> where Aria provides incorrect, incomplete, or misleading information.</li>
              <li><strong>Breaking changes</strong> to features, data structures, or integrations with little or no advance notice.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">3. No Warranty During Beta</h2>
            <p>
              The beta version of A.IDO is provided "as is" and "as available" without any warranties of any
              kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or
              that any defects will be corrected. Your use of the beta Service is entirely at your own risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">4. Data Safety During Beta</h2>
            <p>
              <strong>We strongly recommend that you do not rely on A.IDO as your sole record of any
              wedding-related information during the beta period.</strong> Please maintain your own independent
              copies of all important data — including guest lists, vendor contacts, budget figures, contracts,
              and timelines. A.IDO cannot guarantee data persistence or integrity during the beta phase.
            </p>
            <p>
              Use the data export tools available in the app to regularly save your information externally.
              We are not liable for any loss, corruption, or unavailability of your data during the beta period.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">5. Feedback and Improvement</h2>
            <p>
              Your feedback is essential to making A.IDO better. During the beta period, we encourage you to
              report bugs, share suggestions, and let us know about any issues you encounter through the
              Help &amp; Feedback section within the app. By submitting feedback, you grant us a non-exclusive,
              royalty-free license to use your feedback for product improvement purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Changes and Termination</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue the beta Service at any time, with or
              without notice. We may also end the beta period and transition to a paid or otherwise restructured
              offering. We will make reasonable efforts to communicate material changes to active users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, A.IDO and its owners, operators, employees, agents, and
              licensors shall not be liable for any direct, indirect, incidental, special, consequential, or
              punitive damages arising from your use of the beta Service — including but not limited to data
              loss, planning disruption, or reliance on AI-generated content. This limitation applies even if
              we have been advised of the possibility of such damages.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">8. Contact</h2>
            <p>
              Questions about the beta? Reach us through the Help &amp; Feedback section within the app after signing in.
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

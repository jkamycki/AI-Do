import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Security() {
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
          <h1 className="font-serif text-4xl text-foreground">Security Practices</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 26, 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Our Commitment to Security</h2>
            <p>
              A.IDO takes the security of your wedding data seriously. While no system can guarantee absolute
              security, we implement industry-standard practices designed to protect your personal information
              from unauthorized access, disclosure, alteration, and destruction. This page describes the key
              security measures we employ.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">2. Authentication</h2>
            <p>
              User authentication is handled by <strong>Clerk</strong>, a leading identity and access management
              provider. Clerk manages sign-in flows, session tokens, and multi-factor authentication support.
              We do not store passwords ourselves — authentication credentials are managed entirely within
              Clerk's secure infrastructure.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Email-based one-time codes (OTP) for passwordless sign-in.</li>
              <li>OAuth 2.0 via Google for social sign-in.</li>
              <li>Session tokens are short-lived and rotated regularly.</li>
              <li>All authentication endpoints are protected by HTTPS.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">3. Data Transmission</h2>
            <p>
              All data transmitted between your browser and the A.IDO servers is encrypted in transit using
              <strong> TLS (Transport Layer Security)</strong>. We enforce HTTPS on all endpoints and do not
              allow unencrypted HTTP connections to the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">4. Data Storage</h2>
            <p>
              Your wedding data is stored in a <strong>managed PostgreSQL database</strong> hosted in a secure,
              access-controlled cloud environment. Database access is restricted to the application server only
              and is not exposed to the public internet. We apply principle-of-least-privilege to all
              infrastructure access.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">5. API Security</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All API endpoints require a valid, authenticated session token — unauthenticated requests are rejected.</li>
              <li>Server-side authorization checks ensure users can only access their own data or data explicitly shared with them.</li>
              <li>API rate limiting is applied to reduce the risk of abuse and denial-of-service attempts.</li>
              <li>User inputs are validated and sanitized before processing to prevent injection attacks.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Third-Party Services</h2>
            <p>
              A.IDO integrates with trusted third-party providers to deliver key features. These include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Clerk</strong> — authentication and identity management.</li>
              <li><strong>Anthropic (Claude)</strong> — AI assistant processing. Data sent to Anthropic is used only to generate responses and is governed by Anthropic's data usage policies.</li>
              <li><strong>Replit</strong> — infrastructure hosting and deployment.</li>
              <li><strong>SendGrid / email provider</strong> — transactional email delivery.</li>
            </ul>
            <p>
              All third-party providers are selected based on their security reputations and are contractually
              bound to handle data appropriately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Access Controls</h2>
            <p>
              Access to production systems and databases is limited to authorized personnel only. We use
              role-based access controls internally and audit access to sensitive systems. Administrative
              actions on the platform are logged for accountability.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">8. Vulnerability Disclosure</h2>
            <p>
              If you discover a security vulnerability in A.IDO, please report it responsibly through the
              Help &amp; Feedback section within the app. We take security reports seriously and will
              investigate all credible reports promptly. We ask that you do not publicly disclose
              vulnerabilities until we have had a reasonable opportunity to address them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Limitations</h2>
            <p>
              Despite our best efforts, no security system is impenetrable. A.IDO cannot guarantee that
              unauthorized third parties will never be able to defeat our security measures or use your
              information for improper purposes. You acknowledge that you provide your information at your
              own risk. We encourage you to use strong, unique credentials for your account and to report
              any suspicious activity immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">10. Updates to This Page</h2>
            <p>
              As our security practices evolve, we will update this page to reflect those changes. We
              encourage you to review this page periodically to stay informed about how we protect your data.
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

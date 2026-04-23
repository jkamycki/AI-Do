import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-8 -ml-2 text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="space-y-2 mb-10">
          <h1 className="font-serif text-4xl text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: April 23, 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground/90 leading-relaxed">

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using A.IDO ("the Service," "we," "us," or "our"), you agree to be bound by these
              Terms of Service ("Terms"). If you do not agree to all of these Terms, do not access or use the Service.
              These Terms apply to all visitors, users, and anyone else who accesses or uses the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p>
              A.IDO is an AI-powered wedding planning platform that provides tools including but not limited to:
              wedding timelines, budget management, guest list management, vendor communications, contract review
              assistance, seating chart generation, checklist tracking, and an AI planning assistant. The Service
              is provided for personal, non-commercial use only unless otherwise agreed in writing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">3. Eligibility</h2>
            <p>
              You must be at least 18 years old to use the Service. By agreeing to these Terms, you represent and
              warrant that you are at least 18 years of age and have the legal capacity to enter into this agreement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">4. User Accounts</h2>
            <p>
              To access certain features of the Service, you must register for an account. You agree to provide
              accurate, current, and complete information during registration and to keep your account information
              updated. You are solely responsible for maintaining the confidentiality of your login credentials and
              for all activities that occur under your account. You must notify us immediately of any unauthorized
              use of your account. We are not liable for any loss or damage arising from your failure to protect
              your account credentials.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">5. User Content</h2>
            <p>
              You retain ownership of all content, data, and information you submit to the Service ("User Content"),
              including guest lists, vendor details, budgets, and wedding details. By submitting User Content, you
              grant us a limited, non-exclusive, royalty-free license to use, store, and process your User Content
              solely for the purpose of providing and improving the Service. You are solely responsible for ensuring
              that your User Content does not violate any applicable laws, regulations, or third-party rights.
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-5">
            <h2 className="font-serif text-xl font-semibold text-foreground">6. Data Storage, Backups, and Loss of Data</h2>
            <p>
              <strong>You are solely responsible for maintaining your own backups of any User Content you submit
              to the Service.</strong> While we take commercially reasonable measures to store your data securely
              and reliably, A.IDO <strong>does not guarantee</strong> the availability, accuracy, integrity, or
              continued retention of any User Content, and we expressly disclaim any obligation to act as a
              backup, archival, or recovery service.
            </p>
            <p>
              You acknowledge and agree that User Content — including but not limited to wedding profiles, guest
              lists, vendor records, budgets, contracts, photos, messages, seating charts, checklists, timelines,
              uploaded files, and AI-generated content — <strong>may be lost, corrupted, deleted, modified, or
              rendered inaccessible</strong> as a result of, without limitation:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>your own actions or those of any collaborator, guest, or third party with access to your account or workspace;</li>
              <li>account deletion, account suspension, or termination of the Service or your use of it;</li>
              <li>technical failures, hardware or software malfunctions, network outages, data center incidents, or service interruptions;</li>
              <li>security incidents, unauthorized access, malware, or cyberattacks;</li>
              <li>bugs, errors, deployments, schema changes, migrations, or maintenance operations performed on the Service;</li>
              <li>third-party service providers (including but not limited to hosting, storage, email delivery, AI providers, and authentication services);</li>
              <li>force majeure events, natural disasters, governmental actions, or any cause outside our reasonable control.</li>
            </ul>
            <p>
              <strong>To the maximum extent permitted by applicable law, A.IDO and its owners, operators,
              employees, agents, contractors, and licensors shall have no liability whatsoever to you or any
              third party for any loss, deletion, corruption, or unavailability of User Content, or for any
              direct, indirect, incidental, consequential, special, punitive, or exemplary damages arising from
              or relating to such loss, including but not limited to loss of revenue, lost profits, lost business
              opportunities, emotional distress, missed deadlines, or wedding-related disruption.</strong>
            </p>
            <p>
              We strongly recommend that you regularly export and retain your own copies of any wedding-related
              information you consider important, using the export tools provided within the Service or by
              copying the data manually. Your continued use of the Service constitutes your acceptance of this
              risk and your agreement that the Service is not, and shall not be deemed to be, your system of
              record for any data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">7. Shared Workspaces and Collaborators</h2>
            <p>
              The Service allows the account owner ("Owner") of a wedding workspace to invite additional users
              ("Collaborators") to view, edit, or otherwise interact with the Owner's wedding data, subject to
              the role and permissions assigned by the Owner. By inviting a Collaborator, the Owner authorizes
              that person to access, modify, add, or — depending on their role — <strong>delete</strong> data
              within the shared workspace.
            </p>
            <p>
              You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>The Owner is solely responsible for choosing whom to invite, the role assigned, and the consequences of any actions taken by Collaborators within the workspace.</li>
              <li>A.IDO is not liable for any loss, deletion, alteration, disclosure, or misuse of User Content caused by a Collaborator, an invited guest, or any other party with access granted by the Owner.</li>
              <li>Removing a Collaborator's access does not, on its own, restore data the Collaborator may have changed or deleted while their access was active.</li>
              <li>Inviting a Collaborator may involve sharing personal information about you, your partner, your guests, and your vendors. You represent that you have any necessary consents to do so.</li>
              <li>Collaborators are bound by these Terms when they access the Service, and you agree to inform anyone you invite of these obligations.</li>
            </ul>
            <p>
              Removing a Collaborator from a workspace revokes their future access only; it does not delete the
              underlying wedding data, which continues to be owned and controlled by the Owner.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">8. AI-Generated Content & Limitations</h2>
            <p>
              A.IDO uses artificial intelligence to generate suggestions, timelines, emails, seating arrangements,
              and other planning content. You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>AI-generated content is provided for informational and planning assistance purposes only.</li>
              <li>AI outputs may contain errors, omissions, or inaccuracies and should not be relied upon as
                professional legal, financial, or contractual advice.</li>
              <li>Contract analysis features do not constitute legal advice. Always consult a qualified attorney
                before signing any vendor contract.</li>
              <li>We make no guarantee that AI-generated suggestions are suitable for your specific circumstances.</li>
              <li>You are solely responsible for reviewing and verifying all AI-generated content before acting on it.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">9. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</li>
              <li>Upload or transmit harmful, abusive, harassing, defamatory, or objectionable content.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure.</li>
              <li>Use automated tools, bots, or scripts to access the Service without written permission.</li>
              <li>Resell, sublicense, or commercially exploit the Service without prior written consent.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>Collect or harvest any personally identifiable information from other users without their consent.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">10. Privacy</h2>
            <p>
              Your use of the Service is subject to our Privacy Policy, which is incorporated into these Terms by
              reference. By using the Service, you consent to the collection and use of your information as
              described therein. We take reasonable measures to protect your personal data, but no transmission
              over the internet is 100% secure and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">11. Third-Party Services</h2>
            <p>
              The Service may integrate with or link to third-party services, websites, or platforms. We are not
              responsible for the content, privacy policies, or practices of any third-party services. Your use of
              third-party services is at your own risk and subject to their respective terms and conditions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">12. Intellectual Property</h2>
            <p>
              All content, features, design, logos, trademarks, and technology of the Service are owned by A.IDO
              or its licensors and are protected by applicable intellectual property laws. You may not copy,
              reproduce, distribute, modify, or create derivative works of any part of the Service without our
              express written permission. Nothing in these Terms grants you any rights to use our trademarks,
              logos, or brand features.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">13. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR
              A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
              ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. WE DO NOT WARRANT THE ACCURACY,
              COMPLETENESS, OR RELIABILITY OF ANY CONTENT OBTAINED THROUGH THE SERVICE.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">14. Limitation of Liability</h2>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, A.IDO AND ITS OWNERS, OPERATORS, EMPLOYEES,
              AGENTS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              OR PUNITIVE DAMAGES — INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF REVENUE, LOSS OF PROFITS,
              OR DAMAGE TO REPUTATION — ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE
              SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO
              YOU FOR ANY CLAIM ARISING UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE
              THREE (3) MONTHS PRECEDING THE CLAIM, OR $50 USD, WHICHEVER IS GREATER.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">15. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless A.IDO and its owners, officers, employees,
              agents, and licensors from and against any claims, liabilities, damages, losses, costs, or expenses
              (including reasonable attorneys' fees) arising out of or related to: (a) your use of the Service;
              (b) your violation of these Terms; (c) your User Content; or (d) your violation of any rights of
              any third party.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">16. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account and access to the Service at any time,
              with or without notice, for any reason including violation of these Terms. Upon termination, your
              right to use the Service ceases immediately. Provisions of these Terms that by their nature should
              survive termination shall survive, including ownership provisions, warranty disclaimers, and
              limitations of liability.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">17. Modifications to the Service and Terms</h2>
            <p>
              We reserve the right to modify or discontinue the Service, or any part of it, at any time with or
              without notice. We also reserve the right to update these Terms at any time. We will indicate the
              date of the latest revision at the top of this page. Your continued use of the Service after any
              changes constitutes your acceptance of the updated Terms. It is your responsibility to review
              these Terms periodically.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">18. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States,
              without regard to its conflict of law provisions. Any dispute arising under or in connection with
              these Terms shall be subject to the exclusive jurisdiction of the courts located in the applicable
              jurisdiction. If any provision of these Terms is found to be unenforceable, the remaining provisions
              will continue in full force and effect.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-foreground">19. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us through the Help &amp;
              Feedback section within the app after signing in.
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

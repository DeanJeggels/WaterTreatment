import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'AquaSim — Privacy Notice',
  description: 'How AquaSim processes your personal information under the Protection of Personal Information Act (POPI Act).',
};

export default function PrivacyNoticePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link href="/" className="text-lg font-bold">
            Aqua<span className="text-primary">Sim</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Notice</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Last updated: 16 April 2026
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground">
          <Section title="1. Who we are">
            <p>
              AquaSim is operated by <strong>CH-ISE (PTY) LTD</strong>, a company registered in South Africa.
              We are the responsible party for the purposes of the Protection of Personal Information Act, 2013 (POPI Act).
            </p>
            <p>
              <strong>Information Officer:</strong> Dean Jeggels<br />
              <strong>Email:</strong> dean@ch-ise.co.za
            </p>
          </Section>

          <Section title="2. What information we collect">
            <p>When you create an account, we collect:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Full name</strong> — to personalise your account and proposals</li>
              <li><strong>Company name</strong> — optional, used for proposal branding</li>
              <li><strong>Email address</strong> — for authentication and account recovery</li>
              <li><strong>Password</strong> — stored as a bcrypt hash (we never see or store the plaintext)</li>
            </ul>
            <p>When you use the application, we also process:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Flowsheet designs</strong> — your process unit configurations and parameters</li>
              <li><strong>Proposal data</strong> — client name, project code, location, designer name, executive summary, disclaimer text that you enter into the proposal editor</li>
              <li><strong>Bill of Quantities data</strong> — pricing calculations generated from your designs</li>
              <li><strong>Subscription and billing information</strong> — subscription tier and Stripe customer ID (payment card details are processed by Stripe and never stored by us)</li>
            </ul>
          </Section>

          <Section title="3. Why we process your information">
            <p>We process your personal information for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account management</strong> — creating and maintaining your user account</li>
              <li><strong>Service delivery</strong> — operating the flowsheet editor, simulation engine, proposal generator, and PDF export</li>
              <li><strong>Billing</strong> — processing subscription payments via Stripe</li>
              <li><strong>Communication</strong> — sending you account-related emails (confirmation, password reset)</li>
            </ul>
            <p>
              Our lawful basis for processing is <strong>performance of a contract</strong> (POPI Act §11(1)(b)) — processing is necessary to provide the service you signed up for.
              For billing data shared with Stripe, we rely on <strong>consent</strong> (§11(1)(a)) obtained at account creation.
            </p>
          </Section>

          <Section title="4. Who we share your information with">
            <p>We use the following third-party service providers (operators under the POPI Act):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase (AWS, US/EU)</strong> — database hosting, authentication, file storage</li>
              <li><strong>Netlify (US)</strong> — web application hosting</li>
              <li><strong>Stripe (US)</strong> — payment processing (receives your email and subscription details)</li>
            </ul>
            <p>
              These providers process data outside South Africa. Under POPI Act §72, this transfer is lawful because
              it is necessary for performance of the contract between you and CH-ISE (PTY) LTD (§72(1)(c)),
              and each provider maintains adequate safeguards (Stripe: EU SCCs; Supabase/AWS: SOC 2 Type II; Netlify: SOC 2 Type II).
            </p>
            <p>We do not sell, rent, or share your personal information with any other parties.</p>
          </Section>

          <Section title="5. How we protect your information">
            <ul className="list-disc pl-5 space-y-1">
              <li>All data is transmitted over HTTPS (TLS 1.3)</li>
              <li>Passwords are hashed with bcrypt and never stored in plaintext</li>
              <li>Database access is controlled by Row Level Security — each user can only access their own data</li>
              <li>Session cookies are Secure, HttpOnly, SameSite=Lax</li>
              <li>No personal information is stored in the client-side application code or browser storage</li>
              <li>Stripe API keys and database credentials are stored as server-side environment variables, never shipped to the browser</li>
            </ul>
          </Section>

          <Section title="6. How long we keep your information">
            <p>
              We retain your account data for as long as your account is active. If you delete your account,
              we will delete your personal information, flowsheets, proposals, and billing records within 30 days.
              Anonymised, aggregated usage statistics may be retained indefinitely.
            </p>
            <p>
              Proposal snapshots (immutable records of generated proposals) are retained for audit purposes
              and will be deleted when the parent project is deleted.
            </p>
          </Section>

          <Section title="7. Your rights under the POPI Act">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access</strong> (§23) — request a copy of the personal information we hold about you</li>
              <li><strong>Correction</strong> (§24) — request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion</strong> (§25) — request deletion of your personal information (subject to legal retention obligations)</li>
              <li><strong>Object</strong> (§11(3)) — object to the processing of your personal information on reasonable grounds</li>
              <li><strong>Complaint</strong> — lodge a complaint with the Information Regulator at <em>inforegulator.org.za</em></li>
            </ul>
            <p>
              To exercise any of these rights, email <strong>dean@ch-ise.co.za</strong> with your request.
              We will respond within 30 days.
            </p>
          </Section>

          <Section title="8. Cookies and tracking">
            <p>
              AquaSim uses a single session cookie managed by Supabase Auth for authentication purposes only.
              We do not use analytics cookies, advertising trackers, or any third-party tracking scripts.
              Your theme preference (dark/light mode) is stored in your browser&apos;s localStorage and never sent to our servers.
            </p>
          </Section>

          <Section title="9. Changes to this notice">
            <p>
              We may update this privacy notice from time to time. Material changes will be communicated
              via email to the address associated with your account. The &ldquo;last updated&rdquo; date at the top
              of this page indicates when the notice was last revised.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              If you have questions about this privacy notice or how we handle your personal information,
              contact our Information Officer:
            </p>
            <p>
              <strong>Dean Jeggels</strong><br />
              CH-ISE (PTY) LTD<br />
              dean@ch-ise.co.za
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          AquaSim by CH-ISE (PTY) LTD
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground space-y-2">{children}</div>
    </section>
  );
}

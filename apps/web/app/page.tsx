import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch, FileText, CheckCircle, ArrowRight, Zap, Crown,
  Calculator, Receipt, ClipboardCheck, Layers,
} from 'lucide-react';

const features = [
  {
    icon: GitBranch,
    title: 'Drag-and-drop flowsheet editor',
    description:
      '19 process units — screens, clarifiers, bioreactors, MBR, thickeners, dewatering, dosing, UV, pumps. Connect them on a canvas, set parameters, run the mass balance.',
  },
  {
    icon: Calculator,
    title: 'Every number is defensible',
    description:
      'Sizing, energy, and BoQ values come with the equation, the inputs, and a citation to published literature (Ekama, WRC, Metcalf & Eddy, supplier datasheets). Click any value in the inspector to see the derivation.',
  },
  {
    icon: Receipt,
    title: 'Real SA supplier prices',
    description:
      'Huber, Megavision, Sulzer, Grundfos, Andritz, Alfa Laval, Xylem Wedeco — every BoQ line item is priced from a real supplier catalogue or quote, not a textbook placeholder.',
  },
  {
    icon: ClipboardCheck,
    title: 'DWA compliance, built in',
    description:
      'Every effluent stream is checked against the National Water Act General and Special limits. Pass/fail per parameter, with the exact citation, right in the proposal.',
  },
  {
    icon: FileText,
    title: 'Client proposals in one click',
    description:
      'From simulated flowsheet to a formatted 11-section design report: cover, executive summary, design basis, sizing calculations, aeration design, energy, consumables, Bill of Quantities, effluent compliance, disclaimer. Browser print-to-PDF — no uploads.',
  },
  {
    icon: Layers,
    title: 'Full biological train coverage',
    description:
      'Preliminary treatment through sludge handling: bar screens, grit, equalisation, primary and secondary clarification, MLE / UCT / MBR, thickeners, dewatering, chemical dosing, UV disinfection, inlet pumping. Every unit carries its own sizing, energy, and CapEx.',
  },
];

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For students and evaluation',
    features: ['3 projects', '8 units per flowsheet', '1 scenario per project', '20 sim runs/day'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For consulting engineers',
    features: ['Unlimited projects', '50 units per flowsheet', '10 scenarios per project', 'Unlimited simulations', 'PDF reports'],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: '/month',
    description: 'For teams & municipalities',
    features: ['Everything in Pro', 'Unlimited units', 'Unlimited scenarios', 'Team sharing & workspaces', 'API access'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const processUnits: { category: string; units: string[] }[] = [
  {
    category: 'Preliminary',
    units: ['Coarse Screen', 'Fine Screen', 'Grit Removal', 'Equalisation Tank', 'Inlet Pumping'],
  },
  {
    category: 'Primary',
    units: ['Primary Clarifier'],
  },
  {
    category: 'Biological',
    units: ['Anaerobic Reactor', 'Anoxic Reactor', 'Aerobic Reactor', 'MBR', 'Aeration Blower'],
  },
  {
    category: 'Secondary & Tertiary',
    units: ['Secondary Clarifier', 'UV Disinfection', 'Chemical Dosing'],
  },
  {
    category: 'Sludge',
    units: ['Thickener', 'Dewatering'],
  },
  {
    category: 'Flow & Utility',
    units: ['Influent', 'Effluent', 'Splitter', 'Mixer'],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <span className="text-lg font-bold">
            Aqua<span className="text-primary">Sim</span>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <Badge variant="secondary" className="mb-4 text-xs">
            Web-based wastewater process simulator
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Design. Simulate.{' '}
            <span className="text-primary">Comply.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Build wastewater treatment flowsheets, run mass balance simulations,
            and verify discharge compliance — all in your browser. No installation required.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-base px-8">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-base px-8">
                Sign In
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Free tier includes 3 projects. No credit card required.
          </p>
        </div>
      </section>

      {/* Process Units */}
      <section className="py-12 border-y border-border/50 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-1">19 process units covered</h2>
            <p className="text-sm text-muted-foreground">
              From headworks to sludge disposal — everything you need for a full biological plant design.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {processUnits.map(({ category, units }) => (
              <div key={category}>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{category}</h3>
                <ul className="space-y-1">
                  {units.map((unit) => (
                    <li key={unit} className="flex items-center gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      <span className="text-foreground">{unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-3">Everything you need for process design</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              A modern alternative to desktop simulation software, built for the web.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4 bg-card/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-3">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {tiers.map(({ name, price, period, description, features: tierFeatures, cta, highlighted }) => (
              <Card
                key={name}
                className={`relative ${highlighted ? 'border-primary shadow-lg shadow-primary/10' : 'border-border/50'}`}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="text-xs">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {name === 'Pro' && <Zap className="h-4 w-4 text-primary" />}
                    {name === 'Enterprise' && <Crown className="h-4 w-4 text-primary" />}
                    <CardTitle className="text-lg">{name}</CardTitle>
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{price}</span>
                    <span className="text-muted-foreground text-sm">{period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-2.5 mb-6">
                    {tierFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button
                      className="w-full"
                      variant={highlighted ? 'default' : 'outline'}
                    >
                      {cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">Ready to modernize your process design?</h2>
          <p className="text-muted-foreground mb-8">
            Join engineers who have moved from desktop software to the cloud.
            Design flowsheets, simulate treatment, and verify compliance — anywhere.
          </p>
          <Link href="/register">
            <Button size="lg" className="text-base px-8">
              Create Your Free Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4">
        <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>AquaSim by CH-ISE (PTY) LTD</span>
          <span>Wastewater Treatment Process Simulator</span>
        </div>
      </footer>
    </div>
  );
}

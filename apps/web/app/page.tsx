import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, GitBranch, BarChart3, FileText, Shield, Users,
  CheckCircle, ArrowRight, Zap, Crown,
} from 'lucide-react';

const features = [
  {
    icon: Droplets,
    title: 'Drag-and-Drop Design',
    description: 'Build wastewater treatment flowsheets with 10 process units — influent, clarifiers, bioreactors, splitters, mixers, and more.',
  },
  {
    icon: GitBranch,
    title: 'Real-Time Simulation',
    description: 'Client-side mass balance engine with recycle stream convergence. Results in under 100ms for typical flowsheets.',
  },
  {
    icon: BarChart3,
    title: 'Compliance Checking',
    description: 'Compare effluent quality against configurable discharge standards. Instant pass/fail on COD, BOD, NH3-N, TSS, and TP.',
  },
  {
    icon: FileText,
    title: 'PDF Reports',
    description: 'Generate professional simulation reports with flowsheet summaries, water quality tables, and compliance results.',
  },
  {
    icon: Shield,
    title: '14 WQ Parameters',
    description: 'Track flow, COD, sCOD, BOD5, TKN, NH3-N, NO3-N, TP, TSS, VSS, pH, alkalinity, DO, and temperature at every point.',
  },
  {
    icon: Users,
    title: 'Share & Collaborate',
    description: 'Create view-only share links for clients and colleagues. Enterprise plans include full team workspaces.',
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

const processUnits = [
  'Influent', 'Primary Clarifier', 'Aerobic Bioreactor', 'Anoxic Zone',
  'Anaerobic Zone', 'Secondary Clarifier', 'Splitter', 'Mixer', 'Thickener', 'Effluent',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <span className="text-lg font-bold">
            BioWin <span className="text-primary">Clone</span>
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
      <section className="py-8 border-y border-border/50 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {processUnits.map((unit, i) => (
              <span key={unit} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs font-medium">
                  {unit}
                </span>
                {i < processUnits.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                )}
              </span>
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
          <span>BioWin Clone by CH-ISE (PTY) LTD</span>
          <span>Wastewater Treatment Process Simulator</span>
        </div>
      </footer>
    </div>
  );
}

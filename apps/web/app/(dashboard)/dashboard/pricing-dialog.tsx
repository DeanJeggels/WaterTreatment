'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, Zap, Crown } from 'lucide-react';

const tiers = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For students and evaluation',
    features: [
      '3 projects',
      '8 units per flowsheet',
      '1 scenario per project',
      '20 sim runs/day',
    ],
    highlighted: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For consulting engineers',
    features: [
      'Unlimited projects',
      '50 units per flowsheet',
      '10 scenarios per project',
      'Unlimited simulations',
      'PDF reports',
    ],
    highlighted: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '$199',
    period: '/month',
    description: 'For teams & municipalities',
    features: [
      'Everything in Pro',
      'Unlimited units',
      'Unlimited scenarios',
      'Team sharing & workspaces',
      'API access',
    ],
    highlighted: false,
  },
];

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: string;
  stripeConfigured: boolean;
  onSelectPlan: (plan: string) => void;
  loading: boolean;
}

export default function PricingDialog({
  open,
  onOpenChange,
  currentTier,
  stripeConfigured,
  onSelectPlan,
  loading,
}: PricingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose your plan</DialogTitle>
          <DialogDescription>
            Start free. Upgrade when you need more.
          </DialogDescription>
        </DialogHeader>

        {!stripeConfigured && (
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Stripe is not configured — paid plans are unavailable in dev mode.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const isCurrent = tier.key === currentTier;
            const isPaid = tier.key !== 'free';

            return (
              <Card
                key={tier.key}
                className={`relative ${tier.highlighted ? 'border-primary shadow-md shadow-primary/10' : ''}`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="text-xs">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {tier.key === 'pro' && <Zap className="h-4 w-4 text-primary" />}
                    {tier.key === 'enterprise' && <Crown className="h-4 w-4 text-primary" />}
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    <span className="text-muted-foreground text-sm">{tier.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </CardHeader>
                <CardContent className="pt-2">
                  <ul className="space-y-2 mb-4">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : isPaid && !stripeConfigured ? (
                    <Button className="w-full" variant="outline" disabled>
                      Unavailable in dev
                    </Button>
                  ) : isPaid ? (
                    <Button
                      className="w-full"
                      variant={tier.highlighted ? 'default' : 'outline'}
                      disabled={loading}
                      onClick={() => onSelectPlan(tier.key)}
                    >
                      {loading ? 'Redirecting...' : tier.key === 'enterprise' ? 'Contact Sales' : 'Upgrade to Pro'}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

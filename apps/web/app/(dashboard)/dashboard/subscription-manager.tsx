'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import PricingDialog from './pricing-dialog';

interface Props {
  currentTier: string;
  stripeConfigured: boolean;
}

export default function SubscriptionManager({ currentTier, stripeConfigured }: Props) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleManage() {
    if (currentTier === 'free') {
      setDialogOpen(true);
      return;
    }

    // Paid users: open Stripe Customer Portal
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      alert(`Subscription error: ${message}`);
      console.error('Subscription error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(plan: string) {
    if (!stripeConfigured) return;
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      alert(`Subscription error: ${message}`);
      console.error('Subscription error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleManage} disabled={loading}>
        <Settings className="mr-1 h-3.5 w-3.5" />
        {currentTier === 'free' ? 'Upgrade' : 'Manage Plan'}
      </Button>
      <PricingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentTier={currentTier}
        stripeConfigured={stripeConfigured}
        onSelectPlan={handleSelectPlan}
        loading={loading}
      />
    </>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export default function SubscriptionManager({ currentTier }: { currentTier: string }) {
  const [loading, setLoading] = useState(false);

  async function handleManage() {
    setLoading(true);
    try {
      if (currentTier === 'free') {
        // Redirect to checkout for Pro
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: 'pro' }),
        });
        const { url, error } = await res.json();
        if (error) throw new Error(error);
        window.location.href = url;
      } else {
        // Redirect to Stripe Customer Portal
        const res = await fetch('/api/stripe/portal', {
          method: 'POST',
        });
        const { url, error } = await res.json();
        if (error) throw new Error(error);
        window.location.href = url;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      alert(`Subscription error: ${message}`);
      console.error('Subscription error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleManage} disabled={loading}>
      <Settings className="mr-1 h-3.5 w-3.5" />
      {currentTier === 'free' ? 'Upgrade' : 'Manage Plan'}
    </Button>
  );
}

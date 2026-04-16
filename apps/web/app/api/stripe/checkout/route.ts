import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getProPriceId, getEnterprisePriceId } from '@/lib/stripe/server';
import { createClient } from '@/lib/supabase/server';
import type { PlanTier } from '@/lib/stripe/config';

const priceIds: Record<string, () => string> = {
  pro: getProPriceId,
  enterprise: getEnterprisePriceId,
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { plan?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const plan = body.plan;
    if (!plan || !priceIds[plan]) {
      return NextResponse.json({ error: 'Invalid plan. Must be "pro" or "enterprise".' }, { status: 400 });
    }

    const priceId = priceIds[plan]!();
    if (!priceId) {
      return NextResponse.json({ error: 'Plan not configured — Stripe price ID missing' }, { status: 500 });
    }

    const stripe = getStripe();

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to save Stripe customer ID:', updateError);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.nextUrl.origin}/dashboard?upgraded=true`,
      cancel_url: `${req.nextUrl.origin}/dashboard?cancelled=true`,
      metadata: { supabase_user_id: user.id, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json(
      { error: 'Payment processing failed. Please try again or contact support.' },
      { status: 500 }
    );
  }
}

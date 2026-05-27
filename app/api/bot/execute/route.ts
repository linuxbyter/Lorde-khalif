import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // 1. Clerk session authentication check
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const body = await req.json();
    const { symbol, contract_type, stake, duration } = body;

    if (!symbol || !contract_type || !stake) {
      return NextResponse.json({ error: 'Missing execution arguments' }, { status: 400 });
    }

    // 2. Fetch target user's encrypted Deriv node credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userNode, error: nodeError } = await supabase
      .from('user_nodes')
      .select('deriv_token, selected_account_id, account_type')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (nodeError || !userNode || !userNode.deriv_token) {
      return NextResponse.json({ error: 'Deriv OAuth profile data missing' }, { status: 404 });
    }

    const workerUrl = process.env.RENDER_WORKER_URL;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!workerUrl || !webhookSecret) {
      return NextResponse.json({ error: 'Internal pipeline environment misconfiguration' }, { status: 500 });
    }

    // 3. Dispatch payload straight to the background daemon engine
    console.log(`[Vercel Relay] Offloading trade connection lifecycle frame to Render...`);
    const renderResponse = await fetch(`${workerUrl}/api/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookSecret}`
      },
      body: JSON.stringify({
        context: {
          token: userNode.deriv_token,
          accountId: userNode.selected_account_id,
          userId: clerkUserId,
          isDemo: userNode.account_type === 'demo'
        },
        signal: {
          symbol,
          type: contract_type,
          stake: Number(stake),
          duration: duration ? Number(duration) : 5
        }
      })
    });

    const tradeResult = await renderResponse.json();
    return NextResponse.json(tradeResult, { status: renderResponse.status });

  } catch (error: any) {
    console.error('[Vercel Relay Exception]:', error);
    return NextResponse.json({ error: 'Failed to complete execution relay' }, { status: 500 });
  }
}

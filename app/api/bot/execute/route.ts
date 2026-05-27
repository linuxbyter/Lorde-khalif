import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { executeStrategy } from '../../../../lib/ots/engine';

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const body = await req.json();
    const { bot_id, symbol, contract_type, stake, duration } = body;

    if (!symbol || !contract_type || !stake) {
      return NextResponse.json({ error: 'Missing critical signal parameters' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userNode, error: nodeError } = await supabase
      .from('user_nodes')
      .select('deriv_token, selected_account_id, account_type')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (nodeError || !userNode || !userNode.deriv_token) {
      return NextResponse.json({ 
        error: 'Deriv account context not found. Please connect your account via OAuth first.' 
      }, { status: 404 });
    }

    const context = {
      token: userNode.deriv_token,
      accountId: userNode.selected_account_id,
      userId: clerkUserId,
      isDemo: userNode.account_type === 'demo'
    };

    const signal = {
      symbol,
      type: contract_type as 'CALL' | 'PUT',
      stake: Number(stake),
      duration: duration ? Number(duration) : 5
    };

    console.log(`[API Execute] Forwarding signal to OTS engine for user: ${clerkUserId}`);

    // 🛑 Type assertion added here to satisfy the production compiler union definitions
    const tradeResult = await executeStrategy({ context, signal }) as {
      success: boolean;
      contract_id?: string;
      buy_price?: number;
      error?: string;
    };

    // Strict guard ensures contract_id exists before proceeding
    if (!tradeResult.success || !tradeResult.contract_id) {
      return NextResponse.json({ 
        success: false, 
        error: tradeResult.error || 'Execution failed to yield a contract confirmation ID.' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      contract_id: tradeResult.contract_id,
      buy_price: tradeResult.buy_price
    });

  } catch (error: any) {
    console.error('[API Execute Exception]:', error);
    return NextResponse.json({ error: 'Internal execution exception intercept' }, { status: 500 });
  }
}

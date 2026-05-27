import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DerivWebSocketManager } from '../../../../lib/deriv/websocket';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: NextRequest) {
  try {
    const signal = await request.json();
    const { bot_id, user_id, symbol, contract_type, stake } = signal;

    if (!bot_id || !user_id || !symbol || !contract_type || !stake) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { data: botData, error: botError } = await supabase
      .from('bots')
      .select('status')
      .eq('id', bot_id)
      .eq('user_id', user_id)
      .single();

    if (botError || botData?.status !== 'running') {
      return NextResponse.json({ error: 'Bot inactive or invalid' }, { status: 400 });
    }

    const { data: userNode, error: userError } = await supabase
      .from('user_nodes')
      .select('deriv_token, selected_account_id, account_type')
      .eq('clerk_user_id', user_id)
      .eq('status', 'approved')
      .single();

    if (userError || !userNode) {
      return NextResponse.json({ error: 'Credentials unavailable' }, { status: 403 });
    }

    const wsManager = new DerivWebSocketManager(
      userNode.deriv_token,
      user_id,
      userNode.selected_account_id,
      userNode.account_type === 'demo'
    );

    await wsManager.connect();
    const tradeResult = await wsManager.buyContract(symbol, contract_type, stake, 5);
    
    if (!tradeResult.success) {
      wsManager.disconnect();
      return NextResponse.json({ 
        error: tradeResult.error || 'Execution rejected',
        deriv_stream_history: tradeResult.logs || []
      }, { status: 400 });
    }

    const { data: insertedTrade } = await supabase
      .from('trades')
      .insert({
        bot_id,
        user_id,
        symbol,
        contract_type,
        stake,
        contract_id: tradeResult.contract_id,
        status: 'pending'
      })
      .select()
      .single();

    wsManager.subscribeToContract(tradeResult.contract_id!).then(async (finalUpdate) => {
      if (finalUpdate && insertedTrade) {
        await supabase
          .from('trades')
          .update({
            status: finalUpdate.status,
            profit: finalUpdate.status === 'won' ? stake * 0.95 : -stake
          })
          .eq('id', insertedTrade.id);
      }
      wsManager.disconnect();
    });

    return NextResponse.json({
      success: true,
      mode: "production",
      contract_id: tradeResult.contract_id
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Execution runtime exception thrown',
      message: error?.message || String(error)
    }, { status: 500 });
  }
}

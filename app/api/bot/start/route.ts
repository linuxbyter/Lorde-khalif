import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { bot_id, user_id } = await request.json();

    if (!bot_id || !user_id) {
      return NextResponse.json({ error: 'Missing bot_id or user_id' }, { status: 400 });
    }

    // 1. Verify user has approved Deriv credentials
    const { data: userNode, error: userError } = await supabase
      .from('user_nodes')
      .select('deriv_token, selected_account_id, account_type')
      .eq('clerk_user_id', user_id)
      .eq('status', 'approved')
      .single();

    if (userError || !userNode) {
      return NextResponse.json({ error: 'Approved Deriv account not found' }, { status: 403 });
    }

    // 2. Flip bot status to running
    const { error: botError } = await supabase
      .from('bots')
      .update({ status: 'running' })
      .eq('id', bot_id)
      .eq('user_id', user_id);

    if (botError) {
      return NextResponse.json({ error: 'Failed to start bot in database' }, { status: 500 });
    }

    console.log(`[START] Bot ${bot_id} initialized and running.`);
    return NextResponse.json({ success: true, status: 'running' });

  } catch (error) {
    console.error('[START] Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

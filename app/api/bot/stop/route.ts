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

    // 1. Flip status to stopped
    const { error: botError } = await supabase
      .from('bots')
      .update({ status: 'stopped' })
      .eq('id', bot_id)
      .eq('user_id', user_id);

    if (botError) {
      return NextResponse.json({ error: 'Failed to stop bot in database' }, { status: 500 });
    }

    console.log(`[STOP] Bot ${bot_id} execution halted safely.`);
    return NextResponse.json({ success: true, status: 'stopped' });

  } catch (error) {
    console.error('[STOP] Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

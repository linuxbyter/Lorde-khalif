import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const { bot_type } = await request.json();
    if (!bot_type) {
      return NextResponse.json({ error: 'Missing strategy classification type' }, { status: 400 });
    }

    // Update execution table state parameters
    const { error: botError } = await supabase
      .from('bots')
      .update({
        status: 'stopped',
        stopped_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('bot_type', bot_type);

    if (botError) throw new Error(botError.message);

    return NextResponse.json({ success: true, status: 'stopped' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to dispatch stop protocol' }, { status: 500 });
  }
}

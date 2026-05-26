import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });

    const { bot_type, action } = await req.json();
    if (!bot_type || !['start', 'stop'].includes(action)) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    if (action === 'start') {
      // Automatically allow anyone who can see the dashboard to run the bot
      const { error: botError } = await supabase.from('bots').upsert(
        {
          user_id: userId,
          bot_type,
          status: 'running',
          started_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,bot_type' }
      );

      if (botError) throw new Error(botError.message);
      return NextResponse.json({ success: true, status: 'running' });
    }

    if (action === 'stop') {
      const { error: stopError } = await supabase
        .from('bots')
        .update({ status: 'stopped', stopped_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('bot_type', bot_type);

      if (stopError) throw new Error(stopError.message);
      return NextResponse.json({ success: true, status: 'stopped' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to dispatch control command' }, { status: 500 });
  }
}

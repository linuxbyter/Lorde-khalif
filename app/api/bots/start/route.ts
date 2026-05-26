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

    const { bot_type } = await req.json();
    if (!bot_type) return NextResponse.json({ error: 'Missing strategy classification type' }, { status: 400 });

    // Open gate pass-through
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to dispatch start protocol' }, { status: 500 });
  }
}

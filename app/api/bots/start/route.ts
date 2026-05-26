import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const { bot_type } = await request.json();
    if (!bot_type) {
      return NextResponse.json({ error: 'Missing strategy classification type' }, { status: 400 });
    }

    // Safety Verification check: Is the user approved by Lord Khalif?
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('status')
      .eq('id', userId)
      .single();

    if (userError || !user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Access denied. Deployment requires admin account authorization verification.' }, { status: 403 });
    }

    // Upsert configuration into bots processing map table
    const { error: botError } = await supabase
      .from('bots')
      .upsert({
        user_id: userId,
        bot_type: bot_type,
        status: 'running',
        started_at: new Date().toISOString()
      }, { onConflict: 'user_id,bot_type' });

    if (botError) throw new Error(botError.message);

    return NextResponse.json({ success: true, status: 'running' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to dispatch start protocol' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { discoverDerivAccounts } from '@/lib/deriv/auth';

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

    const { token } = await request.json();
    if (!token || token.trim() === '') {
      return NextResponse.json({ error: 'Personal Access Token is required' }, { status: 400 });
    }

    // Hit the current 2026 Deriv Architecture via our server-side utility
    const discoveredAccounts = await discoverDerivAccounts(token.trim());

    if (!discoveredAccounts || discoveredAccounts.length === 0) {
      return NextResponse.json({ error: 'No active trading portfolios detected for this token.' }, { status: 404 });
    }

    // Pull the active demo identity to bind standard configurations
    const targetAccount = discoveredAccounts.find(acc => acc.account_type === 'demo') || discoveredAccounts[0];

    // Upsert user profile into Supabase using Clerk ID mapped directly to our schema structure
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        id: userId, // Clerk Identity mapped as primary UUID string key
        deriv_app_id: process.env.DERIV_APP_ID || '33mZdzOJ000s1hj182NFG',
        deriv_token: token.trim(),
        deriv_account_id: targetAccount.account_id,
        status: 'pending' // Enforce verification status logic for Lord Khalif
      }, { onConflict: 'id' });

    if (dbError) {
      throw new Error(`Database transaction rejected: ${dbError.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      accounts: discoveredAccounts,
      selected_target: targetAccount.account_id 
    });
  } catch (error: any) {
    console.error('Handshake verification error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal connection failure' }, { status: 500 });
  }
}

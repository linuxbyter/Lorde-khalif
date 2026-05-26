// app/api/user/connect-deriv/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discoverDerivAccounts } from '../../../../lib/deriv/auth';

// Initialize the administrative Supabase client using your Master Config keys
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    // 1. Authenticate user using modern asynchronous Clerk Engine
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Access Denied' }, 
        { status: 401 }
      );
    }

    // 2. Parse request payload and catch any variation of the token key name
    const body = await request.json();
    
    // This looks for apiToken, token, pat, or bearerToken automatically
    const apiToken = body.apiToken || body.token || body.pat || body.bearerToken;

    if (!apiToken) {
      return NextResponse.json(
        { error: 'Bad Request: Deriv API Token is missing from payload' }, 
        { status: 400 }
      );
    }

    // 3. Initiate handshake/discovery protocol with the Deriv API
    const accounts = await discoverDerivAccounts(apiToken);

    // 4. Record/Upsert the connected profiles to your Supabase platform
    // Note: Adjust table name ('user_deriv_connections') to match your schema if necessary
    const { error: dbError } = await supabase
      .from('user_deriv_connections')
      .upsert({
        user_id: userId,
        api_token: apiToken,
        accounts: accounts,
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Supabase Core Sync Exception:', dbError);
      return NextResponse.json(
        { error: 'Database Synchronization Failed' }, 
        { status: 500 }
      );
    }

    // 5. Successful connection response
    return NextResponse.json({ 
      success: true, 
      message: 'Deriv accounts mapped successfully',
      accounts 
    });

  } catch (error: any) {
    console.error('Handshake failure at connect-deriv core:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Architectural Failure' }, 
      { status: 500 }
    );
  }
}
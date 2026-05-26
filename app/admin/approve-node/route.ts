import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client (using service role key bypasses RLS if needed)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; 
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, action } = body; // action can be 'active', 'rejected', etc.

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing accountId in request body' },
        { status: 400 }
      );
    }

    const targetStatus = action || 'active';

    // 1. Update the node status in user_nodes
    const { data: updatedNode, error: nodeError } = await supabase
      .from('user_nodes')
      .update({ 
        status: targetStatus,
        updated_at: new Date().toISOString()
      })
      .eq('selected_account_id', accountId) // Matches your DOT account number
      .select()
      .single();

    if (nodeError) {
      console.error('Database update error:', nodeError);
      return NextResponse.json({ error: nodeError.message }, { status: 500 });
    }

    // 2. Log the action in the admin_actions table for tracking
    await supabase.from('admin_actions').insert({
      action_type: `NODE_${targetStatus.toUpperCase()}`,
      target_id: accountId,
      details: {
        message: `Node authorization state shifted to ${targetStatus}`,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Node matrix successfully unauthorized/activated to status: ${targetStatus}`,
      data: updatedNode,
    });

  } catch (error: any) {
    console.error('Admin approval crash:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
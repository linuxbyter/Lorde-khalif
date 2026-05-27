import { DerivWebSocketManager } from '../deriv/websocket';

interface ExecutionContext {
  token: string;
  accountId: string;
  userId: string;
  isDemo?: boolean;
}

interface SignalPayload {
  symbol: string;
  type: 'CALL' | 'PUT';
  stake: number;
  duration?: number;
}

export async function executeStrategy({ context, signal }: { context: ExecutionContext; signal: SignalPayload }) {
  const manager = new DerivWebSocketManager(
    context.token, 
    context.userId, 
    context.accountId, 
    context.isDemo ?? true
  );

  try {
    console.log(`[OTS Engine] Initializing dynamic handshake for User: ${context.userId} on Account: ${context.accountId}`);
    await manager.connect();
    
    console.log(`[OTS Engine] Handshake cleared. Dispatching order: ${signal.type} on ${signal.symbol} ($${signal.stake})`);
    
    const result = await manager.buyContract(
      signal.symbol,
      signal.type,
      signal.stake,
      signal.duration || 5
    );

    manager.disconnect();
    return result;
  } catch (err: any) {
    console.error(`[OTS Engine] Execution aborted for User ${context.userId}:`, err);
    manager.disconnect();
    return { 
      success: false, 
      error: err.message || 'Internal OTS strategy runtime exception' 
    };
  }
}

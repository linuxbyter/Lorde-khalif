import { DerivWebSocketManager } from '../deriv/websocket';

export async function executeStrategy(signal: { symbol: string, type: 'CALL' | 'PUT', stake: number }) {
  const manager = new DerivWebSocketManager(
    process.env.DERIV_TOKEN!, 
    process.env.DERIV_USER_ID!, 
    process.env.DERIV_ACCOUNT_ID!
  );

  try {
    await manager.connect();
    
    // Execute trade
    const result = await manager.buyContract(
      signal.symbol,
      signal.type,
      signal.stake,
      5 // duration in ticks
    );

    return result;
  } catch (err) {
    console.error('OTS Execution Error:', err);
    return { success: false, error: err };
  }
}

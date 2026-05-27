import WebSocket from 'ws';

export interface ContractResult {
  contract_id: string;
  buy_price: number;
  sell_price: number;
  entry_spot: number;
  exit_spot: number;
  status: 'won' | 'lost' | 'expired';
}

export class DerivWebSocketManager {
  private ws: WebSocket | null = null;
  private token: string;
  private userId: string;
  private accountId: string;
  private isDemo: boolean;
  private requestId: number = 1;
  private pendingRequests = new Map<number, (data: any) => void>();
  private contractSubscriptions = new Map<string, (result: ContractResult) => void>();
  public messagesBuffer: any[] = [];
  private authorized: boolean = false;

  constructor(token: string, userId: string, accountId: string, isDemo: boolean = true) {
    this.token = token;
    this.userId = userId;
    this.accountId = accountId;
    this.isDemo = isDemo;
  }

  async connect(): Promise<void> {
    try {
      const otpEndpoint = `https://api.derivws.com/trading/v1/options/accounts/${this.accountId}/otp`;
      const otpResponse = await fetch(otpEndpoint, {
        method: 'POST',
        headers: {
          'Deriv-App-ID': process.env.DERIV_APP_ID || '33mZdzOJ000s1hj182NFG',
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!otpResponse.ok) {
        const errorText = await otpResponse.text();
        throw new Error(`Failed to get OTP: ${otpResponse.status} - ${errorText}`);
      }

      const otpData = await otpResponse.json();
      const websocketUrl = otpData.data?.url;

      if (!websocketUrl) {
        throw new Error('No WebSocket URL found in response schema');
      }

      return new Promise((resolve, reject) => {
        try {
          this.ws = new WebSocket(websocketUrl);
          
          const connectionTimeout = setTimeout(() => {
            if (this.ws) { this.ws.close(); this.ws = null; }
            reject(new Error('WebSocket connection timeout'));
          }, 10000);

          this.ws.on('open', () => {
            clearTimeout(connectionTimeout);
            
            // 🔐 Atomic authorization flight tracker
            const authId = this.requestId++;
            
            this.pendingRequests.set(authId, (response) => {
              if (response.error) {
                reject(new Error(`Deriv Auth Rejected: ${response.error.message} (Code: ${response.error.code})`));
              } else if (response.authorize) {
                this.authorized = true;
                // Pre-subscribe to balance stream now that we are clear
                this.sendRequest({ balance: 1, subscribe: 1 });
                resolve();
              } else {
                reject(new Error('Malformed authorization payload schema returned'));
              }
            });

            this.ws!.send(JSON.stringify({
              authorize: this.token,
              req_id: authId
            }));
          });

          this.ws.on('message', (data: string) => {
            try {
              const parsed = JSON.parse(data);
              this.messagesBuffer.push({ timestamp: new Date().toISOString(), data: parsed });
              if (this.messagesBuffer.length > 50) this.messagesBuffer.shift();

              this.handleMessage(parsed);
            } catch (err) {
              console.error('[WSManager] Error parsing stream frame:', err);
            }
          });

          this.ws.on('error', (error: Error) => {
            reject(error);
          });

          this.ws.on('close', () => {
            this.ws = null;
            this.authorized = false;
          });

        } catch (err) {
          reject(err);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.authorized;
  }

  public sendRequest(payload: any): number {
    if (!this.isConnected()) {
      throw new Error('WebSocket connection missing verified authorization context');
    }

    const id = this.requestId++;
    const request = { ...payload, req_id: id };
    this.ws!.send(JSON.stringify(request));
    return id;
  }

  private handleMessage(message: any) {
    if (message.req_id) {
      const callback = this.pendingRequests.get(message.req_id);
      if (callback) {
        callback(message);
        this.pendingRequests.delete(message.req_id);
        return;
      }
    }

    if (message.proposal_open_contract) {
      const contract = message.proposal_open_contract;
      const callback = this.contractSubscriptions.get(contract.contract_id);

      if (callback && contract.status === 'sold') {
        callback({
          contract_id: contract.contract_id,
          buy_price: contract.buy_price,
          sell_price: contract.sell_price,
          entry_spot: contract.entry_spot,
          exit_spot: contract.exit_spot,
          status: contract.profit > 0 ? 'won' : 'lost',
        });
        this.contractSubscriptions.delete(contract.contract_id);
      }
    }
  }

  private mapContractType(contractType: 'CALL' | 'PUT'): 'RISE' | 'FALL' {
    return contractType === 'CALL' ? 'RISE' : 'FALL';
  }

  async buyContract(
    symbol: string,
    contractType: 'CALL' | 'PUT',
    stake: number,
    duration: number
  ): Promise<{ success: boolean; contract_id?: string; buy_price?: number; error?: string; logs?: any[] }> {
    try {
      if (!this.isConnected()) throw new Error('WebSocket connection missing verified authorization context');

      const derivContractType = this.mapContractType(contractType);
      const buyPayload = {
        buy: '1',
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: derivContractType,
          currency: 'USD',
          duration: duration || 5,
          duration_unit: 't',
          symbol: symbol,
        },
      };

      const buyId = this.sendRequest(buyPayload);

      const responseMessage = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(buyId);
          reject(new Error('Buy transaction confirmation execution timeout'));
        }, 8000);

        this.pendingRequests.set(buyId, (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
      });

      if (responseMessage.error) {
        return {
          success: false,
          error: `Deriv Rejected Buy: ${responseMessage.error.message}`,
          logs: this.messagesBuffer,
        };
      }

      const buyDetails = responseMessage.buy;
      if (!buyDetails) {
        return {
          success: false,
          error: 'Buy response missing schema architecture targets',
          logs: this.messagesBuffer,
        };
      }

      return {
        success: true,
        contract_id: buyDetails.contract_id,
        buy_price: buyDetails.buy_price || stake,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Execution exception intercept',
        logs: this.messagesBuffer,
      };
    }
  }

  subscribeToContract(contractId: string): Promise<ContractResult | null> {
    return new Promise((resolve) => {
      try {
        this.contractSubscriptions.set(contractId, (result) => { resolve(result); });
        this.sendRequest({
          proposal_open_contract: 1,
          contract_id: contractId,
          subscribe: 1,
        });

        setTimeout(() => {
          if (this.contractSubscriptions.has(contractId)) {
            this.contractSubscriptions.delete(contractId);
            resolve(null);
          }
        }, 5 * 60 * 1000);
      } catch (error) {
        resolve(null);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authorized = false;
  }
}

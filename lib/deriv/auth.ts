interface DerivAccountDetail {
  account_id: string;
  balance: string;
  currency: string;
  group: string;
  status: string;
  account_type: 'real' | 'demo';
}

interface DerivAccountsResponse {
  data: DerivAccountDetail[];
}

/**
 * Automatically discovers all Demo and Real accounts tied to a user's Personal Access Token.
 */
export async function discoverDerivAccounts(personalAccessToken: string): Promise<DerivAccountDetail[]> {
  const appId = process.env.DERIV_APP_ID || '33mZdzOJ000s1hj182NFG';
  const url = 'https://api.derivws.com/trading/v1/options/accounts';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Deriv-App-ID': appId,
      'Authorization': `Bearer ${personalAccessToken}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 } // Do not cache token lookups
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deriv token validation failed: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as DerivAccountsResponse;
  return result.data || [];
}

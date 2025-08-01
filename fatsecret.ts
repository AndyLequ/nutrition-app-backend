import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const CLIENT_ID = process.env.FATSECRET_CLIENT_ID!;
const CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET!;

let fatSecretAccessToken: string | null = null;
let fatSecretTokenExpiresAt = 0;

export async function getFatSecretToken(): Promise<string> {
  const now = Date.now();

  if (fatSecretAccessToken && now < fatSecretTokenExpiresAt) {
    return fatSecretAccessToken;
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'basic');

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const response = await axios.post(TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      }
    });

    fatSecretAccessToken = response.data.access_token;
    fatSecretTokenExpiresAt = now + (response.data.expires_in * 1000) - 300000;
    return fatSecretAccessToken;
  } catch (err: any) {
    console.error('Failed to fetch FatSecret access token:', err.response?.data || err.message);
    throw new Error('Unable to authenticate with FatSecret');
  }
}
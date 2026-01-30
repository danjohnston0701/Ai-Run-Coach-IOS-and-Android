/**
 * Garmin OAuth Bridge - Backend Endpoint
 * 
 * Handles OAuth callback from Garmin and redirects to mobile app
 * (Required because Garmin only accepts HTTPS callbacks, not custom URL schemes)
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

// Temporary storage for OAuth tokens (use Redis in production)
const tokenStore = new Map<string, {
    accessToken: string;
    accessTokenSecret: string;
    timestamp: number;
}>();

// Cleanup old tokens every hour
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, value] of tokenStore.entries()) {
        if (value.timestamp < oneHourAgo) {
            tokenStore.delete(key);
        }
    }
}, 3600000);

/**
 * Garmin OAuth Callback Endpoint
 * 
 * Garmin redirects here after user authorizes:
 * GET /garmin/callback?oauth_token=...&oauth_verifier=...
 */
router.get('/garmin/callback', async (req: Request, res: Response) => {
    const { oauth_token, oauth_verifier } = req.query;
    
    console.log('📥 Garmin OAuth callback received:', { oauth_token, oauth_verifier });
    
    if (!oauth_token || !oauth_verifier) {
        console.error('❌ Missing oauth_token or oauth_verifier');
        return res.redirect('airuncoach://garmin/auth-complete?success=false&error=missing_params');
    }
    
    try {
        // Exchange OAuth verifier for access token
        const { accessToken, accessTokenSecret } = await exchangeGarminToken(
            oauth_token as string,
            oauth_verifier as string
        );
        
        // Store token temporarily (5 minutes expiry)
        const tempTokenId = crypto.randomBytes(16).toString('hex');
        tokenStore.set(tempTokenId, {
            accessToken,
            accessTokenSecret,
            timestamp: Date.now()
        });
        
        console.log('✅ Garmin token exchanged successfully, stored as:', tempTokenId);
        
        // Redirect back to mobile app with temp token ID
        res.redirect(`airuncoach://garmin/auth-complete?success=true&token=${tempTokenId}`);
        
    } catch (error: any) {
        console.error('❌ Garmin OAuth error:', error.message);
        res.redirect(`airuncoach://garmin/auth-complete?success=false&error=${encodeURIComponent(error.message)}`);
    }
});

/**
 * Token Retrieval Endpoint
 * 
 * Mobile app calls this to get the stored access token:
 * GET /api/garmin/token/:tempTokenId
 */
router.get('/api/garmin/token/:tempTokenId', (req: Request, res: Response) => {
    const { tempTokenId } = req.params;
    
    console.log('📥 Token retrieval request:', tempTokenId);
    
    const tokenData = tokenStore.get(tempTokenId);
    
    if (!tokenData) {
        console.error('❌ Token not found or expired');
        return res.status(404).json({ error: 'Token not found or expired' });
    }
    
    // Delete token after retrieval (one-time use)
    tokenStore.delete(tempTokenId);
    
    console.log('✅ Token retrieved successfully');
    
    res.json({
        accessToken: tokenData.accessToken,
        accessTokenSecret: tokenData.accessTokenSecret
    });
});

/**
 * Exchange OAuth verifier for access token
 */
async function exchangeGarminToken(oauthToken: string, oauthVerifier: string): Promise<{
    accessToken: string;
    accessTokenSecret: string;
}> {
    const CONSUMER_KEY = process.env.GARMIN_CONSUMER_KEY;
    const CONSUMER_SECRET = process.env.GARMIN_CONSUMER_SECRET;
    
    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
        throw new Error('Garmin credentials not configured in environment variables');
    }
    
    const url = 'https://connectapi.garmin.com/oauth-service/oauth/access_token';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Note: You need to retrieve the request_token_secret from somewhere
    // In practice, you'd store it when initiating the OAuth flow
    // For now, this is a simplified version
    
    const params = {
        oauth_consumer_key: CONSUMER_KEY,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_token: oauthToken,
        oauth_verifier: oauthVerifier,
        oauth_version: '1.0'
    };
    
    const signature = generateOAuthSignature('POST', url, params, CONSUMER_SECRET, '');
    
    const authHeader = buildAuthorizationHeader(params, signature);
    
    const response = await axios.post(url, null, {
        headers: {
            'Authorization': authHeader
        }
    });
    
    const responseData = parseOAuthResponse(response.data);
    
    return {
        accessToken: responseData.oauth_token,
        accessTokenSecret: responseData.oauth_token_secret
    };
}

/**
 * Generate OAuth 1.0a HMAC-SHA1 signature
 */
function generateOAuthSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    consumerSecret: string,
    tokenSecret: string
): string {
    // Sort parameters
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
    
    // Build signature base string
    const signatureBase = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(sortedParams)
    ].join('&');
    
    // Build signing key
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
    
    // Generate HMAC-SHA1 signature
    const hmac = crypto.createHmac('sha1', signingKey);
    hmac.update(signatureBase);
    
    return hmac.digest('base64');
}

/**
 * Build OAuth Authorization header
 */
function buildAuthorizationHeader(params: Record<string, string>, signature: string): string {
    const authParams = { ...params, oauth_signature: signature };
    
    const headerValue = Object.keys(authParams)
        .sort()
        .map(key => `${key}="${encodeURIComponent(authParams[key])}"`)
        .join(', ');
    
    return `OAuth ${headerValue}`;
}

/**
 * Parse OAuth response (form-encoded)
 */
function parseOAuthResponse(response: string): Record<string, string> {
    return response.split('&').reduce((acc, pair) => {
        const [key, value] = pair.split('=');
        acc[key] = value;
        return acc;
    }, {} as Record<string, string>);
}

export default router;

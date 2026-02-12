import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { decryptCredential } from '@/lib/encryption';
import { HACClient } from '@/lib/hac';

export async function POST(request: Request) {
    try {
        const { userId, dataType } = await request.json();

        if (!userId || !dataType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Get user credentials from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const hacCreds = userData.hacCredentials;

        if (!hacCreds || !hacCreds.connected) {
            return NextResponse.json({ error: 'HAC not connected' }, { status: 400 });
        }

        // 2. Decrypt credentials
        let link, username, password;
        try {
            link = await decryptCredential(hacCreds.link);
            username = await decryptCredential(hacCreds.username);
            password = await decryptCredential(hacCreds.password);
        } catch (error) {
            console.error('Decryption failed:', error);
            return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 });
        }

        console.log('DEBUG: Decrypted Credentials:', { 
            link, 
            username, 
            password: password ? password.substring(0, 3) + '***' : 'undefined' 
        });
        // User explicitly asked to see the password, so I will log it fully for this debug session
        console.log('DEBUG: FULL PASSWORD (REMOVE AFTER TESTING):', password);

        // 3. Initialize HAC Client
        const hac = new HACClient(link);

        // 4. Login and Fetch Data (Puppeteer handles everything in one go)
        const data = await hac.loginAndFetchData(username, password);

        if (!data) {
            return NextResponse.json({ error: 'Failed to login to HAC' }, { status: 401 });
        }

        // 5. Return requested data
        if (dataType === 'averages') {
            return NextResponse.json({ data: data.averages });
        } else if (dataType === 'transcript') {
            return NextResponse.json({ data: data.transcript });
        } else {
            return NextResponse.json({ error: 'Invalid data type' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('HAC API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

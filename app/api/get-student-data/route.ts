import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { studentId } = await request.json();

        // Get Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        const userId = decodedToken.uid;

        if (!studentId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Verify permission
        // If requesting own data, allow.
        // If requesting another's data, check if in linkedStudentIds.
        if (userId !== studentId) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            const userData = userDoc.data();
            const linkedStudents = userData?.linkedStudentIds || [];

            if (!linkedStudents.includes(studentId)) {
                return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
            }
        }

        // 2. Fetch Student Profile
        const studentDoc = await db.collection('users').doc(studentId).get();
        if (!studentDoc.exists) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }
        const profile = studentDoc.data();

        // 3. Fetch Analytics
        const analyticsDoc = await db.collection('users').doc(studentId).collection('analytics').doc('monthlyScores').get();
        const analytics = analyticsDoc.exists ? analyticsDoc.data() : null;

        // 4. Fetch Counts
        const subcollections = ['activities', 'honors', 'tests', 'grades', 'essays', 'colleges'];
        const counts: { [key: string]: number } = {};

        await Promise.all(subcollections.map(async (sub) => {
            const snapshot = await db.collection('users').doc(studentId).collection(sub).get();
            counts[sub] = snapshot.size;
        }));

        return NextResponse.json({
            profile,
            analytics,
            counts
        });

    } catch (error: any) {
        console.error('Error fetching student data:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

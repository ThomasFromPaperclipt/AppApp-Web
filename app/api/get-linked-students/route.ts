import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Get User Doc
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const linkedStudentIds = userData?.linkedStudentIds || [];

        if (linkedStudentIds.length === 0) {
            return NextResponse.json({ students: [] });
        }

        // 2. Fetch Profiles for all linked students
        // Firestore 'in' query supports up to 10 items. For more, we might need to batch or loop.
        // Since we have IDs, we can just do Promise.all(get) which is efficient enough for reasonable roster sizes.
        
        const students = await Promise.all(linkedStudentIds.map(async (studentId: string) => {
            const doc = await db.collection('users').doc(studentId).get();
            if (doc.exists) {
                const data = doc.data();
                // Return only necessary fields for the list
                return {
                    uid: studentId,
                    firstName: data?.firstName,
                    lastName: data?.lastName,
                    gradeLevel: data?.gradeLevel,
                    email: data?.email
                };
            }
            return null;
        }));

        // Filter out any nulls (deleted users etc)
        const validStudents = students.filter(s => s !== null);

        return NextResponse.json({ students: validStudents });

    } catch (error: any) {
        console.error('Error fetching linked students:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

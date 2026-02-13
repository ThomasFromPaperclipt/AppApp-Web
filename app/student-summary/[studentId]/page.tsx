'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from './summary.module.css';

interface UserData {
    firstName: string;
    lastName: string;
    email: string;
    gradeLevel?: string;
}

interface Activity {
    id: string;
    organizationName: string;
    position: string;
    description: string;
    gradeLevels: number[];
    hoursPerWeek: string;
    weeksPerYear: string;
    participateInCollege: boolean;
    participationTiming: string;
}

interface Honor {
    id: string;
    honorTitle: string;
    honorType: string;
    description: string;
    date: string;
}

interface Test {
    id: string;
    type: string;
    score: string;
    apTest?: string;
}

export default function StudentSummary() {
    const router = useRouter();
    const params = useParams();
    const studentId = params?.studentId as string;

    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [studentData, setStudentData] = useState<UserData | null>(null);
    const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);

    // Data States
    const [activities, setActivities] = useState<Activity[]>([]);
    const [honors, setHonors] = useState<Honor[]>([]);
    const [tests, setTests] = useState<Test[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/');
                return;
            }

            try {
                // Fetch current user's data to check authorization
                const currentUserDoc = await getDoc(doc(db, 'users', user.uid));
                if (!currentUserDoc.exists()) {
                    router.push('/dashboard');
                    return;
                }

                const currentUserInfo = currentUserDoc.data() as UserData & { role?: string; linkedStudentIds?: string[] };
                setCurrentUserData(currentUserInfo);

                // Check authorization: must be parent or counselor with access to this student
                if (currentUserInfo.role !== 'parent' && currentUserInfo.role !== 'counselor') {
                    router.push('/dashboard');
                    return;
                }

                if (!currentUserInfo.linkedStudentIds?.includes(studentId)) {
                    router.push('/dashboard');
                    return;
                }

                setAuthorized(true);

                // Fetch Student Profile
                const studentDoc = await getDoc(doc(db, 'users', studentId));
                if (studentDoc.exists()) {
                    setStudentData(studentDoc.data() as UserData);
                }

                // Fetch Student's Subcollections
                const fetchCollection = async (collectionName: string) => {
                    const q = query(collection(db, 'users', studentId, collectionName));
                    const snapshot = await getDocs(q);
                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                };

                const [activitiesData, honorsData, testsData] = await Promise.all([
                    fetchCollection('activities'),
                    fetchCollection('honors'),
                    fetchCollection('tests')
                ]);

                setActivities(activitiesData as Activity[]);
                setHonors(honorsData as Honor[]);
                setTests(testsData as Test[]);

            } catch (error) {
                console.error('Error fetching student summary data:', error);
                router.push('/dashboard');
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router, studentId]);

    const handlePrint = () => {
        window.print();
    };

    const groupTests = (tests: Test[]) => {
        const categories = ["AP", "SAT", "PSAT", "ACT"];
        const grouped: Record<string, Test[]> = {};

        categories.forEach(cat => {
            grouped[cat] = tests.filter(t => t.type.toUpperCase().includes(cat));
        });

        return grouped;
    };

    const getHonorTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            'school': 'School-wide',
            'state': 'State/Regional',
            'national': 'National',
            'international': 'International'
        };
        return labels[type] || type;
    };

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Loading student summary...</p>
            </div>
        );
    }

    if (!authorized) {
        return null;
    }

    const groupedTests = groupTests(tests);

    return (
        <div className={styles.pageWrapper}>
            {/* Print Controls */}
            <div className={styles.controls}>
                <button onClick={() => router.push('/dashboard')} className={styles.backButton}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    Back to Dashboard
                </button>
                <button onClick={handlePrint} className={styles.printButton}>
                    <span className="material-symbols-outlined">print</span>
                    Print / Save PDF
                </button>
            </div>

            {/* Printable Resume */}
            <div className={styles.resume}>
                {/* Header */}
                <div className={styles.header}>
                    <h1 className={styles.name}>
                        {studentData?.firstName} {studentData?.lastName}
                    </h1>
                    {studentData?.gradeLevel && (
                        <p className={styles.gradeLevel}>Grade {studentData.gradeLevel}</p>
                    )}
                    <p className={styles.email}>{studentData?.email}</p>
                    <p className={styles.generatedDate}>
                        Generated on {new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })} with AppApp
                    </p>
                </div>

                {/* Activities Section */}
                {activities.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>Extracurricular Activities</h2>
                        {activities.map((activity, index) => (
                            <div key={activity.id} className={styles.item}>
                                <div className={styles.itemHeader}>
                                    <h3 className={styles.itemTitle}>{activity.organizationName}</h3>
                                    <span className={styles.itemMeta}>
                                        Grades {activity.gradeLevels.join(', ')}
                                    </span>
                                </div>
                                <p className={styles.itemPosition}>{activity.position}</p>
                                <p className={styles.itemDescription}>{activity.description}</p>
                                <div className={styles.itemDetails}>
                                    <span>{activity.hoursPerWeek} hrs/week</span>
                                    <span>•</span>
                                    <span>{activity.weeksPerYear} weeks/year</span>
                                    {activity.participateInCollege && (
                                        <>
                                            <span>•</span>
                                            <span>Plans to continue in college</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Honors Section */}
                {honors.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>Honors & Awards</h2>
                        {honors.map((honor, index) => (
                            <div key={honor.id} className={styles.item}>
                                <div className={styles.itemHeader}>
                                    <h3 className={styles.itemTitle}>{honor.honorTitle}</h3>
                                    <span className={styles.itemMeta}>
                                        {getHonorTypeLabel(honor.honorType)}
                                    </span>
                                </div>
                                <p className={styles.itemDate}>Received: {honor.date}</p>
                                <p className={styles.itemDescription}>{honor.description}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Test Scores Section */}
                {tests.length > 0 && (
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>Standardized Test Scores</h2>
                        {Object.entries(groupedTests).map(([category, categoryTests]) => (
                            categoryTests.length > 0 && (
                                <div key={category} className={styles.testCategory}>
                                    <h3 className={styles.testCategoryTitle}>{category}</h3>
                                    <div className={styles.testGrid}>
                                        {categoryTests.map((test, index) => (
                                            <div key={test.id} className={styles.testItem}>
                                                <span className={styles.testName}>
                                                    {test.apTest || test.type}
                                                </span>
                                                <span className={styles.testScore}>{test.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className={styles.footer}>
                    <p>Generated by {currentUserData?.firstName} {currentUserData?.lastName} with AppApp</p>
                    <p>Learn more at goappapp.com</p>
                </div>
            </div>
        </div>
    );
}

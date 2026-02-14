'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

import Sidebar from '@/components/Sidebar';
import styles from '../dashboard/dashboard.module.css';

interface UserData {
    uid?: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
    role?: 'student' | 'parent' | 'counselor';
    shareCode?: string;
    linkedStudentIds?: string[];
    lastGradeUpdate?: any;
}

export default function AddStudent() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [linkedStudents, setLinkedStudents] = useState<UserData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Link form state
    const [linkCode, setLinkCode] = useState('');
    const [linking, setLinking] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [sentRequests, setSentRequests] = useState<string[]>([]);

    const router = useRouter();

    // Auth listener + fetch user data
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                router.push('/');
                return;
            }

            setUser(currentUser);

            try {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const data = userDoc.data() as UserData;
                    setUserData(data);

                    // Redirect students — this page is only for parents/counselors
                    if (data.role !== 'parent' && data.role !== 'counselor') {
                        router.push('/dashboard');
                        return;
                    }
                }
            } catch (err) {
                console.error('Error fetching user data:', err);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    // Fetch linked students
    useEffect(() => {
        const fetchLinkedStudents = async () => {
            if (!user || !userData) return;
            if (userData.role !== 'counselor' && userData.role !== 'parent') return;

            try {
                const linkedIds = userData.linkedStudentIds || [];
                if (linkedIds.length > 0) {
                    const studentDocs = await Promise.all(
                        linkedIds.map(id => getDoc(doc(db, 'users', id)))
                    );

                    const students = studentDocs
                        .filter(doc => doc.exists())
                        .map(doc => {
                            const d = doc.data();
                            return {
                                uid: doc.id,
                                firstName: d.firstName,
                                lastName: d.lastName,
                                gradeLevel: d.gradeLevel,
                                email: d.email,
                                ...d
                            } as UserData;
                        });

                    setLinkedStudents(students);
                } else {
                    setLinkedStudents([]);
                }
            } catch (err) {
                console.error('Error fetching linked students:', err);
            }
        };

        fetchLinkedStudents();
    }, [user, userData]);

    const handleLinkStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !linkCode) return;

        setLinking(true);
        setLinkError('');

        try {
            const claimShareCode = httpsCallable(functions, 'claimShareCode');
            await claimShareCode({ code: linkCode });

            setSentRequests(prev => [...prev, linkCode]);
            setLinkCode('');
        } catch (error: any) {
            console.error('Error linking student:', error);
            setLinkError(error.message || 'Failed to link account. Please check the code and try again.');
        } finally {
            setLinking(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <nav className={styles.topNav}>
                <div className={styles.navContent}>
                    <img src="/assets/elongatedNeil.png" alt="AppApp" className={styles.logoImage} />
                    <div className={styles.topUserCard} onClick={() => router.push('/profile')}>
                        <div className={styles.topUserAvatar}>
                            {userData?.firstName?.charAt(0)}{userData?.lastName?.charAt(0)}
                        </div>
                        <div className={styles.topUserDetails}>
                            <div className={styles.topUserName}>{userData?.firstName} {userData?.lastName}</div>
                            <div className={styles.topUserEmail}>{userData?.email}</div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className={styles.mainLayout}>
                <Sidebar
                    userRole={userData?.role}
                    linkedStudents={linkedStudents}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedStudentId={null}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/add-student"
                />

                <main className={styles.centerContent}>
                    <h1 className={styles.pageTitle}>
                        {userData?.role === 'counselor' ? 'Add Student' : 'Link Student'}
                    </h1>

                    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                        {/* Session Feedback: Pending Requests */}
                        {sentRequests.map((code, idx) => (
                            <div key={idx} style={{
                                background: '#FEFCBF',
                                border: '1px solid #F6E05E',
                                borderRadius: '8px',
                                padding: '1rem',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem'
                            }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: '#ECC94B', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>hourglass_top</span>
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: '700', color: '#744210', fontSize: '0.9rem' }}>Request Pending</div>
                                    <div style={{ fontSize: '0.8rem', color: '#975A16' }}>
                                        Waiting for student approval (Code: {code})
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#975A16' }}>
                                        You may need to refresh your page.
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Link Form Card */}
                        <div style={{
                            background: 'white',
                            padding: '2.5rem',
                            borderRadius: '16px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: '#E9F5F7',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#437E84' }}>person_add</span>
                            </div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#2d3748' }}>
                                {userData?.role === 'counselor' ? 'Add Student to Roster' : 'Link a Student'}
                            </h2>
                            <p style={{ color: '#718096', marginBottom: '2rem' }}>
                                Enter the 8-character sharing code from the student's dashboard to link their account.
                            </p>

                            <form onSubmit={handleLinkStudent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <input
                                    type="text"
                                    value={linkCode}
                                    onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                                    placeholder="ENTER CODE"
                                    maxLength={8}
                                    style={{
                                        padding: '1rem',
                                        fontSize: '1.25rem',
                                        textAlign: 'center',
                                        letterSpacing: '4px',
                                        borderRadius: '8px',
                                        border: '2px solid #e2e8f0',
                                        outline: 'none',
                                        textTransform: 'uppercase',
                                        fontWeight: 'bold'
                                    }}
                                />
                                {linkError && <div style={{ color: '#e53e3e', fontSize: '0.875rem' }}>{linkError}</div>}
                                <button
                                    type="submit"
                                    disabled={linking || linkCode.length !== 8}
                                    style={{
                                        padding: '1rem',
                                        background: '#437E84',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        cursor: (linking || linkCode.length !== 8) ? 'not-allowed' : 'pointer',
                                        opacity: (linking || linkCode.length !== 8) ? 0.7 : 1
                                    }}
                                >
                                    {linking ? 'Linking...' : 'Link Student'}
                                </button>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

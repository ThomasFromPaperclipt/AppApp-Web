'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../dashboard/dashboard.module.css';

interface UserData {
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
}

interface Counts {
    activities: number;
    honors: number;
    tests: number;
    grades: number;
    essays: number;
    colleges: number;
}

export default function Activities() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        grades: 0,
        essays: 0,
        colleges: 0,
    });
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/');
                return;
            }

            setUser(user);

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserData(userDoc.data() as UserData);
                }

                const subcollections = ['activities', 'honors', 'tests', 'grades', 'essays', 'colleges'];
                const newCounts: Counts = {
                    activities: 0,
                    honors: 0,
                    tests: 0,
                    grades: 0,
                    essays: 0,
                    colleges: 0,
                };

                for (const subcollection of subcollections) {
                    const snapshot = await getDocs(collection(db, 'users', user.uid, subcollection));
                    newCounts[subcollection as keyof Counts] = snapshot.size;
                }

                setCounts(newCounts);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

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
            <div className={styles.loadingContainer}>
                <img src="/assets/tidyingUp.png" alt="Loading" width={150} height={160} className={styles.loadingImage} />
                <div className={styles.loading}>Loading...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <nav className={styles.topNav}>
                <div className={styles.navContent}>
                    <img src="/assets/elongatedNeil.png" alt="AppApp" className={styles.logoImage} />
                </div>
            </nav>

            <div className={styles.mainLayout}>
                <aside className={styles.leftSidebar}>
                    <div className={styles.sidebarContent}>
                        <button className={styles.sidebarItem} onClick={() => router.push('/dashboard')}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>dashboard</span>
                            Dashboard
                        </button>

                        <div className={styles.sidebarSection}>
                            <div className={styles.sectionLabel}>MANAGE</div>
                            <button className={`${styles.sidebarItem} ${styles.sidebarItemActive}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit_note</span>
                                Activities
                                <span className={styles.badge}>{counts.activities}</span>
                            </button>
                            <button className={styles.sidebarItem} onClick={() => router.push('/essays')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>article</span>
                                Essays
                                <span className={styles.badge}>{counts.essays}</span>
                            </button>
                            <button className={styles.sidebarItem} onClick={() => router.push('/honors')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>emoji_events</span>
                                Honors & Awards
                                <span className={styles.badge}>{counts.honors}</span>
                            </button>
                            <button className={styles.sidebarItem} onClick={() => router.push('/tests')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>quiz</span>
                                Test Scores
                                <span className={styles.badge}>{counts.tests}</span>
                            </button>
                            <button className={styles.sidebarItem} onClick={() => router.push('/grades')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>school</span>
                                Grades
                                <span className={styles.badge}>{counts.grades}</span>
                            </button>
                            <button className={styles.sidebarItem} onClick={() => router.push('/colleges')}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>account_balance</span>
                                My Colleges
                                <span className={styles.badge}>{counts.colleges}</span>
                            </button>
                        </div>

                        <div className={styles.sidebarFooter}>
                            <button className={styles.sidebarItem} onClick={handleSignOut}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                                Sign out
                            </button>
                            <div className={styles.userInfo}>
                                <div className={styles.userAvatar}>
                                    {userData?.firstName?.charAt(0)}{userData?.lastName?.charAt(0)}
                                </div>
                                <div className={styles.userDetails}>
                                    <div className={styles.userFullName}>{userData?.firstName} {userData?.lastName}</div>
                                    <div className={styles.userEmail}>{userData?.email}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <main className={styles.centerContent}>
                    <h1 className={styles.pageTitle}>Activities</h1>

                    <div className={styles.placeholderCard}>
                        <div className={styles.placeholderIcon}>
                            <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#437E84' }}>edit_note</span>
                        </div>
                        <h2 className={styles.placeholderTitle}>Activities Management</h2>
                        <p className={styles.placeholderText}>
                            This page will allow you to add, edit, and manage your extracurricular activities.
                            Track your involvement, leadership positions, and achievements.
                        </p>
                        <p className={styles.placeholderSubtext}>
                            You currently have <strong>{counts.activities}</strong> {counts.activities === 1 ? 'activity' : 'activities'} saved.
                        </p>
                    </div>
                </main>

                <aside className={`${styles.rightSidebar} ${styles.collapsible}`}>
                    <div className={styles.toolsPanel}>
                        <h3 className={styles.toolsPanelTitle}>Neil's Tools</h3>
                        <div className={styles.toolsList}>
                            <button className={styles.toolButton}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#437E84' }}>lightbulb</span>
                                <div className={styles.toolButtonText}>
                                    <div className={styles.toolButtonTitle}>Essay Ideas</div>
                                    <div className={styles.toolButtonDesc}>Generate topics</div>
                                </div>
                            </button>
                            <button className={styles.toolButton}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#437E84' }}>search</span>
                                <div className={styles.toolButtonText}>
                                    <div className={styles.toolButtonTitle}>College Search</div>
                                    <div className={styles.toolButtonDesc}>Find your fit</div>
                                </div>
                            </button>
                            <button className={styles.toolButton}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#437E84' }}>download</span>
                                <div className={styles.toolButtonText}>
                                    <div className={styles.toolButtonTitle}>Download Resume</div>
                                    <div className={styles.toolButtonDesc}>Export profile</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

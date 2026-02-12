'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../dashboard/dashboard.module.css';
import Sidebar from '@/components/Sidebar';
import EssaysListView from './views/EssaysListView';
import ValuesView from './views/ValuesView';
import IdeaGeneratorView from './views/IdeaGeneratorView';
import CollegesView from './views/CollegesView';
import WalkthroughModal from './components/WalkthroughModal';

interface UserData {
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
    role?: string;
}

interface Counts {
    activities: number;
    honors: number;
    tests: number;
    essays: number;
    colleges: number;
}

type EssayStatus = 'Idea' | 'In Progress' | 'Proofread' | 'Submitted';

interface Essay {
    id: string;
    title: string;
    idea: string;
    content?: string;
    status?: EssayStatus;
    assignedColleges?: string[];
    assignedValues?: string[];
    lastModified?: string;
    createdAt?: string;
    isCommonApp?: boolean;
    sourceEssayId?: string;
    promptId?: string;
    collegeId?: string;
}

interface College {
    id: string;
    collegeName: string;
}

type ViewType = 'Overview' | 'Colleges' | 'Generate' | 'Values';

export default function Essays() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });
    const [loading, setLoading] = useState(true);
    const [essays, setEssays] = useState<Essay[]>([]);
    const [colleges, setColleges] = useState<College[]>([]);
    const [currentView, setCurrentView] = useState<ViewType>('Overview');
    const [showWalkthrough, setShowWalkthrough] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const viewParam = searchParams.get('view');
        if (viewParam && ['Overview', 'Colleges', 'Generate', 'Values'].includes(viewParam)) {
            setCurrentView(viewParam as ViewType);
        }
    }, [searchParams]);

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

                const subcollections = ['activities', 'honors', 'tests', 'essays', 'colleges'];
                const newCounts: Counts = {
                    activities: 0,
                    honors: 0,
                    tests: 0,
                    essays: 0,
                    colleges: 0,
                };

                for (const subcollection of subcollections) {
                    const snapshot = await getDocs(collection(db, 'users', user.uid, subcollection));
                    newCounts[subcollection as keyof Counts] = snapshot.size;
                }

                setCounts(newCounts);

                // Fetch essays and sort by last modified
                const essaysSnapshot = await getDocs(collection(db, 'users', user.uid, 'essays'));
                const essaysData = essaysSnapshot.docs
                    .map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    } as Essay))
                    .sort((a, b) => {
                        const aTime = a.lastModified || a.createdAt || '';
                        const bTime = b.lastModified || b.createdAt || '';
                        return bTime.localeCompare(aTime);
                    });
                setEssays(essaysData);

                // Fetch colleges
                const collegesSnapshot = await getDocs(collection(db, 'users', user.uid, 'colleges'));
                const collegesData = collegesSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    collegeName: doc.data().collegeName || '',
                } as College));
                setColleges(collegesData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    // Auto-show walkthrough if no essays exist
    useEffect(() => {
        if (!loading && essays.length === 0 && counts.essays === 0) {
            setShowWalkthrough(true);
        }
    }, [loading, essays.length, counts.essays]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const renderView = () => {
        switch (currentView) {
            case 'Overview':
                return (
                    <EssaysListView
                        user={user}
                        essays={essays}
                        colleges={colleges}
                        setEssays={setEssays}
                        setCounts={setCounts}
                        onShowWalkthrough={() => setShowWalkthrough(true)}
                    />
                );
            case 'Colleges':
                return (
                    <CollegesView
                        user={user}
                        essays={essays}
                        colleges={colleges}
                        setEssays={setEssays}
                        initialExpandedCollegeId={searchParams.get('collegeId') || undefined}
                    />
                );
            case 'Generate':
                return (
                    <IdeaGeneratorView
                        user={user}
                        counts={counts}
                        setCounts={setCounts}
                        setEssays={setEssays}
                        colleges={colleges}
                        essays={essays}
                    />
                );
            case 'Values':
                return (
                    <ValuesView
                        user={user}
                        essays={essays}
                        setEssays={setEssays}
                    />
                );
            default:
                return null;
        }
    };

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

            <div className={styles.mainLayoutTwoCol}>
                <Sidebar
                    userRole={userData?.role as any}
                    counts={counts}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/essays"
                />

                <main className={styles.centerContent}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h1 className={styles.pageTitle} style={{ margin: 0 }}>Essays</h1>

                        {/* View Switcher */}
                        <div style={{ display: 'flex', background: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            {(['Overview', 'Colleges', 'Values', 'Generate'] as ViewType[]).map((view) => (
                                <button
                                    key={view}
                                    onClick={() => setCurrentView(view)}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: currentView === view ? '#437E84' : 'transparent',
                                        color: currentView === view ? 'white' : '#64748b',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {view}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingImage}>
                                <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                            </div>
                            <div className={styles.loading}>Loading essays...</div>
                        </div>
                    ) : (
                        renderView()
                    )}
                </main>
            </div>
            <WalkthroughModal isOpen={showWalkthrough} onClose={() => setShowWalkthrough(false)} />
        </div>
    );
}

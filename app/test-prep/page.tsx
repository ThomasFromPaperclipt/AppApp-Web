'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from './test-prep.module.css';
import dashboardStyles from '../dashboard/dashboard.module.css';
import Sidebar from '@/components/Sidebar';

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
    essays: number;
    colleges: number;
}

export default function TestPrep() {
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
    const [vocabStats, setVocabStats] = useState({
        wordsLearned: 0,
        savedWords: 0,
        streak: 0
    });
    const [readingStats, setReadingStats] = useState({
        questionsCorrect: 0,
        passagesRead: 0
    });

    const [desmosStats, setDesmosStats] = useState({
        completed: 0,
        total: 6
    });

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

                // Fetch counts
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

                // Fetch vocabulary stats
                const vocabSnapshot = await getDocs(collection(db, 'users', user.uid, 'vocabulary'));
                const savedCount = vocabSnapshot.docs.filter(doc => doc.data().saved).length;

                // Calculate actual streak
                const currentStreak = await calculateStreak(user.uid);

                setVocabStats({
                    wordsLearned: vocabSnapshot.size,
                    savedWords: savedCount,
                    streak: currentStreak
                });

                // Fetch reading & writing stats
                const readingProgressRef = doc(db, 'users', user.uid, 'reading_progress', 'bluebook_v1');
                const readingProgressDoc = await getDoc(readingProgressRef);
                if (readingProgressDoc.exists()) {
                    const data = readingProgressDoc.data();
                    setReadingStats({
                        questionsCorrect: data.questionsCorrect || 0,
                        passagesRead: data.questionsAttempted || 0 // Reusing passagesRead state variable for attempted count to minimize refactor
                    });
                }

                // Load Desmos stats from localStorage
                const savedDesmos = localStorage.getItem('desmosCompletedLessons');
                if (savedDesmos) {
                    const completed = JSON.parse(savedDesmos);
                    setDesmosStats(prev => ({
                        ...prev,
                        completed: completed.length
                    }));
                }

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const calculateStreak = async (userId: string): Promise<number> => {
        try {
            // Collect all practice dates from vocabulary
            const vocabSnapshot = await getDocs(collection(db, 'users', userId, 'vocabulary'));
            const practiceDates: Date[] = [];

            vocabSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.lastPracticed) {
                    const date = data.lastPracticed.toDate ? data.lastPracticed.toDate() : new Date(data.lastPracticed);
                    practiceDates.push(date);
                }
            });

            // Collect practice date from reading comprehension (Legacy)
            const readingProgressRef = doc(db, 'users', userId, 'reading_progress', 'general');
            const readingProgressDoc = await getDoc(readingProgressRef);
            if (readingProgressDoc.exists()) {
                const data = readingProgressDoc.data();
                if (data.lastPracticed) {
                    const date = data.lastPracticed.toDate ? data.lastPracticed.toDate() : new Date(data.lastPracticed);
                    practiceDates.push(date);
                }
            }

            // Collect practice date from Reading & Writing (New)
            const rwProgressRef = doc(db, 'users', userId, 'reading_progress', 'bluebook_v1');
            const rwProgressDoc = await getDoc(rwProgressRef);
            if (rwProgressDoc.exists()) {
                const data = rwProgressDoc.data();
                if (data.lastPracticed) {
                    const date = data.lastPracticed.toDate ? data.lastPracticed.toDate() : new Date(data.lastPracticed);
                    practiceDates.push(date);
                }
            }

            if (practiceDates.length === 0) {
                return 0;
            }

            // Helper to get local date string YYYY-MM-DD
            const getLocalDateString = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // Get unique dates (YYYY-MM-DD format) using LOCAL time and sort them
            const uniqueDates = Array.from(new Set(
                practiceDates.map(date => getLocalDateString(new Date(date)))
            )).sort().reverse(); // Most recent first

            // Check if there's activity today or yesterday (to allow for streak continuation)
            const todayStr = getLocalDateString(new Date());
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);

            const mostRecentDateStr = uniqueDates[0];

            // If the last practice wasn't today or yesterday, streak is broken
            if (mostRecentDateStr !== todayStr && mostRecentDateStr !== yesterdayStr) {
                return 0;
            }

            // Count consecutive days backwards from the most recent practice
            let streak = 1;
            let currentDateStr = uniqueDates[0];

            for (let i = 1; i < uniqueDates.length; i++) {
                // Decrement date properly
                const currPart = currentDateStr.split('-').map(Number);
                const prevDateObj = new Date(currPart[0], currPart[1] - 1, currPart[2]);
                prevDateObj.setDate(prevDateObj.getDate() - 1);
                const expectedPrevDateStr = getLocalDateString(prevDateObj);

                if (uniqueDates[i] === expectedPrevDateStr) {
                    streak++;
                    currentDateStr = uniqueDates[i];
                } else {
                    break;
                }
            }

            return streak;
        } catch (error) {
            console.error('Error calculating streak:', error);
            return 0;
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
            <div className={dashboardStyles.loadingContainer}>
                <div className={dashboardStyles.loadingImage}>
                    <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                </div>
                <div className={dashboardStyles.loading}>Loading test prep...</div>
            </div>
        );
    }

    return (
        <div className={dashboardStyles.container}>
            <nav className={dashboardStyles.topNav}>
                <div className={dashboardStyles.navContent}>
                    <img src="/assets/elongatedNeil.png" alt="AppApp" className={dashboardStyles.logoImage} />
                    <div className={dashboardStyles.topUserCard} onClick={() => router.push('/profile')}>
                        <div className={dashboardStyles.topUserAvatar}>
                            {userData?.firstName?.charAt(0)}{userData?.lastName?.charAt(0)}
                        </div>
                        <div className={dashboardStyles.topUserDetails}>
                            <div className={dashboardStyles.topUserName}>{userData?.firstName} {userData?.lastName}</div>
                            <div className={dashboardStyles.topUserEmail}>{userData?.email}</div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className={dashboardStyles.mainLayoutTwoCol}>
                <Sidebar
                    counts={counts}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/test-prep"
                />

                <main className={dashboardStyles.centerContent}>
                    <div className={styles.heroSection}>
                        <div className={styles.heroStreakContainer}>
                            <img
                                src={vocabStats.streak > 0 ? "/assets/streak.png" : "/assets/noStreak.png"}
                                alt={vocabStats.streak > 0 ? "Active Streak" : "No Streak"}
                                className={styles.heroStreak}
                            />
                            <div className={styles.heroStreakTextContainer}>
                                {vocabStats.streak === 0 ? (
                                    <div>
                                        <div className={styles.heroStreakNoStreak}>Practice to</div>
                                        <div className={styles.heroStreakNoStreak}>extend your streak!</div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles.heroStreakNumber}>{vocabStats.streak}</div>
                                        <div className={styles.heroStreakLabel}>day streak!</div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className={styles.heroContent}>
                            <h1 className={styles.heroTitle}>Neil's Test Prep</h1>
                            <p className={styles.heroSubtitle}>
                                Master the SAT with Neil's AI-powered practice tools!
                            </p>
                        </div>
                    </div>

                    <div className={styles.modulesGrid}>
                        {/* Vocabulary Practice - Active */}
                        <div className={styles.moduleCard} onClick={() => router.push('/test-prep/vocabulary')}>
                            <span className={styles.moduleIcon}>📚</span>
                            <h2 className={styles.moduleTitle}>Vocabulary Practice</h2>
                            <p className={styles.moduleDescription}>
                                Master SAT vocabulary with interactive flashcards and quizzes!
                            </p>
                            <div className={styles.moduleStats}>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>{vocabStats.wordsLearned}</div>
                                    <div className={styles.statLabel}>Learned /450</div>
                                </div>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>{vocabStats.savedWords}</div>
                                    <div className={styles.statLabel}>Saved</div>
                                </div>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>{vocabStats.streak}</div>
                                    <div className={styles.statLabel}>Day Streak</div>
                                </div>
                            </div>
                        </div>

                        {/* Reading & Writing - Active */}
                        <div className={styles.moduleCard} onClick={() => router.push('/test-prep/reading')}>
                            <span className={styles.moduleIcon}>📖</span>
                            <h2 className={styles.moduleTitle}>Reading & Writing</h2>
                            <p className={styles.moduleDescription}>
                                Master reading and writing skills with 100 focused practice questions!
                            </p>
                            <div className={styles.moduleStats}>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>{readingStats.questionsCorrect}</div>
                                    <div className={styles.statLabel}>Correct</div>
                                </div>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>{readingStats.passagesRead}</div>
                                    <div className={styles.statLabel}>Attempted</div>
                                </div>
                            </div>
                        </div>

                        {/* Math Practice - Master Desmos */}
                        <div
                            className={styles.moduleCard}
                            onClick={() => router.push('/test-prep/math')}
                        >
                            <span className={styles.moduleIcon}>🧮</span>
                            <h2 className={styles.moduleTitle}>Master Desmos</h2>
                            <p className={styles.moduleDescription}>
                                You get a powerful calculator on the entire math section! Learn how to get the most out of it.
                            </p>
                            <div className={styles.moduleStats}>
                                <div className={styles.stat}>
                                    <div className={styles.statValue}>{desmosStats.completed}</div>
                                    <div className={styles.statLabel}>Lessons Completed / {desmosStats.total}</div>
                                </div>
                            </div>
                        </div>



                        {/* Practice Tests - Coming Soon */}
                        <div className={`${styles.moduleCard} ${styles.comingSoon}`}>
                            <span className={styles.moduleIcon}>📝</span>
                            <h2 className={styles.moduleTitle}>Full Practice Tests</h2>
                            <p className={styles.moduleDescription}>
                                Take full-length timed practice tests with in-depth score reports!
                            </p>
                            <span className={styles.comingSoonBadge}>Coming Soon</span>
                        </div>

                        {/* Study Plans - Coming Soon */}
                        <div className={styles.moduleCard} onClick={() => router.push('/test-prep/study-plan')}>
                            <span className={styles.moduleIcon}>📅</span>
                            <h2 className={styles.moduleTitle}>Personalized Study Plans</h2>
                            <p className={styles.moduleDescription}>
                                Get a customized study schedule based on your goals and test date!
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

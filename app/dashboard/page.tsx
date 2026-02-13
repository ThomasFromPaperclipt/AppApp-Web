'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc, arrayUnion, query, where, Timestamp, onSnapshot, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { auth, db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { calculateAndUpdateScores } from '@/lib/scoreCalculator';

import ReactMarkdown from 'react-markdown';
import Sidebar from '@/components/Sidebar';
import styles from './dashboard.module.css';
import { DataCategorySection } from './DashboardComponents';

interface UserData {
    uid?: string; // Added for client-side usage
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
    role?: 'student' | 'parent' | 'counselor';
    shareCode?: string;
    linkedStudentIds?: string[];
    lastGradeUpdate?: any; // Timestamp or Date
}

interface Counts {
    activities: number;
    honors: number;
    tests: number;
    essays: number;
    colleges: number;
}

// Interfaces for Detailed View
interface Activity {
    id: string;
    organizationName: string;
    activityType: string;
    position: string;
    description: string;
    gradeLevels: number[];
    hoursPerWeek: string;
    weeksPerYear: string;
    participateInCollege: boolean;
    participationTiming: string;
    isStarred?: boolean;
}

interface Honor {
    id: string;
    honorTitle: string;
    honorType: 'school' | 'state' | 'national' | 'international';
    date: string;
    description: string;
    createdAt: Date;
    isStarred?: boolean;
}

interface Test {
    id: string;
    type: string;
    apTest?: string;
    score: string | number;
    date: string;
}

interface College {
    id: string;
    collegeName: string;
    collegeScore: string;
    toured: boolean;
    applicationStatus: string;
    notes: string;
    imageNames: string[];
    createdAt: Date;
}

interface Essay {
    id: string;
    title: string;
    idea: string;
    content?: string; // HTML content from editor
    status: string;
    promptText?: string; // Direct prompt text from idea generator
    promptId?: string; // Reference to essay_prompts collection
    commonAppPrompt?: string; // Common App prompt text
    isCommonApp?: boolean;
    isEmphasized?: boolean;
    createdAt: Date | string;
}

// Global Helper Functions (can be moved to utils later)
const getActivityTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
        academic: 'Academic 📖',
        art: 'Art 🎨',
        clubAthlete: 'Club Athletics 🏅',
        athlete: 'Athletics 🏆',
        career: 'Career-Oriented 🏢',
        volunteer: 'Volunteering ☺️',
        tech: 'Tech 📡',
        cultural: 'Cultural 🌎',
        dance: 'Dance 🕺',
        speech: 'Speech/Debate 💼',
        environmental: 'Environmental 🌱',
        family: 'Family 👨‍👩‍👧‍👦',
        foreign: 'Foreign Exchange ✈️',
        internship: 'Internship 📈',
        journalism: 'Journalism 📰',
        rotc: 'Jr. R.O.T.C. 🇺🇸',
        lgbt: 'LGBT+ 🏳️‍🌈',
        instrumental: 'Instrumental Music 🎷',
        vocal: 'Singing 🎤',
        religious: 'Religious 🛐',
        research: 'Research 🔬',
        robotics: 'Robotics 🤖',
        schoolspirit: 'School Spirit 🎉',
        sciencemath: 'Science/Math 🧪',
        justice: 'Social Justice ✊',
        politics: 'Politics/Student Government 👩‍⚖️',
        theater: 'Theater 🎭',
        work: 'Job 💵',
        other: 'Other'
    };
    return typeMap[type] || 'Unknown Activity Type';
};

const getHonorTypeBadge = (type: string) => {
    switch (type) {
        case 'state': return 'State/Regional 📌';
        case 'national': return 'National 🇺🇸';
        case 'international': return 'International 🌐';
        case 'school': return 'School-wide 🏫';
        default: return 'Unknown';
    }
};

const getTestTypeColor = (type: string) => {
    const colors: { [key: string]: { border: string; bg: string; bgGradient: string } } = {
        'SAT': { border: '#BFDBFE', bg: '#F8FAFC', bgGradient: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)' },
        'ACT': { border: '#DDD6FE', bg: '#F8FAFC', bgGradient: 'linear-gradient(135deg, #F5F3FF 0%, #F8FAFC 100%)' },
        'AP': { border: '#f7a8a8ff', bg: '#ffe0e0ff', bgGradient: 'linear-gradient(135deg, #ffebebff 0%, #fcf8f8ff 100%)' },
        'PSAT 8/9': { border: '#A7F3D0', bg: '#F8FAFC', bgGradient: 'linear-gradient(135deg, #F0FDF4 0%, #F8FAFC 100%)' },
        'PSAT/NMSQT': { border: '#A5F3FC', bg: '#F8FAFC', bgGradient: 'linear-gradient(135deg, #ECFEFF 0%, #F8FAFC 100%)' },
    };
    return colors[type] || { border: '#E5E7EB', bg: '#F8FAFC', bgGradient: 'linear-gradient(135deg, #F9FAFB 0%, #F8FAFC 100%)' };
};

const getTestTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
        'SAT': 'SAT 📝', 'ACT': 'ACT 📚', 'AP': 'AP Exams 🎓',
        'PSAT 8/9': 'PSAT 8/9 📖', 'PSAT/NMSQT': 'PSAT/NMSQT 📊',
    };
    return labels[type] || type;
};

const getScoreDisplay = (score: string) => {
    const scoreMap: { [key: string]: string } = {
        '10': '10/10 💯',
        '9': '9/10 😍',
        '8': '8/10 😁',
        '7': '7/10 😀',
        '6': '6/10 🙂',
        '5': '5/10 😐',
        '4': '4/10 😕',
        '3': '3/10 ☹️',
        '2': '2/10 😭',
        '1': '1/10 🤮',
    };
    return scoreMap[score] || 'No Score';
};

const getApplicationStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { text: string; bg: string; color: string } } = {
        'not_applying': { text: '', bg: '', color: '' },
        'applying': { text: '📝 Applying', bg: '#E3F2FD', color: '#1565C0' },
        'applied': { text: '✉️ Applied', bg: '#FFF4E6', color: '#E67700' },
        'accepted': { text: '🎉 Accepted', bg: '#E6F4EA', color: '#137333' },
    };
    return statusMap[status] || statusMap['not_applying'];
};

interface AnalyticsData {
    currentScore: number;
    insights?: string;
}

interface CalendarEvent {
    id: string;
    title: string;
    date: Date;
    type: 'assignment' | 'test' | 'application-due' | 'application-response' | 'study' | 'other';
    description?: string;
    completed: boolean;
    period?: number;
}

export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [navigating, setNavigating] = useState(false);
    const [linkCode, setLinkCode] = useState('');
    const [linking, setLinking] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [canRecalculate, setCanRecalculate] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [vocabStats, setVocabStats] = useState({
        wordsLearned: 0,
        savedWords: 0,
        streak: 0
    });
    const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

    // Secure Linking State
    const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: number } | null>(null);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [authorizedViewers, setAuthorizedViewers] = useState<any[]>([]);
    const [viewersLoading, setViewersLoading] = useState(false);

    // Counselor State
    const [linkedStudents, setLinkedStudents] = useState<UserData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [detailedData, setDetailedData] = useState<{
        activities: Activity[];
        honors: Honor[];
        tests: Test[];
        colleges: College[];
        essays: Essay[];
    }>({ activities: [], honors: [], tests: [], colleges: [], essays: [] });
    const [isNeilHovered, setIsNeilHovered] = useState(false);
    const [isInsightsOpen, setIsInsightsOpen] = useState(false);
    const [viewingEssay, setViewingEssay] = useState<Essay | null>(null);

    const router = useRouter();

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

                    // 1. Handle Counselor OR Parent Sidebar List
                    // Treat parents like counselors: fetch all linked students to populate sidebar
                    if (data.role === 'counselor' || data.role === 'parent') {
                        try {
                            const linkedIds = data.linkedStudentIds || [];
                            if (linkedIds.length > 0) {
                                // Fetch all students in parallel
                                const studentDocs = await Promise.all(
                                    linkedIds.map(id => getDoc(doc(db, 'users', id)))
                                );

                                const students = studentDocs
                                    .filter(doc => doc.exists())
                                    .map(doc => {
                                        const d = doc.data();
                                        return {
                                            uid: doc.id, // Ensure we use the doc ID as UID
                                            firstName: d.firstName,
                                            lastName: d.lastName,
                                            gradeLevel: d.gradeLevel,
                                            email: d.email,
                                            ...d // Spread rest just in case but we constructed the essential interface
                                        } as UserData;
                                    });

                                setLinkedStudents(students);

                                // Default selection logic
                                // Only auto-select for counselors (optional) or if desired. 
                                // For parents, we want the "Overview" to be the default if they have multiple students or even one.
                                if (data.role !== 'parent' && !selectedStudentId && students.length > 0) {
                                    setSelectedStudentId(students[0].uid as string);
                                }
                            } else {
                                setLinkedStudents([]);
                            }
                        } catch (err) {
                            console.error('Error fetching linked students (client):', err);
                        }
                    }

                    // 2. Determine Target Student for Main View
                    let targetUid = currentUser.uid;
                    let shouldFetchData = true;

                    if (data.role === 'parent' || data.role === 'counselor') {
                        if (selectedStudentId) {
                            targetUid = selectedStudentId; // Driven by sidebar selection for both roles
                        } else {
                            shouldFetchData = false; // No student selected, show add UI
                        }
                    }

                    // 3. Check for Grade Level Rollover (Automatic Update)
                    // Academic year starts in August (Month 7)
                    const ACADEMIC_YEAR_START_MONTH = 7;

                    const getAcademicYear = (date: Date) => {
                        const year = date.getFullYear();
                        const month = date.getMonth();
                        return month >= ACADEMIC_YEAR_START_MONTH ? year : year - 1;
                    };

                    const now = new Date();
                    const currentAcademicYear = getAcademicYear(now);

                    // Check if we need to update
                    let lastUpdateDate = now;
                    if (data.lastGradeUpdate) {
                        if (typeof data.lastGradeUpdate.toDate === 'function') {
                            lastUpdateDate = data.lastGradeUpdate.toDate();
                        } else if (data.lastGradeUpdate instanceof Date) {
                            lastUpdateDate = data.lastGradeUpdate;
                        } else {
                            lastUpdateDate = new Date(data.lastGradeUpdate);
                        }
                    } else {
                        await updateDoc(userDocRef, { lastGradeUpdate: now });
                    }

                    const lastUpdateAcademicYear = getAcademicYear(lastUpdateDate);

                    if (currentAcademicYear > lastUpdateAcademicYear) {
                        const yearsPassed = currentAcademicYear - lastUpdateAcademicYear;
                        const currentGrade = parseInt(data.gradeLevel || '9');

                        if (!isNaN(currentGrade) && currentGrade < 12) {
                            const newGrade = Math.min(12, currentGrade + yearsPassed);

                            if (newGrade > currentGrade) {
                                console.log(`Auto-updating grade from ${currentGrade} to ${newGrade}`);
                                await updateDoc(userDocRef, {
                                    gradeLevel: newGrade.toString(),
                                    lastGradeUpdate: now
                                });

                                setUserData(prev => prev ? ({ ...prev, gradeLevel: newGrade.toString() }) : null);
                                alert(`Welcome back! 🎒\n\nSince it's a new school year, we've updated your grade level to ${newGrade}th Grade.`);
                            }
                        } else if (currentGrade >= 12) {
                            await updateDoc(userDocRef, { lastGradeUpdate: now });
                        }
                    }

                    // 3. Fetch Dashboard Data
                    if (shouldFetchData) {
                        if (targetUid === currentUser.uid) {
                            // A. Client-side Fetching (For Student's Own Data)
                            // This avoids API issues if server env vars aren't set locally
                            try {
                                // Fetch Analytics
                                const analyticsRef = doc(db, 'users', targetUid, 'analytics', 'monthlyScores');
                                const analyticsSnap = await getDoc(analyticsRef);
                                const analytics = analyticsSnap.exists() ? analyticsSnap.data() as AnalyticsData : null;
                                setAnalyticsData(analytics);

                                // Check if user can recalculate
                                if (analytics && (analytics as any).lastUpdated) {
                                    const lastUpdatedDate = (analytics as any).lastUpdated.toDate();
                                    const currentDate = new Date();
                                    setCanRecalculate(
                                        !(
                                            lastUpdatedDate.getMonth() === currentDate.getMonth() &&
                                            lastUpdatedDate.getFullYear() === currentDate.getFullYear()
                                        )
                                    );
                                } else {
                                    setCanRecalculate(true);
                                }

                                // Fetch Counts
                                const subcollections = ['activities', 'honors', 'tests', 'essays', 'colleges'];
                                const newCounts: any = {};

                                await Promise.all(subcollections.map(async (sub) => {
                                    const subRef = collection(db, 'users', targetUid, sub);
                                    const snapshot = await getDocs(subRef);
                                    newCounts[sub] = snapshot.size;
                                }));

                                setCounts(newCounts as Counts);

                                // Fetch vocabulary stats
                                const vocabSnapshot = await getDocs(collection(db, 'users', targetUid, 'vocabulary'));
                                const savedCount = vocabSnapshot.docs.filter(doc => doc.data().saved).length;

                                // Calculate streak
                                const currentStreak = await calculateStreak(targetUid);

                                setVocabStats({
                                    wordsLearned: vocabSnapshot.size,
                                    savedWords: savedCount,
                                    streak: currentStreak
                                });

                                // Fetch Events for Calendar Preview
                                const eventsRef = collection(db, 'users', targetUid, 'events');
                                const eventsSnap = await getDocs(eventsRef);
                                const allEvents: CalendarEvent[] = [];
                                eventsSnap.forEach(doc => {
                                    const data = doc.data();
                                    allEvents.push({
                                        id: doc.id,
                                        title: data.title,
                                        date: data.date.toDate(),
                                        type: data.type,
                                        description: data.description,
                                        completed: data.completed,
                                        period: data.period
                                    });
                                });

                                // Filter for future events and sort
                                const now = new Date();
                                now.setHours(0, 0, 0, 0); // Include today
                                const futureEvents = allEvents
                                    .filter(e => e.date >= now)
                                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                                    .slice(0, 6);

                                setUpcomingEvents(futureEvents);

                            } catch (err) {
                                console.error('Error fetching dashboard data (client):', err);
                            }
                        } else {
                            // B. Client-side Fetching (For Parent/Counselor Viewing Linked Data)
                            // Now permitted by 'hasGrant' security rule in firestore.rules
                            try {
                                // Fetch Analytics
                                const analyticsRef = doc(db, 'users', targetUid, 'analytics', 'monthlyScores');
                                const analyticsSnap = await getDoc(analyticsRef);
                                const analytics = analyticsSnap.exists() ? analyticsSnap.data() as AnalyticsData : null;
                                setAnalyticsData(analytics);

                                // Update canRecalculate (disabled for viewers usually, but good to have state)
                                setCanRecalculate(false);

                                // Fetch Counts using getCountFromServer (efficient)
                                const subcollections = ['activities', 'honors', 'tests', 'essays', 'colleges'];
                                const newCounts: any = {};

                                await Promise.all(subcollections.map(async (sub) => {
                                    const subRef = collection(db, 'users', targetUid, sub);
                                    // Use getCountFromServer for efficiency if supported by SDK, 
                                    // or fallback to getDocs().size. SDK v10.13 supports it.
                                    try {
                                        const snapshot = await getCountFromServer(subRef);
                                        newCounts[sub] = snapshot.data().count;
                                    } catch (e) {
                                        // Fallback for safety
                                        const snapshot = await getDocs(subRef);
                                        newCounts[sub] = snapshot.size;
                                    }
                                }));

                                setCounts(newCounts as Counts);

                                // Fetch upcoming events for viewer? 
                                // Optional, mimicking previous behavior which seemingly didn't show events 
                                // based on the API response structure viewed earlier (API only returned profile, analytics, counts).
                                // But if we want to show it, we can. Let's start with parity (API didn't return events).

                            } catch (err) {
                                console.error('Error fetching dashboard data (client viewer):', err);
                                // If permission denied, it will be caught here.
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
            } finally {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    // Fetch Detailed Data & Dashboard Info when Linked Student Selected
    useEffect(() => {
        const fetchStudentData = async () => {
            if (!user || !userData) return;
            if (userData.role !== 'parent' && userData.role !== 'counselor') return;
            if (!selectedStudentId) return;

            try {
                // Fetch all required data in parallel
                const [
                    activitiesSnap,
                    honorsSnap,
                    testsSnap,
                    essaysSnap,
                    collegesSnap,
                    analyticsSnap
                ] = await Promise.all([
                    getDocs(collection(db, 'users', selectedStudentId, 'activities')),
                    getDocs(collection(db, 'users', selectedStudentId, 'honors')),
                    getDocs(collection(db, 'users', selectedStudentId, 'tests')),
                    getDocs(collection(db, 'users', selectedStudentId, 'essays')),
                    getDocs(collection(db, 'users', selectedStudentId, 'colleges')),
                    getDoc(doc(db, 'users', selectedStudentId, 'analytics', 'monthlyScores'))
                ]);

                // Process essays and fetch linked prompts
                const rawEssays = essaysSnap.docs.map(d => ({ id: d.id, ...d.data() } as Essay));

                // Fetch prompts for essays that have promptId
                const essaysWithPrompts = await Promise.all(
                    rawEssays.map(async (essay) => {
                        if (essay.promptId && !essay.promptText) {
                            try {
                                const promptDoc = await getDoc(doc(db, 'users', selectedStudentId, 'essay_prompts', essay.promptId));
                                if (promptDoc.exists()) {
                                    return {
                                        ...essay,
                                        promptText: promptDoc.data().promptText || ''
                                    };
                                }
                            } catch (e) {
                                console.error('Error fetching prompt for essay:', essay.id, e);
                            }
                        }
                        return essay;
                    })
                );

                // Update Detailed Data
                setDetailedData({
                    activities: activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)),
                    honors: honorsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Honor)),
                    tests: testsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Test)),
                    colleges: collegesSnap.docs.map(d => ({
                        id: d.id,
                        ...d.data(),
                        // Add defaults for potentially missing fields if needed, 
                        // though interface expects them. data() usually respects what's in DB.
                        // We might need to handle Date conversion if createdAt is a Timestamp
                        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date()
                    } as College)),
                    essays: essaysWithPrompts
                });

                // Update Counts
                setCounts({
                    activities: activitiesSnap.size,
                    honors: honorsSnap.size,
                    tests: testsSnap.size,
                    essays: essaysSnap.size,
                    colleges: collegesSnap.size
                });

                // Update Analytics (Readiness Score)
                const analytics = analyticsSnap.exists() ? analyticsSnap.data() as AnalyticsData : null;
                setAnalyticsData(analytics);

                // Disable Recalculate for Viewers
                setCanRecalculate(false);

            } catch (error) {
                console.error("Error fetching student data:", error);
            }
        };

        fetchStudentData();
    }, [selectedStudentId, userData, user]);

    // Fetch Pending Requests and Authorized Viewers (Real-time)
    useEffect(() => {
        if (!user || (userData?.role && userData.role !== 'student')) return;

        setViewersLoading(true);

        // 1. Pending Requests Listener
        const pendingRef = collection(db, 'students', user.uid, 'pendingShares');
        const unsubPending = onSnapshot(pendingRef, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPendingRequests(requests);
        });

        // 2. Authorized Viewers (Grants) Listener
        const grantsRef = collection(db, 'students', user.uid, 'grants');
        const unsubGrants = onSnapshot(grantsRef, (snapshot) => {
            const viewers = snapshot.docs.map(doc => ({
                id: doc.id, // viewerUid
                ...doc.data()
            }));
            setAuthorizedViewers(viewers);
            setViewersLoading(false);
        });

        return () => {
            unsubPending();
            unsubGrants();
        };
    }, [user, userData]);

    // Effect to clear generated code if a new pending request arrives
    useEffect(() => {
        if (generatedCode && pendingRequests.length > 0) {
            // Check if any request was created RECENTLY (e.g. after code generation)
            // Or just clear it to be safe/clean UX as requested
            setGeneratedCode(null);
        }
    }, [pendingRequests, generatedCode]);

    const handleGenerateCode = async () => {
        setGeneratingCode(true);
        try {
            const generateShareCode = httpsCallable(functions, 'generateShareCode');
            const result = await generateShareCode();
            setGeneratedCode(result.data as { code: string; expiresAt: number });
        } catch (error) {
            console.error("Error generating code:", error);
            alert("Failed to generate code. Please try again.");
        } finally {
            setGeneratingCode(false);
        }
    };

    const handleRespondToRequest = async (inviteId: string, action: 'accept' | 'deny') => {
        try {
            const respondToShareRequest = httpsCallable(functions, 'respondToShareRequest');
            await respondToShareRequest({ inviteId, action });
            // UI updates automatically via onSnapshot
        } catch (error) {
            console.error(`Error ${action}ing request:`, error);
            alert(`Failed to ${action} request.`);
        }
    };

    const handleRevokeAccess = async (viewerUid: string) => {
        if (!confirm("Are you sure you want to remove this person's access?")) return;
        try {
            const revokeAccess = httpsCallable(functions, 'revokeAccess');
            await revokeAccess({ viewerUid });
            // UI updates automatically via onSnapshot
        } catch (error) {
            console.error("Error revoking access:", error);
            alert("Failed to revoke access.");
        }
    };

    const handleUnlinkSelf = async () => {
        if (!selectedStudentId) return;
        if (!confirm("Are you sure you want to remove this student from your roster?")) return;

        try {
            const unlinkStudent = httpsCallable(functions, 'unlinkStudent');
            await unlinkStudent({ studentUid: selectedStudentId });

            // Optimistic / Manual update since we might simply lose access immediately
            setLinkedStudents(prev => prev.filter(s => s.uid !== selectedStudentId));
            setSelectedStudentId(null);

            alert("Student removed successfully.");
        } catch (error) {
            console.error("Error unlinking student:", error);
            alert("Failed to unsync student.");
        }
    };

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

            // Collect practice date from reading comprehension
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
                const prevDate = new Date(currentDateStr + 'T00:00:00'); // Force local midnight parsing (simplified) or better just manual calc
                // Actually safer to just decrement the string date
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

    const [sentRequests, setSentRequests] = useState<string[]>([]); // Track codes for session-based feedback

    const handleLinkStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !linkCode) return;

        setLinking(true);
        setLinkError('');

        try {
            const claimShareCode = httpsCallable(functions, 'claimShareCode');
            await claimShareCode({ code: linkCode });

            // Add to session tracking to show feedback card
            setSentRequests(prev => [...prev, linkCode]);
            setLinkCode('');
        } catch (error: any) {
            console.error('Error linking student:', error);
            setLinkError(error.message || 'Failed to link account. Please check the code and try again.');
        } finally {
            setLinking(false);
        }
    };

    const recalculateScores = async () => {
        if (!user) return;

        setCalculating(true);
        try {
            await calculateAndUpdateScores(user.uid);

            // Refresh analytics data
            const analyticsRef = doc(db, 'users', user.uid, 'analytics', 'monthlyScores');
            const analyticsSnap = await getDoc(analyticsRef);
            const analytics = analyticsSnap.exists() ? analyticsSnap.data() as AnalyticsData : null;
            setAnalyticsData(analytics);

            // Update canRecalculate
            setCanRecalculate(false);
        } catch (error) {
            console.error('Error recalculating scores:', error);
            alert('Failed to recalculate scores. Please try again.');
        } finally {
            setCalculating(false);
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

    const getTotalUploads = () => {
        return Object.values(counts).reduce((total, count) => total + count, 0);
    };

    const handleNavigation = (path: string) => {
        setNavigating(true);
        router.push(path);
    };

    const getReadinessScore = () => {
        return analyticsData?.currentScore || 0;
    };

    const getWelcomeMessageName = () => {
        if (userData?.role === 'parent' || userData?.role === 'counselor') {
            const student = linkedStudents.find(s => s.uid === selectedStudentId);
            return student ? student.firstName : 'there';
        }
        return userData?.firstName || 'there';
    };


    return (
        <div className={styles.container}>
            <nav className={styles.topNav}>
                <div className={styles.navContent}>
                    <img src="/assets/elongatedNeil.png" alt="AppApp" className={styles.logoImage} />
                    {/* User Account Card */}
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
                {/* Left Sidebar */}
                {/* Left Sidebar */}
                <Sidebar
                    userRole={userData?.role}
                    linkedStudents={linkedStudents}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedStudentId={selectedStudentId}
                    setSelectedStudentId={setSelectedStudentId}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    counts={counts}
                    onNavigate={handleNavigation}
                    onSignOut={handleSignOut}
                    currentPath="/dashboard"
                />

                {/* Center Content */}
                <main className={styles.centerContent}>
                    {/* Welcome Hero Section */}
                    <div className={styles.welcomeHero}>
                        <div className={styles.welcomeContent}>
                            <h2 className={styles.welcomeTitle}>
                                {userData?.role === 'parent'
                                    ? "Let's get your kids ready!"
                                    : userData?.role === 'counselor'
                                        ? "Let's get your students ready!"
                                        : `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${getWelcomeMessageName()}!`
                                }
                            </h2>
                            <p className={styles.welcomeSubtitle}>
                                {userData?.role === 'parent' || userData?.role === 'counselor'
                                    ? "Here's how they're doing."
                                    : "Ready to make some progress on your applications today? I'm here to help!"
                                }
                            </p>
                        </div>
                        <div
                            className={styles.neilWrapper}
                            onMouseEnter={() => setIsNeilHovered(true)}
                            onMouseLeave={() => setIsNeilHovered(false)}
                        >
                            <img
                                src={isNeilHovered ? "/assets/flyingAIsmile.png" : "/assets/flyingAI.png"}
                                alt="Neil flying"
                                className={styles.neilImage}
                            />
                        </div>
                    </div>

                    <h1 className={styles.pageTitle}>Dashboard</h1>

                    {/* Parent/Counselor View: Link Student UI */}
                    {((userData?.role === 'parent' || userData?.role === 'counselor') && !selectedStudentId) ? (
                        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                            {/* Overview Header */}
                            {linkedStudents.length > 0 && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', color: '#2D3748', marginBottom: '1rem' }}>Linked Students</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                        {linkedStudents.map(student => (
                                            <div
                                                key={student.uid}
                                                onClick={() => setSelectedStudentId(student.uid!)}
                                                style={{
                                                    background: 'white',
                                                    borderRadius: '16px',
                                                    padding: '1.5rem',
                                                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                                    cursor: 'pointer',
                                                    border: '2px solid transparent',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '1rem'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                                    e.currentTarget.style.borderColor = '#437E84';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.borderColor = 'transparent';
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '50%',
                                                        background: '#437E84',
                                                        color: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1.25rem',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#2D3748' }}>{student.firstName} {student.lastName}</h3>
                                                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#718096' }}>{student.email}</p>
                                                    </div>
                                                </div>
                                                <div style={{ background: '#F7FAFC', padding: '0.75rem', borderRadius: '8px', marginTop: 'auto' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                                        <span style={{ color: '#718096' }}>Grade Level</span>
                                                        <span style={{ fontWeight: '600', color: '#2D3748' }}>{student.gradeLevel || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Link Student Form (Always visible in Overview, but styled differently if students exist) */}
                            <div className={styles.linkStudentCard} style={{
                                background: 'white',
                                padding: '2.5rem',
                                borderRadius: '16px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                textAlign: 'center',
                                maxWidth: '500px',
                                margin: linkedStudents.length > 0 ? '3rem auto 0' : '0 auto'
                            }}>
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
                                    {userData?.role === 'counselor' ? 'Add Student to Roster' : 'Link Another Student'}
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
                    ) : (
                        /* Application Readiness Score & Counts (Shown for Students OR Linked Parents) */
                        <>
                            <div className={styles.applicationCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 className={styles.applicationCardTitle} style={{ margin: 0 }}>
                                        {(userData?.role === 'parent' || userData?.role === 'counselor') ?
                                            `${linkedStudents.find(s => s.uid === selectedStudentId)?.firstName || 'Student'}'s Application`
                                            : 'Your Application'}
                                    </h3>
                                    {(userData?.role === 'parent' || userData?.role === 'counselor') && (
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button
                                                onClick={() => router.push(`/student-summary/${selectedStudentId}`)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    fontSize: '0.875rem',
                                                    color: '#437E84',
                                                    background: 'transparent',
                                                    border: '1px solid #437E84',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                                                View PDF Summary
                                            </button>
                                            <button
                                                onClick={handleUnlinkSelf}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    fontSize: '0.875rem',
                                                    color: '#e53e3e',
                                                    background: 'transparent',
                                                    border: '1px solid #e53e3e',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Unlink Student
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className={styles.applicationContent}>
                                    <div className={styles.scoreSection}>
                                        <div className={styles.scoreCircleContainer}>
                                            <svg className={styles.scoreCircleSvg} viewBox="0 0 120 120">
                                                <circle
                                                    cx="60"
                                                    cy="60"
                                                    r="50"
                                                    fill="none"
                                                    stroke="#E9F5F7"
                                                    strokeWidth="10"
                                                />
                                                <circle
                                                    cx="60"
                                                    cy="60"
                                                    r="50"
                                                    fill="none"
                                                    stroke="#437E84"
                                                    strokeWidth="10"
                                                    strokeDasharray={`${(analyticsData?.currentScore || 0) * 3.14} 314`}
                                                    strokeLinecap="round"
                                                    transform="rotate(-90 60 60)"
                                                />
                                            </svg>
                                            <div className={styles.scoreInner}>
                                                <div className={styles.scoreNumber}>{analyticsData?.currentScore || 0}</div>
                                                <div className={styles.scoreMax}>/100</div>
                                            </div>
                                        </div>
                                        <div className={styles.scoreInfo}>
                                            <div className={styles.scoreTitle}>Application Readiness Score</div>
                                            <div className={styles.scoreSubtitle}>Calculated by Neil Appstrong</div>
                                        </div>
                                    </div>
                                    <div className={styles.countsGrid}>
                                        {Object.entries(counts).map(([key, count]) => {
                                            const routeMap: { [key: string]: string } = {
                                                activities: '/activities',
                                                honors: '/honors',
                                                tests: '/tests',
                                                essays: '/essays',
                                                colleges: '/colleges'
                                            };
                                            return (
                                                <div
                                                    key={key}
                                                    className={styles.countItem}
                                                    onClick={(userData?.role !== 'parent' && userData?.role !== 'counselor') ? () => handleNavigation(routeMap[key]) : undefined}
                                                    style={{ cursor: (userData?.role !== 'parent' && userData?.role !== 'counselor') ? 'pointer' : 'default' }}
                                                >
                                                    <div className={styles.countNumber}>{count}</div>
                                                    <div className={styles.countLabel}>{key}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* DETAILED DATA SECTION FOR PARENTS & COUNSELORS */}
                                {(userData?.role === 'parent' || userData?.role === 'counselor') && (
                                    <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>

                                        {/* ACTIVITIES */}
                                        <DataCategorySection
                                            title="Activities"
                                            icon="skateboarding"
                                            iconColor="#000000ff"
                                            items={detailedData.activities}
                                            searchKeys={['organizationName', 'position', 'description']}
                                            groupBy={(item) => getActivityTypeLabel(item.activityType)}
                                            getItemStyle={(item) => ({ borderLeft: '4px solid #437E84' })}
                                            renderCard={(activity: Activity) => (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#2D3748', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100%' }}>{activity.organizationName}</h4>
                                                        {activity.isStarred && <span className="material-symbols-outlined" style={{ color: '#F59E0B', fontSize: '18px' }}>star</span>}
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#718096' }}>{activity.position}</p>
                                                    <span style={{ fontSize: '0.75rem', background: '#EDF2F7', padding: '2px 8px', borderRadius: '4px', width: 'fit-content', marginTop: 'auto' }}>
                                                        {getActivityTypeLabel(activity.activityType)}
                                                    </span>
                                                </div>
                                            )}
                                            renderDetail={(activity: Activity) => (
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#2D3748' }}>{activity.organizationName}</h3>
                                                    </div>
                                                    <h4 style={{ margin: '0 0 1rem 0', color: '#4A5568', fontWeight: '500' }}>{activity.position}</h4>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                                        <div style={{ background: '#F7FAFC', padding: '1rem', borderRadius: '8px' }}>
                                                            <div style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</div>
                                                            <div style={{ fontWeight: '600' }}>{getActivityTypeLabel(activity.activityType)}</div>
                                                        </div>
                                                        <div style={{ background: '#F7FAFC', padding: '1rem', borderRadius: '8px' }}>
                                                            <div style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grades</div>
                                                            <div style={{ fontWeight: '600' }}>{activity.gradeLevels.join(', ')}</div>
                                                        </div>
                                                    </div>
                                                    <p style={{ fontSize: '0.95rem', color: '#2D3748', lineHeight: '1.6' }}>
                                                        {activity.description}
                                                    </p>
                                                </div>
                                            )}
                                        />

                                        {/* HONORS */}
                                        <DataCategorySection
                                            title="Honors & Awards"
                                            icon="emoji_events"
                                            iconColor="#000000ff"
                                            items={detailedData.honors}
                                            searchKeys={['honorTitle', 'description']}
                                            groupBy={(item) => getHonorTypeBadge(item.honorType)}
                                            getItemStyle={(item) => ({ borderLeft: '4px solid #F6E05E' })}
                                            renderCard={(honor: Honor) => (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', height: '100%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#2D3748' }}>{honor.honorTitle}</h4>
                                                        {honor.isStarred && <span className="material-symbols-outlined" style={{ color: '#F59E0B', fontSize: '18px' }}>star</span>}
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', background: '#FEFCBF', color: '#744210', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                                        {getHonorTypeBadge(honor.honorType)}
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: 'auto' }}>
                                                        {new Date(honor.date).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            )}
                                            renderDetail={(honor: Honor) => (
                                                <div>
                                                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#2D3748' }}>{honor.honorTitle}</h3>
                                                    <p style={{ fontSize: '1rem', color: '#2D3748', lineHeight: '1.6' }}>
                                                        {honor.description || "No description provided."}
                                                    </p>
                                                </div>
                                            )}
                                        />

                                        {/* TESTS */}
                                        <DataCategorySection
                                            title="Test Scores"
                                            icon="book"
                                            iconColor="#000000ff"
                                            items={detailedData.tests}
                                            searchKeys={['type', 'apTest', 'score']}
                                            groupBy={(item) => getTestTypeLabel(item.type)}
                                            getItemStyle={(test) => {
                                                const color = getTestTypeColor(test.type);
                                                return {
                                                    background: color.bgGradient,
                                                    border: `2px solid ${color.border}`
                                                };
                                            }}
                                            renderCard={(test: Test) => (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                                                    <div>
                                                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#2D3748' }}>{test.apTest || getTestTypeLabel(test.type)}</h4>
                                                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>{test.date}</div>
                                                    </div>
                                                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#437E84' }}>{test.score}</span>
                                                </div>
                                            )}
                                            renderDetail={(test: Test) => (
                                                <div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#718096' }}>Type</span>
                                                            <span style={{ fontWeight: '600' }}>{getTestTypeLabel(test.type)}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#718096' }}>Date Taken</span>
                                                            <span style={{ fontWeight: '600' }}>{test.date}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        />

                                        {/* COLLEGES */}
                                        <DataCategorySection
                                            title="Colleges"
                                            icon="account_balance"
                                            iconColor="#000000ff"
                                            items={detailedData.colleges}
                                            searchKeys={['collegeName', 'notes']}
                                            groupBy={(item) => getApplicationStatusBadge(item.applicationStatus).text || 'Not Applied'}
                                            getItemStyle={(item) => ({ borderLeft: '4px solid #4299E1' })}
                                            renderCard={(college: College) => {
                                                const statusBadge = getApplicationStatusBadge(college.applicationStatus);
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <h4 style={{ margin: 0, fontSize: '1rem', color: '#2D3748' }}>{college.collegeName}</h4>
                                                            <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#437E84' }}>
                                                                {getScoreDisplay(college.collegeScore)}
                                                            </span>
                                                        </div>
                                                        {statusBadge.text && (
                                                            <span style={{
                                                                fontSize: '0.75rem', background: statusBadge.bg, color: statusBadge.color,
                                                                padding: '2px 8px', borderRadius: '4px', width: 'fit-content'
                                                            }}>
                                                                {statusBadge.text}
                                                            </span>
                                                        )}
                                                        {college.toured && (
                                                            <span style={{ fontSize: '0.75rem', background: '#E6F4EA', color: '#137333', padding: '2px 8px', borderRadius: '4px', width: 'fit-content' }}>
                                                                ✓ Toured
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            }}
                                            renderDetail={(college: College) => (
                                                <div>
                                                    <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.5rem' }}>Personal Notes</div>
                                                    <div style={{ fontSize: '0.95rem', color: '#2D3748', lineHeight: '1.6', fontStyle: college.notes ? 'normal' : 'italic' }}>
                                                        {college.notes || "No notes added for this college."}
                                                    </div>
                                                </div>
                                            )}
                                        />

                                        {/* ESSAYS */}
                                        <DataCategorySection
                                            title="Essays"
                                            icon="edit_document"
                                            iconColor="#000000ff"
                                            items={[...detailedData.essays.filter(e => e.status !== 'Idea')].sort((a, b) => {
                                                // Sort emphasized essays first
                                                if (a.isEmphasized && !b.isEmphasized) return -1;
                                                if (!a.isEmphasized && b.isEmphasized) return 1;
                                                return 0;
                                            })}
                                            searchKeys={['title', 'idea', 'promptText']}
                                            groupBy={(item) => item.isEmphasized ? '⭐ Highlighted' : (item.status || 'Draft')}
                                            getItemStyle={(item) => ({
                                                borderLeft: item.isEmphasized ? '4px solid #F59E0B' : '4px solid #ED8936',
                                                background: item.isEmphasized ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' : undefined,
                                                boxShadow: item.isEmphasized ? '0 4px 12px rgba(245, 158, 11, 0.15)' : undefined
                                            })}
                                            onItemClick={(essay: Essay) => setViewingEssay(essay)}
                                            renderCard={(essay: Essay) => (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', height: '100%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <h4 style={{ margin: 0, fontSize: '1rem', color: '#2D3748' }}>{essay.title || 'Untitled Essay'}</h4>
                                                            {essay.isEmphasized && (
                                                                <span style={{
                                                                    fontSize: '11px',
                                                                    background: '#F59E0B',
                                                                    color: 'white',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    fontWeight: '600',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px'
                                                                }}>
                                                                    ⭐ Highlighted
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', background: '#FEEBC8', color: '#744210', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                                        {essay.status || 'Draft'}
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: 'auto', fontStyle: 'italic' }}>
                                                        {essay.promptText ? essay.promptText.substring(0, 60) + (essay.promptText.length > 60 ? '...' : '') : 'No prompt selected'}
                                                    </div>
                                                </div>
                                            )}
                                            renderDetail={(essay: Essay) => (
                                                <div style={{
                                                    background: '#fff',
                                                    border: essay.isEmphasized ? '2px solid #F59E0B' : '1px solid #E2E8F0',
                                                    borderRadius: '8px',
                                                    padding: '2rem',
                                                    boxShadow: essay.isEmphasized ? '0 8px 20px rgba(245, 158, 11, 0.2)' : '0 4px 6px rgba(0, 0, 0, 0.05)',
                                                    fontFamily: "'Georgia', serif",
                                                    color: '#2D3748'
                                                }}>
                                                    {essay.isEmphasized && (
                                                        <div style={{
                                                            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                                                            color: 'white',
                                                            padding: '8px 16px',
                                                            borderRadius: '6px',
                                                            marginBottom: '1.5rem',
                                                            textAlign: 'center',
                                                            fontFamily: 'sans-serif',
                                                            fontSize: '0.875rem',
                                                            fontWeight: '600'
                                                        }}>
                                                            ⭐ This essay was highlighted by the student for your attention
                                                        </div>
                                                    )}
                                                    <h2 style={{
                                                        textAlign: 'center',
                                                        fontSize: '1.5rem',
                                                        fontWeight: 'bold',
                                                        marginBottom: '1.5rem',
                                                        fontFamily: 'sans-serif'
                                                    }}>
                                                        {essay.title}
                                                    </h2>

                                                    {essay.promptText && (
                                                        <div style={{
                                                            marginBottom: '2rem',
                                                            padding: '1rem',
                                                            background: '#F7FAFC',
                                                            borderLeft: '4px solid #CBD5E0',
                                                            fontFamily: 'sans-serif',
                                                            fontSize: '0.9rem',
                                                            color: '#4A5568',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            <strong>Prompt:</strong> {essay.promptText}
                                                        </div>
                                                    )}

                                                    <div style={{
                                                        fontSize: '1.1rem',
                                                        lineHeight: '1.8',
                                                        whiteSpace: 'pre-wrap'
                                                    }}>
                                                        <ReactMarkdown>{essay.idea}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            )}
                                        />

                                    </div>
                                )}

                                {/* Recalculate Button */}
                                {(userData?.role === 'student' || !userData?.role) && (canRecalculate || getTotalUploads() < 5) && (
                                    <button
                                        onClick={recalculateScores}
                                        disabled={!canRecalculate || calculating || getTotalUploads() < 5}
                                        className={styles.recalculateButton}
                                        style={{
                                            opacity: canRecalculate && getTotalUploads() >= 5 ? 1 : 0.6,
                                            cursor: (!canRecalculate || calculating || getTotalUploads() < 5) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {getTotalUploads() < 5
                                            ? `Upload ${5 - getTotalUploads()} more items to unlock your Application Readiness Score!`
                                            : calculating
                                                ? 'Calculating...'
                                                : 'Happy AppApp Day!\nClick Here To Recalculate Score & Update Insights!'}
                                    </button>
                                )}

                                {/* AI Insights */}
                                {(userData?.role === 'student' || !userData?.role) && analyticsData?.insights && (
                                    <div className={styles.insightsContainer}>
                                        <div
                                            className={styles.insightsHeader}
                                            onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                                        >
                                            <h4>Neil's Insights</h4>
                                            <span
                                                className="material-symbols-outlined"
                                                style={{
                                                    transform: isInsightsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.3s ease'
                                                }}
                                            >
                                                expand_more
                                            </span>
                                        </div>
                                        <div className={`${styles.insightsContent} ${isInsightsOpen ? styles.insightsOpen : ''}`}>
                                            <div className={styles.insightsInner}>
                                                {analyticsData.insights.split('\n\n').map((paragraph, index) => (
                                                    <div key={index} className={styles.insightBox}>
                                                        <ReactMarkdown>{paragraph}</ReactMarkdown>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>



                        </>
                    )}


                    {/* SAT Practice Tools Card */}
                    {(userData?.role === 'student' || !userData?.role) && (
                        <div className={styles.applicationCard} style={{ marginTop: '2rem' }}>
                            <h3 className={styles.applicationCardTitle}>SAT Practice Tools</h3>
                            <div className={styles.applicationContent}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '1rem',
                                    width: '100%'
                                }}>
                                    {/* Streak Section */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        padding: '1.5rem',
                                        background: 'linear-gradient(135deg, #E9F5F7 0%, #F7FAFC 100%)',
                                        borderRadius: '12px',
                                        height: '100%'
                                    }}>
                                        <img
                                            src={vocabStats.streak > 0 ? "/assets/streak.png" : "/assets/noStreak.png"}
                                            alt="Streak"
                                            style={{ width: '50px', height: '50px' }}
                                        />
                                        {vocabStats.streak === 0 ? (
                                            <>
                                                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#2d3748', textAlign: 'center', lineHeight: '1.2' }}>
                                                    Practice to extend your streak!
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#718096', textAlign: 'center' }}>
                                                    Keep learning!
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#437E84', textAlign: 'center' }}>
                                                    {vocabStats.streak} Day Streak!
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: '#718096', textAlign: 'center' }}>
                                                    Keep it going!
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Vocabulary */}
                                    <div style={{
                                        padding: '1.5rem',
                                        background: 'white',
                                        border: '2px solid #E2E8F0',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        height: '100%'
                                    }}
                                        onClick={() => handleNavigation('/test-prep/vocabulary')}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#437E84';
                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(67, 126, 132, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#E2E8F0';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📚</div>
                                        <h4 style={{
                                            fontSize: '1.1rem',
                                            fontWeight: '700',
                                            marginBottom: '0.5rem',
                                            color: '#2d3748'
                                        }}>
                                            Vocabulary
                                        </h4>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            color: '#437E84',
                                            fontSize: '0.8rem',
                                            fontWeight: '600'
                                        }}>
                                            Practice Now
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                                        </div>
                                    </div>

                                    {/* Reading Comprehension */}
                                    <div style={{
                                        padding: '1.5rem',
                                        background: 'white',
                                        border: '2px solid #E2E8F0',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        height: '100%'
                                    }}
                                        onClick={() => handleNavigation('/test-prep/reading')}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#437E84';
                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(67, 126, 132, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#E2E8F0';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📖</div>
                                        <h4 style={{
                                            fontSize: '1.1rem',
                                            fontWeight: '700',
                                            marginBottom: '0.5rem',
                                            color: '#2d3748'
                                        }}>
                                            Reading
                                        </h4>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            color: '#437E84',
                                            fontSize: '0.8rem',
                                            fontWeight: '600'
                                        }}>
                                            Practice Now
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                                        </div>
                                    </div>

                                    {/* Master Desmos */}
                                    <div style={{
                                        padding: '1.5rem',
                                        background: 'white',
                                        border: '2px solid #E2E8F0',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        height: '100%'
                                    }}
                                        onClick={() => handleNavigation('/test-prep/math')}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#437E84';
                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(67, 126, 132, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#E2E8F0';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧮</div>
                                        <h4 style={{
                                            fontSize: '1.1rem',
                                            fontWeight: '700',
                                            marginBottom: '0.5rem',
                                            color: '#2d3748'
                                        }}>
                                            Master Desmos
                                        </h4>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            color: '#437E84',
                                            fontSize: '0.8rem',
                                            fontWeight: '600'
                                        }}>
                                            Practice Now
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Upcoming Schedule Card */}
                    {(userData?.role === 'student' || !userData?.role) && (
                        <div className={styles.applicationCard} style={{ marginTop: '2rem' }}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.applicationCardTitle}>Upcoming Schedule</h3>
                                <button
                                    onClick={() => handleNavigation('/calendar')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#437E84',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    View Full Calendar
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                                </button>
                            </div>

                            <div className={styles.applicationContent} style={{ marginTop: '1rem' }}>
                                {upcomingEvents.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <p className={styles.emptyText}>No upcoming events! Time to relax or get ahead?</p>
                                        <button
                                            onClick={() => handleNavigation('/calendar')}
                                            style={{
                                                marginTop: '1rem',
                                                padding: '0.5rem 1rem',
                                                backgroundColor: '#F7FAFC',
                                                border: '1px solid #E2E8F0',
                                                borderRadius: '8px',
                                                color: '#4A5568',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                fontWeight: '500'
                                            }}
                                        >
                                            Add Event
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '1rem',
                                        width: '100%'
                                    }}>
                                        {upcomingEvents.map(event => {
                                            const typeColors: Record<string, string> = {
                                                assignment: '#3b82f6',
                                                study: '#8b5cf6',
                                                test: '#ef4444',
                                                'application-due': '#f59e0b',
                                                'application-response': '#10b981',
                                                other: '#6b7280'
                                            };
                                            const month = event.date.toLocaleString('default', { month: 'short' });
                                            const day = event.date.getDate();
                                            const time = event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            const displayTime = event.period ? `Period ${event.period}` : time;

                                            return (
                                                <div key={event.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '1rem',
                                                    backgroundColor: '#FFFFFF',
                                                    border: '1px solid #E2E8F0',
                                                    borderRadius: '12px',
                                                    transition: 'all 0.2s',
                                                    height: '100%'
                                                }}>
                                                    {/* Date Box */}
                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        padding: '0.5rem',
                                                        backgroundColor: '#F7FAFC',
                                                        borderRadius: '8px',
                                                        minWidth: '60px',
                                                        marginRight: '1rem'
                                                    }}>
                                                        <span style={{ fontSize: '0.8rem', color: '#718096', fontWeight: '600', textTransform: 'uppercase' }}>{month}</span>
                                                        <span style={{ fontSize: '1.25rem', color: '#2D3748', fontWeight: '700' }}>{day}</span>
                                                    </div>

                                                    {/* Event Info */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <h4 style={{
                                                            fontSize: '1rem',
                                                            fontWeight: '600',
                                                            color: '#2D3748',
                                                            marginBottom: '0.25rem',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }} title={event.title}>
                                                            {event.title}
                                                        </h4>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#718096' }}>
                                                            {/* Type Dot */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: typeColors[event.type] || '#CBD5E0' }}></div>
                                                                {/* Optional: hide text on small screens if needed, but grid should handle it */}
                                                            </div>
                                                            {/* Time/Period */}
                                                            <span style={{ fontWeight: event.period ? '600' : '400', color: event.period ? '#437E84' : '#718096' }}>
                                                                {displayTime}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Access Management Section (Student Only) */}
                    {(userData?.role === 'student' || !userData?.role) && (
                        <div className={styles.applicationCard} style={{ marginTop: '2rem' }}>
                            <h3 className={styles.applicationCardTitle}>Access Management</h3>
                            <div className={styles.applicationContent} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                                {/* Generate Code Section */}
                                <div style={{ padding: '1rem', background: '#F7FAFC', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', color: '#2D3748' }}>Connect a Parent or Counselor</h4>
                                    <p style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem' }}>
                                        Generate a secure code to link your information to their account. Codes can be used once and expire every 24 hours.
                                    </p>
                                    {generatedCode ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{
                                                fontSize: '2rem', fontWeight: 'bold', letterSpacing: '4px',
                                                color: '#437E84', background: 'white', padding: '1rem 2rem',
                                                borderRadius: '8px', border: '2px dashed #437E84'
                                            }}>
                                                {generatedCode.code}
                                            </div>
                                            <p style={{ fontSize: '0.8rem', color: '#E53E3E' }}>
                                                Expires: {new Date(generatedCode.expiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </p>
                                            <button
                                                onClick={() => setGeneratedCode(null)}
                                                style={{ fontSize: '0.8rem', color: '#718096', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleGenerateCode}
                                            disabled={generatingCode}
                                            style={{
                                                background: '#437E84', color: 'white', border: 'none', padding: '0.75rem 1.5rem',
                                                borderRadius: '6px', fontWeight: '600', cursor: generatingCode ? 'not-allowed' : 'pointer',
                                                opacity: generatingCode ? 0.7 : 1
                                            }}
                                        >
                                            {generatingCode ? 'Generating...' : 'Generate New Share Code'}
                                        </button>
                                    )}
                                </div>

                                {/* Pending Requests */}
                                {pendingRequests.length > 0 && (
                                    <div>
                                        <h4 style={{ margin: '0 0 1rem 0', color: '#2D3748', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            Pending Requests
                                            <span style={{ background: '#E53E3E', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                                                {pendingRequests.length}
                                            </span>
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {pendingRequests.map(req => (
                                                <div key={req.id} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '1rem', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px'
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#2D3748', marginRight: 25 }}>{req.requestorEmail}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#718096' }}>requested access.</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => handleRespondToRequest(req.id, 'accept')}
                                                            style={{ background: '#48BB78', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() => handleRespondToRequest(req.id, 'deny')}
                                                            style={{ background: '#F56565', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                                                        >
                                                            Deny
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Authorized Viewers */}
                                <div>
                                    <h4 style={{ margin: '0 0 1rem 0', color: '#2D3748' }}>Authorized Viewers</h4>
                                    <p style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '1rem' }}>
                                        These users are able to view your saved information.
                                    </p>
                                    {authorizedViewers.length === 0 ? (
                                        <p style={{ color: '#718096', fontStyle: 'italic' }}>No one has access to your data.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {authorizedViewers.map(viewer => (
                                                <div key={viewer.id} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '1rem', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px'
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#2D3748' }}>{viewer.viewerEmail}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                                                            Since {viewer.grantedAt?.toDate ? new Date(viewer.grantedAt.toDate()).toLocaleDateString() : 'Unknown'}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRevokeAccess(viewer.id)}
                                                        style={{
                                                            background: 'none', border: '1px solid #CBD5E0', color: '#718096',
                                                            padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', marginLeft: '15px'
                                                        }}
                                                    >
                                                        Revoke
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Dancing Neil */}
                    <div className={styles.neilContainer}>
                        <img src="/assets/dancing.gif" alt="Neil dancing" width={100} height={100} />
                    </div>
                </main>

                {/* Right Sidebar - Hidden for Counselors AND Parents */}
                {
                    (userData?.role !== 'counselor' && userData?.role !== 'parent') && (
                        <aside className={styles.rightSidebar}>
                            <div className={styles.toolsPanel}>
                                <h3 className={styles.toolsPanelTitle}>Neil's Tools</h3>
                                <div className={styles.toolsList}>
                                    <button className={styles.toolButton} onClick={() => router.push('/college-search')}>
                                        <div className={styles.toolIconWrapper}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#437E84' }}>search</span>
                                        </div>
                                        <div className={styles.toolButtonText}>
                                            <div className={styles.toolButtonTitle}>College Search</div>
                                            <div className={styles.toolButtonDesc}>Find your fit</div>
                                        </div>
                                    </button>
                                    <button className={styles.toolButton} onClick={() => router.push('/resume')}>
                                        <div className={styles.toolIconWrapper}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#437E84' }}>download</span>
                                        </div>
                                        <div className={styles.toolButtonText}>
                                            <div className={styles.toolButtonTitle}>Download Resume</div>
                                            <div className={styles.toolButtonDesc}>Export profile</div>
                                        </div>
                                    </button>
                                    <button className={styles.toolButton} onClick={() => router.push('/test-prep')}>
                                        <div className={styles.toolIconWrapper}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#437E84' }}>school</span>
                                        </div>
                                        <div className={styles.toolButtonText}>
                                            <div className={styles.toolButtonTitle}>Test Prep</div>
                                            <div className={styles.toolButtonDesc}>SAT practice</div>
                                        </div>
                                    </button>
                                    <button className={styles.toolButton} onClick={() => router.push('/essays?view=Brainstorm')}>
                                        <div className={styles.toolIconWrapper}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#437E84' }}>lightbulb</span>
                                        </div>
                                        <div className={styles.toolButtonText}>
                                            <div className={styles.toolButtonTitle}>Essay Ideas</div>
                                            <div className={styles.toolButtonDesc}>Generate topics</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </aside>
                    )
                }
            </div >

            {/* Essay Document Reader Modal */}
            {viewingEssay && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div style={{
                        background: '#F3F4F6',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '16px 24px',
                            background: 'white',
                            borderBottom: '1px solid #E5E7EB',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <button
                                    onClick={() => setViewingEssay(null)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: '#6B7280',
                                        padding: '8px',
                                        borderRadius: '8px',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>
                                <div>
                                    <h2 style={{
                                        margin: 0,
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: '#1F2937'
                                    }}>
                                        {viewingEssay.title || 'Untitled Essay'}
                                    </h2>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                        <span style={{
                                            fontSize: '12px',
                                            background: '#FEEBC8',
                                            color: '#744210',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontWeight: '500'
                                        }}>
                                            {viewingEssay.status || 'Draft'}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                                            Read-only view
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingEssay(null)}
                                style={{
                                    background: '#F3F4F6',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: '#6B7280'
                                }}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Document Content */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '32px'
                        }}>
                            <div style={{
                                background: 'white',
                                maxWidth: '750px',
                                margin: '0 auto',
                                minHeight: '800px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                padding: '60px 80px'
                            }}>
                                {/* Essay Title */}
                                <h1 style={{
                                    textAlign: 'center',
                                    fontSize: '28px',
                                    fontWeight: '700',
                                    color: '#1F2937',
                                    marginBottom: '32px',
                                    fontFamily: "'Georgia', 'Times New Roman', serif"
                                }}>
                                    {viewingEssay.title || 'Untitled Essay'}
                                </h1>

                                {/* Prompt Section */}
                                {(viewingEssay.promptText || viewingEssay.commonAppPrompt) && (
                                    <div style={{
                                        marginBottom: '40px',
                                        padding: '20px 24px',
                                        background: 'linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 100%)',
                                        borderLeft: `4px solid ${viewingEssay.isCommonApp ? '#ED8936' : '#437E84'}`,
                                        borderRadius: '0 8px 8px 0'
                                    }}>
                                        <div style={{
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: viewingEssay.isCommonApp ? '#C05621' : '#437E84',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '8px'
                                        }}>
                                            {viewingEssay.isCommonApp ? 'Common App Prompt' : 'Essay Prompt'}
                                        </div>
                                        <div style={{
                                            fontSize: '15px',
                                            color: '#4A5568',
                                            lineHeight: '1.6',
                                            fontStyle: 'italic'
                                        }}>
                                            {viewingEssay.promptText || viewingEssay.commonAppPrompt}
                                        </div>
                                    </div>
                                )}

                                {/* Essay Content */}
                                <div style={{
                                    fontSize: '17px',
                                    lineHeight: '1.9',
                                    color: '#2D3748',
                                    fontFamily: "'Georgia', 'Times New Roman', serif"
                                }}>
                                    {viewingEssay.content ? (
                                        <div dangerouslySetInnerHTML={{ __html: viewingEssay.content }} />
                                    ) : viewingEssay.idea ? (
                                        <ReactMarkdown>{viewingEssay.idea}</ReactMarkdown>
                                    ) : (
                                        <p style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No essay content yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Translucent Loading Screen */}
            {
                (loading || navigating) && (
                    <div className={styles.loadingContainer}>
                        <div className={styles.loadingImage}>
                            <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                        </div>
                        <div className={styles.loading}>Loading dashboard...</div>
                    </div>
                )
            }
        </div >
    );
}

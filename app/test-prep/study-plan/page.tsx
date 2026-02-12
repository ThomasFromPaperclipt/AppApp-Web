'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, Timestamp, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Calendar, { CalendarEvent } from '@/components/Calendar';
import { generateStudyPlan, StudyPlanInput } from '@/lib/study-plan';
import styles from './study-plan.module.css';
import dashboardStyles from '../../dashboard/dashboard.module.css';
import Sidebar from '@/components/Sidebar';

export default function StudyPlanPage() {
    const [user, setUser] = useState<User | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasPlan, setHasPlan] = useState(false);
    const [planMetadata, setPlanMetadata] = useState<{
        testDate: Date;
        dailyMinutes: number;
        studyDays: number[];
        focusAreas: string[];
    } | null>(null);

    // Form state
    const [testDate, setTestDate] = useState('');
    const [dailyMinutes, setDailyMinutes] = useState(30);
    const [studyDays, setStudyDays] = useState<number[]>([1, 3, 5]); // Default Mon, Wed, Fri
    const [focusAreas, setFocusAreas] = useState<string[]>(['Math', 'Reading', 'Writing', 'Vocabulary']);

    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/');
                return;
            }

            setUser(user);

            try {
                // Check if user has study plan events
                const eventsRef = collection(db, 'users', user.uid, 'events');
                const q = query(eventsRef, where('type', '==', 'study'));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    setHasPlan(true);
                    const fetchedEvents: CalendarEvent[] = [];
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        fetchedEvents.push({
                            id: doc.id,
                            title: data.title,
                            date: data.date.toDate(),
                            type: data.type,
                            description: data.description,
                            completed: data.completed
                        });
                    });
                    setEvents(fetchedEvents);

                    // Fetch metadata
                    const metadataRef = doc(db, 'users', user.uid, 'study_plan', 'metadata');
                    const metadataSnap = await getDoc(metadataRef);
                    if (metadataSnap.exists()) {
                        const data = metadataSnap.data();
                        setPlanMetadata({
                            testDate: data.testDate.toDate(),
                            dailyMinutes: data.dailyMinutes || 30,
                            studyDays: data.studyDays || [1, 3, 5],
                            focusAreas: data.focusAreas
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching study plan:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleGeneratePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !testDate) return;

        setLoading(true);

        try {
            const input: StudyPlanInput = {
                testDate: new Date(testDate),
                dailyMinutes,
                studyDays,
                focusAreas
            };

            const sessions = generateStudyPlan(input);

            // Save to Firestore
            const batch = writeBatch(db);
            const eventsRef = collection(db, 'users', user.uid, 'events');

            // Delete existing study events first (optional, but cleaner for regeneration)
            // For now, we'll just add new ones. In a real app, we might want to clear old future events.
            // A simple way is to delete all future study events.
            // Let's assume the user wants to overwrite.
            const q = query(eventsRef, where('type', '==', 'study'));
            const existingDocs = await getDocs(q);
            existingDocs.forEach(doc => {
                batch.delete(doc.ref);
            });

            sessions.forEach(session => {
                const newDocRef = doc(eventsRef); // Create new doc ref with auto ID
                batch.set(newDocRef, {
                    ...session,
                    date: Timestamp.fromDate(session.date)
                });
            });

            await batch.commit();

            // Save metadata
            const metadataRef = doc(db, 'users', user.uid, 'study_plan', 'metadata');
            await setDoc(metadataRef, {
                testDate: Timestamp.fromDate(input.testDate),
                dailyMinutes: input.dailyMinutes,
                studyDays: input.studyDays,
                focusAreas: input.focusAreas
            });

            // Update local state
            setHasPlan(true);
            // Reload events (or just push to state, but reloading ensures consistency)
            window.location.reload();

        } catch (error) {
            console.error('Error generating plan:', error);
            alert('Failed to generate plan. Please try again.');
            setLoading(false);
        }
    };

    const handleFocusAreaChange = (area: string) => {
        setFocusAreas(prev =>
            prev.includes(area)
                ? prev.filter(a => a !== area)
                : [...prev, area]
        );
    };

    const handleDayToggle = (dayIndex: number) => {
        setStudyDays(prev =>
            prev.includes(dayIndex)
                ? prev.filter(d => d !== dayIndex)
                : [...prev, dayIndex]
        );
    };

    const handleEditPlan = () => {
        if (planMetadata) {
            setTestDate(planMetadata.testDate.toISOString().split('T')[0]);
            setDailyMinutes(planMetadata.dailyMinutes);
            setStudyDays(planMetadata.studyDays);
            setFocusAreas(planMetadata.focusAreas);
            setHasPlan(false); // Show form
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingImage}>
                    <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                </div>
                <div className={styles.loading}>Loading study plan...</div>
            </div>
        );
    }

    return (
        <div className={dashboardStyles.container}>
            <nav className={dashboardStyles.topNav}>
                <div className={dashboardStyles.navContent}>
                    <img src="/assets/elongatedNeil.png" alt="AppApp" className={dashboardStyles.logoImage} />
                </div>
            </nav>

            <div className={dashboardStyles.mainLayoutTwoCol}>
                <Sidebar
                    onNavigate={(path) => router.push(path)}
                    onSignOut={() => router.push('/')}
                    currentPath="/test-prep/study-plan"
                />

                <main className={dashboardStyles.centerContent}>
                    <div className={styles.header}>
                        <div className={styles.headerContent}>
                            <h1 className={styles.title}>Personalized Study Plan</h1>
                            <p className={styles.subtitle}>
                                {hasPlan
                                    ? "Here is your customized study schedule."
                                    : "Let's create a study plan tailored to your goals."}
                            </p>
                        </div>
                        {hasPlan && (
                            <div className={styles.summaryBox}>
                                <div className={styles.summaryTitle}>Plan Overview</div>
                                <div className={styles.summaryContent}>
                                    <div className={styles.summaryItem}>
                                        <span className={`material-symbols-outlined ${styles.summaryIcon}`}>event</span>
                                        <span className={styles.summaryLabel}>Test Date:</span>
                                        <span>{planMetadata?.testDate ? planMetadata.testDate.toLocaleDateString() : 'Not set'}</span>
                                    </div>
                                    <div className={styles.summaryItem}>
                                        <span className={`material-symbols-outlined ${styles.summaryIcon}`}>schedule</span>
                                        <span className={styles.summaryLabel}>Commitment:</span>
                                        <span>
                                            {planMetadata
                                                ? `${planMetadata.studyDays.length} days/week, ${planMetadata.dailyMinutes} mins`
                                                : 'Custom schedule'}
                                        </span>
                                    </div>
                                    <div className={styles.summaryItem}>
                                        <span className={`material-symbols-outlined ${styles.summaryIcon}`}>target</span>
                                        <span className={styles.summaryLabel}>Focus:</span>
                                        <span>{planMetadata?.focusAreas ? `${planMetadata.focusAreas.length} areas` : 'All areas'}</span>
                                    </div>
                                </div>
                                <button className={styles.editButton} onClick={handleEditPlan}>
                                    Edit Plan
                                </button>
                            </div>
                        )}
                    </div>

                    {!hasPlan ? (
                        <div className={styles.formContainer}>
                            <form onSubmit={handleGeneratePlan}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>When is your test date?</label>
                                    <input
                                        type="date"
                                        className={styles.input}
                                        value={testDate}
                                        onChange={(e) => setTestDate(e.target.value)}
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Which days can you study?</label>
                                    <div className={styles.daySelector}>
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                className={`${styles.dayButton} ${studyDays.includes(index) ? styles.dayButtonActive : ''}`}
                                                onClick={() => handleDayToggle(index)}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>How many minutes per day?</label>
                                    <input
                                        type="number"
                                        className={styles.input}
                                        value={dailyMinutes}
                                        onChange={(e) => setDailyMinutes(parseInt(e.target.value))}
                                        min={15}
                                        max={180}
                                        step={15}
                                        required
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Focus Areas</label>
                                    <div className={styles.checkboxGroup}>
                                        {['Math', 'Reading', 'Writing', 'Vocabulary'].map(area => (
                                            <label key={area} className={styles.checkboxLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={focusAreas.includes(area)}
                                                    onChange={() => handleFocusAreaChange(area)}
                                                />
                                                {area}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" className={styles.button}>Generate Plan</button>
                            </form>
                        </div>
                    ) : (
                        <div className={styles.calendarWrapper}>
                            <Calendar events={events} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

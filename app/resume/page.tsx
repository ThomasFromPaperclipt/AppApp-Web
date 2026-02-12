'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from './resume.module.css';

interface UserData {
    firstName: string;
    lastName: string;
    email: string;
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

export default function Resume() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<UserData | null>(null);

    // Data States
    const [activities, setActivities] = useState<Activity[]>([]);
    const [honors, setHonors] = useState<Honor[]>([]);
    const [tests, setTests] = useState<Test[]>([]);

    // Selection States
    const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
    const [selectedHonors, setSelectedHonors] = useState<string[]>([]);
    const [selectedTests, setSelectedTests] = useState<string[]>([]);
    const [additionalNotes, setAdditionalNotes] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/');
                return;
            }

            try {
                // Fetch User Profile
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserData(userDoc.data() as UserData);
                }

                // Fetch Subcollections
                const fetchCollection = async (collectionName: string) => {
                    const q = query(collection(db, 'users', user.uid, collectionName));
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

                // Initialize Selections (Select All by Default)
                setSelectedActivities(activitiesData.map(item => item.id));
                setSelectedHonors(honorsData.map(item => item.id));
                setSelectedTests(testsData.map(item => item.id));

            } catch (error) {
                console.error('Error fetching resume data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const toggleSelection = (id: string, type: 'activity' | 'honor' | 'test') => {
        const setter = {
            activity: setSelectedActivities,
            honor: setSelectedHonors,
            test: setSelectedTests
        }[type];

        setter(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const moveItem = (index: number, direction: -1 | 1, type: 'activity' | 'honor') => {
        if (type === 'activity') {
            const newItems = [...activities];
            if (index + direction < 0 || index + direction >= newItems.length) return;

            const temp = newItems[index];
            newItems[index] = newItems[index + direction];
            newItems[index + direction] = temp;

            setActivities(newItems);
        } else {
            const newItems = [...honors];
            if (index + direction < 0 || index + direction >= newItems.length) return;

            const temp = newItems[index];
            newItems[index] = newItems[index + direction];
            newItems[index + direction] = temp;

            setHonors(newItems);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Helper Functions for Rendering
    const getFilteredItems = <T extends { id: string }>(items: T[], selectedIds: string[]) => {
        // Return items in their current order, filtered by selection
        return items.filter(item => selectedIds.includes(item.id));
    };

    const groupTests = (tests: Test[]) => {
        const categories = ["AP", "SAT", "PSAT", "ACT"];
        return categories.map(category => ({
            category,
            tests: tests.filter(t => t.type === category)
        })).filter(g => g.tests.length > 0);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
                <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                <div style={{ color: '#437E84', fontWeight: '600' }}>Preparing your resume builder...</div>
            </div>
        );
    }

    const filteredActivities = getFilteredItems(activities, selectedActivities);
    const filteredHonors = getFilteredItems(honors, selectedHonors);
    const filteredTests = getFilteredItems(tests, selectedTests);
    const groupedTests = groupTests(filteredTests);

    return (
        <div className={styles.container}>
            {/* Sidebar - Hidden on Print */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <button className={styles.backButton} onClick={() => router.back()}>
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className={styles.sidebarTitle}>Customize Resume</h1>
                </div>

                <div className={styles.scrollContent}>
                    {/* Activities */}
                    {activities.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle} style={{ marginBottom: '1rem' }}>Extracurricular Activities</div>
                            {activities.map((activity, index) => (
                                <div key={activity.id} className={styles.itemRow}>
                                    <div className={styles.reorderControls}>
                                        <button
                                            className={styles.reorderButton}
                                            onClick={(e) => { e.stopPropagation(); moveItem(index, -1, 'activity'); }}
                                            disabled={index === 0}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard_arrow_up</span>
                                        </button>
                                        <button
                                            className={styles.reorderButton}
                                            onClick={(e) => { e.stopPropagation(); moveItem(index, 1, 'activity'); }}
                                            disabled={index === activities.length - 1}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard_arrow_down</span>
                                        </button>
                                    </div>
                                    <div
                                        className={`${styles.checkbox} ${selectedActivities.includes(activity.id) ? styles.checkboxSelected : ''}`}
                                        onClick={() => toggleSelection(activity.id, 'activity')}
                                    >
                                        {selectedActivities.includes(activity.id) && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>}
                                    </div>
                                    <div className={styles.itemInfo} onClick={() => toggleSelection(activity.id, 'activity')}>
                                        <div className={styles.itemTitle}>{activity.organizationName}</div>
                                        <div className={styles.itemSubtitle}>{activity.position}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Honors */}
                    {honors.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle} style={{ marginBottom: '1rem' }}>Honors & Awards</div>
                            {honors.map((honor, index) => (
                                <div key={honor.id} className={styles.itemRow}>
                                    <div className={styles.reorderControls}>
                                        <button
                                            className={styles.reorderButton}
                                            onClick={(e) => { e.stopPropagation(); moveItem(index, -1, 'honor'); }}
                                            disabled={index === 0}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard_arrow_up</span>
                                        </button>
                                        <button
                                            className={styles.reorderButton}
                                            onClick={(e) => { e.stopPropagation(); moveItem(index, 1, 'honor'); }}
                                            disabled={index === honors.length - 1}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard_arrow_down</span>
                                        </button>
                                    </div>
                                    <div
                                        className={`${styles.checkbox} ${selectedHonors.includes(honor.id) ? styles.checkboxSelected : ''}`}
                                        onClick={() => toggleSelection(honor.id, 'honor')}
                                    >
                                        {selectedHonors.includes(honor.id) && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>}
                                    </div>
                                    <div className={styles.itemInfo} onClick={() => toggleSelection(honor.id, 'honor')}>
                                        <div className={styles.itemTitle}>{honor.honorTitle}</div>
                                        <div className={styles.itemSubtitle}>{honor.honorType}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tests */}
                    {tests.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle} style={{ marginBottom: '1rem' }}>Test Scores</div>
                            {tests.map(test => (
                                <div key={test.id} className={styles.itemRow} onClick={() => toggleSelection(test.id, 'test')}>
                                    <div className={`${styles.checkbox} ${selectedTests.includes(test.id) ? styles.checkboxSelected : ''}`}>
                                        {selectedTests.includes(test.id) && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>}
                                    </div>
                                    <div className={styles.itemInfo}>
                                        <div className={styles.itemTitle}>{test.type === 'AP' ? test.apTest : test.type}</div>
                                        <div className={styles.itemSubtitle}>Score: {test.score}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Notes */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Notes for Recommender</div>
                        <textarea
                            className={styles.notesInput}
                            placeholder="Add specific points you'd like highlighted - and make sure to say thank you!"
                            value={additionalNotes}
                            onChange={(e) => setAdditionalNotes(e.target.value)}
                        />
                    </div>
                </div>

                <div className={styles.sidebarFooter}>
                    <button className={styles.printButton} onClick={handlePrint}>
                        <span className="material-symbols-outlined">print</span>
                        Download PDF / Print
                    </button>
                </div>
            </aside>

            {/* Preview Area - What gets printed */}
            <main className={styles.previewArea}>
                <div className={styles.previewLabel}>
                    Preview
                </div>

                <div className={styles.resumePage}>
                    <div className={styles.resumeHeader}>
                        <h1 className={styles.resumeName}>{userData?.firstName} {userData?.lastName}</h1>
                        <p className={styles.resumeSubtitle}>Academic & Extracurricular Profile</p>
                    </div>

                    {/* Notes (if any) */}
                    {additionalNotes && (
                        <div className={styles.resumeSection}>
                            <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid #64748b' }}>
                                <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '14px', color: '#334155' }}>Notes for Letter of Recommendation</div>
                                <div style={{ whiteSpace: 'pre-wrap', fontSize: '11px', color: '#334155' }}>{additionalNotes}</div>
                            </div>
                        </div>
                    )}

                    {/* Activities */}
                    {filteredActivities.length > 0 && (
                        <div className={styles.resumeSection}>
                            <h2 className={styles.resumeSectionTitle}>Extracurricular Activities & Leadership</h2>
                            {filteredActivities.map(activity => (
                                <div key={activity.id} className={styles.resumeItem}>
                                    <div className={styles.resumeItemHeader}>
                                        <div className={styles.resumeItemName}>{activity.organizationName}</div>
                                        <div className={styles.resumeItemPosition}>{activity.position}</div>
                                    </div>
                                    <div className={styles.resumeItemMeta}>
                                        {activity.participationTiming} • {activity.hoursPerWeek} hrs/wk, {activity.weeksPerYear} wks/yr • Grades {activity.gradeLevels.join(', ')}
                                    </div>
                                    <div className={styles.resumeItemDetails}>{activity.description}</div>
                                    {activity.participateInCollege && (
                                        <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#64748b', marginTop: '0.25rem' }}>
                                            {activity.participateInCollege ? 'Plans to continue in college' : ''}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Honors */}
                    {filteredHonors.length > 0 && (
                        <div className={styles.resumeSection}>
                            <h2 className={styles.resumeSectionTitle}>Honors & Awards</h2>
                            {filteredHonors.map(honor => (
                                <div key={honor.id} className={styles.resumeItem} style={{ borderLeftColor: '#94a3b8' }}>
                                    <div className={styles.resumeItemHeader}>
                                        <div className={styles.resumeItemName}>{honor.honorTitle}</div>
                                        <div style={{ fontSize: '10px', background: '#64748b', color: 'white', padding: '1px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>{honor.honorType}</div>
                                    </div>
                                    <div className={styles.resumeItemMeta}>Awarded: {honor.date}</div>
                                    <div className={styles.resumeItemDetails}>{honor.description}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Test Scores */}
                    {groupedTests.length > 0 && (
                        <div className={styles.resumeSection}>
                            <h2 className={styles.resumeSectionTitle}>Standardized Test Scores</h2>
                            {groupedTests.map(group => (
                                <div key={group.category} style={{ marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '0.5rem', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block' }}>{group.category}</div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {group.tests.map(test => (
                                            <div key={test.id} style={{ border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '4px', minWidth: '100px', textAlign: 'center' }}>
                                                <div style={{ fontWeight: '600', fontSize: '11px', color: '#1e293b' }}>{test.type === 'AP' ? test.apTest : test.type}</div>
                                                <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>{test.score}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '11px', color: '#5e6773ff' }}>
                        Generated with AppApp • No-stress College Prep • goappapp.com
                    </div>
                </div>

                {/* Fixed Footer for Print - Neil on every page */}
                <div className={styles.printFooter}>
                    <img
                        src="/assets/peekingIn.png"
                        alt="AppApp Mascot"
                        style={{ width: '32px', height: 'auto', opacity: 0.8 }}
                    />
                </div>
            </main>
        </div>
    );
}

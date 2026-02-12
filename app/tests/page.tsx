'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, deleteDoc, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../dashboard/dashboard.module.css';
import Sidebar from '@/components/Sidebar';

interface UserData {
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
    role?: 'student' | 'parent' | 'counselor';
}

interface Counts {
    activities: number;
    honors: number;
    tests: number;
    essays: number;
    colleges: number;
}

interface Test {
    id: string;
    type: string;
    apTest?: string;
    score: string | number;
    date: string;
}

export default function Tests() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });
    const [tests, setTests] = useState<Test[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTests, setExpandedTests] = useState<{ [key: string]: boolean }>({});
    const [showModal, setShowModal] = useState(false);
    const [editingTest, setEditingTest] = useState<Test | null>(null);
    const [formData, setFormData] = useState({
        type: 'SAT',
        apTest: '',
        score: '',
        date: '',
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

                // Fetch tests
                const testsSnapshot = await getDocs(collection(db, 'users', user.uid, 'tests'));
                const testsData = testsSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                } as Test));
                setTests(testsData);
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

    const toggleTestExpansion = (testId: string) => {
        setExpandedTests((prev) => ({
            ...prev,
            [testId]: !prev[testId],
        }));
    };

    const handleDeleteTest = async (testId: string) => {
        if (!user) return;

        if (window.confirm('Are you sure you want to delete this test score?')) {
            try {
                await deleteDoc(doc(db, 'users', user.uid, 'tests', testId));
                setTests((prev) => prev.filter((test) => test.id !== testId));
                setCounts((prev) => ({ ...prev, tests: prev.tests - 1 }));
            } catch (error) {
                console.error('Error deleting test:', error);
                alert('Failed to delete test score');
            }
        }
    };

    const handleAddTest = () => {
        setEditingTest(null);
        setFormData({
            type: 'SAT',
            apTest: '',
            score: '',
            date: '',
        });
        setShowModal(true);
    };

    const handleEditTest = (test: Test) => {
        setEditingTest(test);
        setFormData({
            type: test.type,
            apTest: test.apTest || '',
            score: String(test.score),
            date: test.date,
        });
        setShowModal(true);
    };

    const handleSaveTest = async () => {
        if (!user) return;

        if (!formData.score || !formData.date) {
            alert('Please fill in all required fields');
            return;
        }

        if (formData.type === 'AP' && !formData.apTest) {
            alert('Please specify the AP test name');
            return;
        }

        try {
            const testData = {
                type: formData.type,
                ...(formData.type === 'AP' && { apTest: formData.apTest }),
                score: formData.score,
                date: formData.date,
            };

            if (editingTest) {
                // Update existing test
                await updateDoc(doc(db, 'users', user.uid, 'tests', editingTest.id), testData);
                setTests((prev) =>
                    prev.map((test) =>
                        test.id === editingTest.id ? { ...test, ...testData } : test
                    )
                );
            } else {
                // Add new test
                const docRef = await addDoc(collection(db, 'users', user.uid, 'tests'), testData);
                setTests((prev) => [...prev, { id: docRef.id, ...testData }]);
                setCounts((prev) => ({ ...prev, tests: prev.tests + 1 }));
            }

            setShowModal(false);
        } catch (error) {
            console.error('Error saving test:', error);
            alert('Failed to save test score');
        }
    };

    // Group tests by type
    const groupTestsByType = (tests: Test[]) => {
        return tests.reduce((groups: { [key: string]: Test[] }, test) => {
            const testType = test.type;
            if (!groups[testType]) {
                groups[testType] = [];
            }
            groups[testType].push(test);
            return groups;
        }, {});
    };

    // Get color scheme for test type (more muted like activities page)
    const getTestTypeColor = (type: string) => {
        const colors: { [key: string]: { border: string; bg: string; bgGradient: string } } = {
            'SAT': {
                border: '#BFDBFE',
                bg: '#F8FAFC',
                bgGradient: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)',
            },
            'ACT': {
                border: '#DDD6FE',
                bg: '#F8FAFC',
                bgGradient: 'linear-gradient(135deg, #F5F3FF 0%, #F8FAFC 100%)',
            },
            'AP': {
                border: '#f7a8a8ff',
                bg: '#ffe0e0ff',
                bgGradient: 'linear-gradient(135deg, #ffebebff 0%, #fcf8f8ff 100%)',
            },
            'PSAT 8/9': {
                border: '#A7F3D0',
                bg: '#F8FAFC',
                bgGradient: 'linear-gradient(135deg, #F0FDF4 0%, #F8FAFC 100%)',
            },
            'PSAT/NMSQT': {
                border: '#A5F3FC',
                bg: '#F8FAFC',
                bgGradient: 'linear-gradient(135deg, #ECFEFF 0%, #F8FAFC 100%)',
            },
        };
        return colors[type] || {
            border: '#E5E7EB',
            bg: '#F8FAFC',
            bgGradient: 'linear-gradient(135deg, #F9FAFB 0%, #F8FAFC 100%)',
        };
    };

    const getTestTypeLabel = (type: string) => {
        const labels: { [key: string]: string } = {
            'SAT': 'SAT 📝',
            'ACT': 'ACT 📚',
            'AP': 'AP Exams 🎓',
            'PSAT 8/9': 'PSAT 8/9 📖',
            'PSAT/NMSQT': 'PSAT/NMSQT 📊',
        };
        return labels[type] || type;
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
                    userRole={userData?.role}
                    counts={counts}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/tests"
                />

                <main className={styles.centerContent}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h1 className={styles.pageTitle}>Test Scores</h1>
                        <button
                            onClick={handleAddTest}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 20px',
                                background: '#437E84',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#356670';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#437E84';
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                            Add Test Score
                        </button>
                    </div>

                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingImage}>
                                <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                            </div>
                            <div className={styles.loading}>Loading test scores...</div>
                        </div>
                    ) : tests.length === 0 ? (
                        <div className={styles.emptyStateContainer}>
                            <img src="/assets/hmm.png" alt="No tests" className={styles.emptyStateImage} />
                            <h2 className={styles.emptyStateTitle}>No test scores yet</h2>
                            <p className={styles.emptyStateText}>
                                You haven't added any test scores yet. Add your SAT, ACT, AP, and other standardized test scores to track your progress.
                            </p>
                        </div>
                    ) : (
                        <>
                            {Object.entries(groupTestsByType(tests))
                                .sort(([typeA], [typeB]) => {
                                    // Define the order: SAT, ACT, AP, PSAT/NMSQT, PSAT 8/9
                                    const order = ['SAT', 'ACT', 'AP', 'PSAT/NMSQT', 'PSAT 8/9'];
                                    const indexA = order.indexOf(typeA);
                                    const indexB = order.indexOf(typeB);
                                    // If both are in the order array, sort by their index
                                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                    // If only one is in the order array, it comes first
                                    if (indexA !== -1) return -1;
                                    if (indexB !== -1) return 1;
                                    // If neither is in the order array, sort alphabetically
                                    return typeA.localeCompare(typeB);
                                })
                                .map(([testType, groupedTests]) => {
                                    const colors = getTestTypeColor(testType);
                                    return (
                                        <div
                                            key={testType}
                                            style={{
                                                marginBottom: '32px',
                                                padding: '24px',
                                                border: `2px solid ${colors.border}`,
                                                borderRadius: '16px',
                                                background: colors.bgGradient,
                                            }}
                                        >
                                            <h2
                                                style={{
                                                    fontSize: '20px',
                                                    fontWeight: '600',
                                                    marginBottom: '16px',
                                                    color: '#1F2937',
                                                }}
                                            >
                                                {getTestTypeLabel(testType)}
                                            </h2>
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                                    gap: '16px',
                                                }}
                                            >
                                                {groupedTests
                                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                    .map((test) => (
                                                        <div
                                                            key={test.id}
                                                            style={{
                                                                background: 'white',
                                                                borderRadius: '12px',
                                                                padding: '16px',
                                                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                            }}
                                                            onClick={() => toggleTestExpansion(test.id)}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    marginBottom: expandedTests[test.id] ? '12px' : '0',
                                                                }}
                                                            >
                                                                <div style={{ flex: 1 }}>
                                                                    <h3
                                                                        style={{
                                                                            fontSize: '16px',
                                                                            fontWeight: '600',
                                                                            color: '#1F2937',
                                                                            marginBottom: '4px',
                                                                        }}
                                                                    >
                                                                        {test.apTest || test.type}
                                                                    </h3>
                                                                    {/* Show date for SAT, ACT, PSAT when collapsed */}
                                                                    {!expandedTests[test.id] && (test.type === 'SAT' || test.type === 'ACT' || test.type === 'PSAT 8/9' || test.type === 'PSAT/NMSQT') && (
                                                                        <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '2px' }}>
                                                                            {test.date}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        fontSize: '24px',
                                                                        fontWeight: '700',
                                                                        color: '#437E84',
                                                                    }}
                                                                >
                                                                    {test.score}
                                                                </div>
                                                            </div>
                                                            {expandedTests[test.id] && (
                                                                <div
                                                                    style={{
                                                                        paddingTop: '12px',
                                                                        borderTop: '1px solid #E5E7EB',
                                                                    }}
                                                                >
                                                                    <p
                                                                        style={{
                                                                            fontSize: '14px',
                                                                            color: '#6B7280',
                                                                            marginBottom: '8px',
                                                                        }}
                                                                    >
                                                                        <strong>Test Date:</strong> {test.date}
                                                                    </p>
                                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEditTest(test);
                                                                            }}
                                                                            style={{
                                                                                padding: '6px 12px',
                                                                                background: '#DBEAFE',
                                                                                color: '#1E40AF',
                                                                                border: 'none',
                                                                                borderRadius: '6px',
                                                                                fontSize: '13px',
                                                                                fontWeight: '500',
                                                                                cursor: 'pointer',
                                                                                transition: 'background 0.2s ease',
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                e.currentTarget.style.background = '#BFDBFE';
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                e.currentTarget.style.background = '#DBEAFE';
                                                                            }}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteTest(test.id);
                                                                            }}
                                                                            style={{
                                                                                padding: '6px 12px',
                                                                                background: '#FEE2E2',
                                                                                color: '#DC2626',
                                                                                border: 'none',
                                                                                borderRadius: '6px',
                                                                                fontSize: '13px',
                                                                                fontWeight: '500',
                                                                                cursor: 'pointer',
                                                                                transition: 'background 0.2s ease',
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                e.currentTarget.style.background = '#FECACA';
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                e.currentTarget.style.background = '#FEE2E2';
                                                                            }}
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            <p
                                style={{
                                    fontSize: '12px',
                                    color: '#9CA3AF',
                                    textAlign: 'center',
                                    marginTop: '24px',
                                    fontStyle: 'italic',
                                }}
                            >
                                AP, SAT, PSAT are registered trademarks of College Board. ACT is a registered trademark of ACT, Inc. AppApp is not affiliated with or endorsed by these entities.
                            </p>
                        </>
                    )}
                </main>
            </div>

            {/* Add/Edit Test Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '24px',
                            width: '90%',
                            maxWidth: '500px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px', color: '#1F2937' }}>
                            {editingTest ? 'Edit Test Score' : 'Add Test Score'}
                        </h2>

                        {/* Test Type */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                Test Type
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                }}
                            >
                                <option value="SAT">SAT</option>
                                <option value="ACT">ACT</option>
                                <option value="AP">AP</option>
                                <option value="PSAT/NMSQT">PSAT/NMSQT</option>
                                <option value="PSAT 8/9">PSAT 8/9</option>
                            </select>
                        </div>

                        {/* AP Test Name (only for AP) */}
                        {formData.type === 'AP' && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                    AP Test Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.apTest}
                                    onChange={(e) => setFormData({ ...formData, apTest: e.target.value })}
                                    placeholder="e.g., AP Calculus BC"
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                    }}
                                />
                            </div>
                        )}

                        {/* Score */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                Score
                            </label>
                            <input
                                type="text"
                                value={formData.score}
                                onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                                placeholder={formData.type === 'SAT' ? '1600' : formData.type === 'ACT' ? '36' : formData.type === 'AP' ? '5' : 'Score'}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                }}
                            />
                        </div>

                        {/* Date */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                Test Date
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    background: '#F3F4F6',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#374151',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveTest}
                                style={{
                                    padding: '10px 20px',
                                    background: '#437E84',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: 'white',
                                    cursor: 'pointer',
                                }}
                            >
                                {editingTest ? 'Save Changes' : 'Add Test'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

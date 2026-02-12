'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, addDoc } from 'firebase/firestore';
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

interface College {
    id: string;
    collegeName: string;
    collegeScore: string;
    toured: boolean;
    applicationStatus: string;
    notes: string;
    images: string[];
    imageNames: string[];
    createdAt: Date;
}

interface Essay {
    id: string;
    assignedColleges?: string[];
}

export default function Colleges() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });
    const [colleges, setColleges] = useState<College[]>([]);
    const [essays, setEssays] = useState<Essay[]>([]);
    const [loading, setLoading] = useState(true);
    const [navigating, setNavigating] = useState(false);
    const [sortCriteria, setSortCriteria] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCollegeName, setNewCollegeName] = useState('');
    const [newCollegeScore, setNewCollegeScore] = useState('');
    const [newCollegeToured, setNewCollegeToured] = useState<boolean | null>(null);
    const [newCollegeStatus, setNewCollegeStatus] = useState('not_applying');
    const [newCollegeNotes, setNewCollegeNotes] = useState('');
    const [addingCollege, setAddingCollege] = useState(false);
    const router = useRouter();

    const fetchColleges = async (uid: string) => {
        try {
            const q = collection(db, 'users', uid, 'colleges');
            const querySnapshot = await getDocs(q);
            const collegesData = querySnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    collegeName: data.collegeName || '',
                    collegeScore: data.collegeScore || '',
                    toured: data.toured || false,
                    applicationStatus: data.applicationStatus || (data.wantToApply ? 'applying' : 'not_applying'),
                    notes: data.notes || '',
                    images: data.images || [],
                    imageNames: data.imageNames || [],
                    createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                };
            });
            setColleges(collegesData);
        } catch (error) {
            console.error('Error fetching colleges:', error);
        }
    };

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
                await fetchColleges(user.uid);

                // Fetch essays to count them per college
                const essaysSnapshot = await getDocs(collection(db, 'users', user.uid, 'essays'));
                const essaysData = essaysSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    assignedColleges: doc.data().assignedColleges || [],
                } as Essay));
                setEssays(essaysData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const sortedColleges = useMemo(() => {
        return [...colleges]
            .sort((a, b) => {
                if (sortCriteria === 'date') {
                    return sortDirection === 'asc'
                        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                } else if (sortCriteria === 'score') {
                    const scoreA = Number(a.collegeScore) || 0;
                    const scoreB = Number(b.collegeScore) || 0;
                    return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
                }
                return 0;
            })
            .filter(
                (college) =>
                    college.collegeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    college.notes?.toLowerCase().includes(searchQuery.toLowerCase())
            );
    }, [colleges, sortCriteria, sortDirection, searchQuery]);

    const handleAddCollege = async () => {
        if (!user || !newCollegeName.trim()) return;

        setAddingCollege(true);
        try {
            const newCollege = {
                collegeName: newCollegeName.trim(),
                createdAt: new Date(),
                collegeScore: newCollegeScore,
                applicationStatus: newCollegeStatus,
                toured: newCollegeToured || false,
                notes: newCollegeNotes,
                images: [],
                imageNames: []
            };

            const docRef = await addDoc(collection(db, 'users', user.uid, 'colleges'), newCollege);

            const newCollegeWithId: College = {
                id: docRef.id,
                ...newCollege
            };

            setColleges(prev => [newCollegeWithId, ...prev]);
            setCounts((prev: Counts) => ({ ...prev, colleges: prev.colleges + 1 }));

            // Reset all form fields
            setNewCollegeName('');
            setNewCollegeScore('');
            setNewCollegeToured(null);
            setNewCollegeStatus('not_applying');
            setNewCollegeNotes('');
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding college:', error);
            alert('Failed to add college. Please try again.');
        } finally {
            setAddingCollege(false);
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

    const getEssayCountForCollege = (collegeId: string) => {
        return essays.filter((essay) => essay.assignedColleges?.includes(collegeId)).length;
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
                    currentPath="/colleges"
                />

                <main className={styles.centerContent}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h1 className={styles.pageTitle} style={{ margin: 0 }}>My Colleges</h1>
                        <button
                            onClick={() => setShowAddModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#437E84',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 16px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(67, 126, 132, 0.2)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                            Add College
                        </button>
                    </div>

                    <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Search colleges..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                flex: '1',
                                minWidth: '200px',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid #E9ECEF',
                                fontSize: '14px',
                            }}
                        />
                        <select
                            value={sortCriteria}
                            onChange={(e) => setSortCriteria(e.target.value)}
                            style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid #E9ECEF',
                                fontSize: '14px',
                            }}
                        >
                            <option value="date">Sort by Date</option>
                            <option value="score">Sort by Score</option>
                        </select>
                        <button
                            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                            style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid #E9ECEF',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '14px',
                            }}
                        >
                            {sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                        </button>
                    </div>

                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingImage}>
                                <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                            </div>
                            <div className={styles.loading}>Loading colleges...</div>
                        </div>
                    ) : sortedColleges.length === 0 ? (
                        <div className={styles.placeholderCard}>
                            <div className={styles.placeholderIcon}>
                                <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#437E84' }}>account_balance</span>
                            </div>
                            <h2 className={styles.placeholderTitle}>
                                {searchQuery ? 'No colleges match your search' : 'No Colleges Yet'}
                            </h2>
                            <p className={styles.placeholderText}>
                                {searchQuery ? 'Try a different search term.' : 'Start adding colleges to track your college application journey!'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
                            {sortedColleges.map((college) => {
                                const previewNotes = college.notes ? college.notes.split('\n')[0] : '';
                                const previewImage = college.images && college.images.length > 0 ? college.images[0] : null;

                                return (
                                    <div
                                        key={college.id}
                                        onClick={() => {
                                            setNavigating(true);
                                            router.push(`/colleges/${college.id}`);
                                        }}
                                        style={{
                                            background: 'white',
                                            borderRadius: '12px',
                                            border: '1px solid #E9ECEF',
                                            padding: '20px',
                                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                                            transition: 'all 0.2s ease',
                                            cursor: 'pointer',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1A202C', margin: 0, marginBottom: '12px' }}>
                                            {college.collegeName}
                                        </h3>

                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                background: '#F0F4F8',
                                                fontSize: '13px',
                                                color: '#4A5568',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>star</span>
                                                {getScoreDisplay(college.collegeScore)}
                                            </span>

                                            {college.toured && (
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    background: '#E6F4EA',
                                                    fontSize: '13px',
                                                    color: '#137333',
                                                }}>
                                                    ✓ Toured
                                                </span>
                                            )}

                                            {college.applicationStatus !== 'not_applying' && (
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    background: getApplicationStatusBadge(college.applicationStatus).bg,
                                                    fontSize: '13px',
                                                    color: getApplicationStatusBadge(college.applicationStatus).color,
                                                }}>
                                                    {getApplicationStatusBadge(college.applicationStatus).text}
                                                </span>
                                            )}

                                            {getEssayCountForCollege(college.id) > 0 && (
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    background: '#EFF6FF',
                                                    fontSize: '13px',
                                                    color: '#437E84',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>article</span>
                                                    {getEssayCountForCollege(college.id)} {getEssayCountForCollege(college.id) === 1 ? 'Essay' : 'Essays'}
                                                </span>
                                            )}
                                        </div>

                                        {previewNotes && (
                                            <p style={{
                                                fontSize: '14px',
                                                color: '#718096',
                                                margin: '8px 0',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: previewImage ? 1 : 3,
                                                WebkitBoxOrient: 'vertical',
                                                whiteSpace: previewImage ? 'nowrap' : 'normal',
                                            }}>
                                                {previewNotes}
                                            </p>
                                        )}

                                        {previewImage && (
                                            <img
                                                src={previewImage}
                                                alt="College preview"
                                                style={{
                                                    width: '100%',
                                                    height: '200px',
                                                    objectFit: 'cover',
                                                    borderRadius: '8px',
                                                    marginTop: '12px',
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>

            {/* Add College Modal */}
            {showAddModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '20px',
                        padding: '32px',
                        width: '520px',
                        maxWidth: '95%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1F2937', margin: 0 }}>
                                Add New College
                            </h2>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewCollegeName('');
                                    setNewCollegeScore('');
                                    setNewCollegeToured(null);
                                    setNewCollegeStatus('not_applying');
                                    setNewCollegeNotes('');
                                }}
                                style={{
                                    background: '#F3F4F6',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#6B7280' }}>close</span>
                            </button>
                        </div>

                        {/* College Name */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                College Name <span style={{ color: '#EF4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={newCollegeName}
                                onChange={(e) => setNewCollegeName(e.target.value)}
                                placeholder="e.g. Harvard University"
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #E5E7EB',
                                    fontSize: '15px',
                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#437E84';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(67, 126, 132, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#E5E7EB';
                                    e.target.style.boxShadow = 'none';
                                }}
                                autoFocus
                            />
                        </div>

                        {/* College Rating */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                Your Rating
                            </label>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 10px 0' }}>
                                How would you rate this college overall?
                            </p>
                            <select
                                value={newCollegeScore}
                                onChange={(e) => setNewCollegeScore(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #E5E7EB',
                                    fontSize: '15px',
                                    background: 'white',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="">Select a rating...</option>
                                <option value="10">10/10 💯 Dream School</option>
                                <option value="9">9/10 😍 Excellent</option>
                                <option value="8">8/10 😁 Great</option>
                                <option value="7">7/10 😀 Very Good</option>
                                <option value="6">6/10 🙂 Good</option>
                                <option value="5">5/10 😐 Average</option>
                                <option value="4">4/10 😕 Below Average</option>
                                <option value="3">3/10 ☹️ Poor</option>
                                <option value="2">2/10 😭 Very Poor</option>
                                <option value="1">1/10 🤮 Not For Me</option>
                            </select>
                        </div>

                        {/* Toured Toggle */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
                                Have you toured this college?
                            </label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setNewCollegeToured(true)}
                                    style={{
                                        flex: 1,
                                        padding: '12px 20px',
                                        borderRadius: '10px',
                                        border: newCollegeToured === true ? '2px solid #437E84' : '1px solid #E5E7EB',
                                        background: newCollegeToured === true ? '#F0FDFA' : 'white',
                                        color: newCollegeToured === true ? '#115E59' : '#6B7280',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    ✓ Yes, I've toured
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewCollegeToured(false)}
                                    style={{
                                        flex: 1,
                                        padding: '12px 20px',
                                        borderRadius: '10px',
                                        border: newCollegeToured === false ? '2px solid #437E84' : '1px solid #E5E7EB',
                                        background: newCollegeToured === false ? '#F0FDFA' : 'white',
                                        color: newCollegeToured === false ? '#115E59' : '#6B7280',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Not yet
                                </button>
                            </div>
                        </div>

                        {/* Application Status */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                Application Status
                            </label>
                            <select
                                value={newCollegeStatus}
                                onChange={(e) => setNewCollegeStatus(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #E5E7EB',
                                    fontSize: '15px',
                                    background: 'white',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            >
                                <option value="not_applying">🤔 Not Applying</option>
                                <option value="applying">📝 Planning to Apply</option>
                                <option value="applied">✉️ Applied</option>
                                <option value="accepted">🎉 Accepted</option>
                            </select>
                        </div>

                        {/* Notes */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                Notes
                            </label>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 10px 0' }}>
                                Add any notes about this college (tuition, majors, contacts, etc.)
                            </p>
                            <textarea
                                value={newCollegeNotes}
                                onChange={(e) => setNewCollegeNotes(e.target.value)}
                                placeholder="What do you like or dislike about this college?"
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #E5E7EB',
                                    fontSize: '15px',
                                    resize: 'vertical',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#437E84';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(67, 126, 132, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#E5E7EB';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewCollegeName('');
                                    setNewCollegeScore('');
                                    setNewCollegeToured(null);
                                    setNewCollegeStatus('not_applying');
                                    setNewCollegeNotes('');
                                }}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '10px',
                                    border: '1px solid #E5E7EB',
                                    background: 'white',
                                    color: '#374151',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddCollege}
                                disabled={!newCollegeName.trim() || addingCollege}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: !newCollegeName.trim() || addingCollege ? '#9CA3AF' : '#437E84',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: !newCollegeName.trim() || addingCollege ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {addingCollege ? (
                                    <>
                                        <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                        Add College
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Animations */}
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {/* Translucent Loading Screen */}
            {navigating && (
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingImage}>
                        <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                    </div>
                    <div className={styles.loading}>Loading college...</div>
                </div>
            )}
        </div>
    );
}

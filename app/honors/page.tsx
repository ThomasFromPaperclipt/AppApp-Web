'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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

interface Honor {
    id: string;
    honorTitle: string;
    honorType: 'school' | 'state' | 'national' | 'international';
    date: string;
    description: string;
    createdAt: Date;
    isStarred?: boolean;
}

export default function HonorsAndAwards() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });
    const [honors, setHonors] = useState<Honor[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedHonors, setExpandedHonors] = useState<{ [key: string]: boolean }>({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingHonor, setEditingHonor] = useState<Honor | null>(null);

    // Form states
    const [formTitle, setFormTitle] = useState('');
    const [formType, setFormType] = useState<'school' | 'state' | 'national' | 'international'>('school');
    const [formDate, setFormDate] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [filterType, setFilterType] = useState('all');

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
                await fetchHonors(user.uid);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const fetchHonors = async (uid: string) => {
        try {
            const honorsSnapshot = await getDocs(collection(db, 'users', uid, 'honors'));
            const honorsData = honorsSnapshot.docs.map((doc) => {
                const data = doc.data();
                let createdAt = new Date();

                // Handle createdAt - it might be a Timestamp or already a Date
                if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                    createdAt = data.createdAt.toDate();
                } else if (data.createdAt instanceof Date) {
                    createdAt = data.createdAt;
                }

                return {
                    id: doc.id,
                    honorTitle: data.honorTitle || '',
                    honorType: data.honorType || 'school',
                    date: data.date || '',
                    description: data.description || '',
                    isStarred: data.isStarred || false,
                    createdAt,
                } as Honor;
            });

            // Sort by date (most recent first)
            honorsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setHonors(honorsData);
        } catch (error) {
            console.error('Error fetching honors:', error);
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

    const toggleHonorExpansion = (honorId: string) => {
        setExpandedHonors((prev) => ({
            ...prev,
            [honorId]: !prev[honorId],
        }));
    };

    const getHonorTypeBadge = (type: string) => {
        switch (type) {
            case 'state':
                return 'State/Regional 📌';
            case 'national':
                return 'National 🇺🇸';
            case 'international':
                return 'International 🌐';
            case 'school':
                return 'School-wide 🏫';
            default:
                return 'Unknown';
        }
    };

    const openAddModal = () => {
        setEditingHonor(null);
        setFormTitle('');
        setFormType('school');
        setFormDate('');
        setFormDescription('');
        setShowAddModal(true);
    };

    const openEditModal = (honor: Honor) => {
        setEditingHonor(honor);
        setFormTitle(honor.honorTitle);
        setFormType(honor.honorType);
        setFormDate(honor.date);
        setFormDescription(honor.description);
        setShowAddModal(true);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setEditingHonor(null);
        setFormTitle('');
        setFormType('school');
        setFormDate('');
        setFormDescription('');
    };

    const handleSave = async () => {
        if (!user || !formTitle || !formDate) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const honorData = {
                honorTitle: formTitle,
                honorType: formType,
                date: formDate,
                description: formDescription,
                createdAt: new Date(),
            };

            if (editingHonor) {
                // Update existing honor
                await updateDoc(doc(db, 'users', user.uid, 'honors', editingHonor.id), honorData);
                setHonors((prev) =>
                    prev.map((h) =>
                        h.id === editingHonor.id
                            ? { ...h, ...honorData, createdAt: h.createdAt }
                            : h
                    )
                );
            } else {
                // Add new honor
                const docRef = await addDoc(collection(db, 'users', user.uid, 'honors'), honorData);
                setHonors((prev) => [...prev, { id: docRef.id, ...honorData }]);
                setCounts((prev) => ({ ...prev, honors: prev.honors + 1 }));
            }

            closeModal();
        } catch (error) {
            console.error('Error saving honor:', error);
            alert('Failed to save honor');
        }
    };

    const handleDelete = async (honorId: string) => {
        if (!user) return;

        if (!confirm('Are you sure you want to delete this honor?')) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'honors', honorId));
            setHonors((prev) => prev.filter((h) => h.id !== honorId));
            setCounts((prev) => ({ ...prev, honors: prev.honors - 1 }));
        } catch (error) {
            console.error('Error deleting honor:', error);
            alert('Failed to delete honor');
        }
    };

    const handleToggleStar = async (honorId: string, currentStatus?: boolean) => {
        if (!user) return;

        const starredCount = honors.filter(h => h.isStarred).length;
        if (!currentStatus && starredCount >= 5) {
            alert('You can only star up to 5 honors.');
            return;
        }

        try {
            await updateDoc(doc(db, 'users', user.uid, 'honors', honorId), {
                isStarred: !currentStatus
            });
            setHonors(prev => prev.map(h => h.id === honorId ? { ...h, isStarred: !currentStatus } : h));
        } catch (error) {
            console.error('Error toggling star:', error);
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
                    userRole={userData?.role}
                    counts={counts}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/honors"
                />

                <main className={styles.centerContent}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h1 className={styles.pageTitle}>Honors & Awards</h1>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{
                                background: '#FFFBEB',
                                border: '1px solid #FCD34D',
                                borderRadius: '8px',
                                padding: '8px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#92400E',
                                fontWeight: '600',
                                fontSize: '14px'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#F59E0B' }}>star</span>
                                Starred: {honors.filter(h => h.isStarred).length}/5
                            </div>
                            <button
                                onClick={openAddModal}
                                style={{
                                    padding: '10px 20px',
                                    background: '#437E84',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                                Add Honor
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                fontSize: '14px',
                                color: '#4B5563',
                                background: 'white',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            <option value="all">All Types</option>
                            <option value="starred">Starred ⭐</option>
                            <option value="school">School-wide 🏫</option>
                            <option value="state">State/Regional 📌</option>
                            <option value="national">National 🇺🇸</option>
                            <option value="international">International 🌐</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingImage}>
                                <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                            </div>
                            <div className={styles.loading}>Loading honors...</div>
                        </div>
                    ) : honors.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyStateIcon}>
                                <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#437E84' }}>emoji_events</span>
                            </div>
                            <h2 className={styles.emptyStateTitle}>No honors saved yet</h2>
                            <p className={styles.emptyStateText}>
                                Click "Add Honor" to start tracking your awards and achievements.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {['international', 'national', 'state', 'school'].map((type) => {
                                const typeHonors = honors.filter(h => {
                                    const matchesType = h.honorType === type;
                                    const matchesFilter = filterType === 'all'
                                        ? true
                                        : filterType === 'starred'
                                            ? h.isStarred
                                            : h.honorType === filterType;
                                    // If filtering by specific type, only show that type group.
                                    // If filtering by starred, show starred items in their respective groups.
                                    if (filterType !== 'all' && filterType !== 'starred' && filterType !== type) return false;

                                    return matchesType && (filterType === 'starred' ? h.isStarred : true);
                                });
                                if (typeHonors.length === 0) return null;

                                return (
                                    <div key={type}>
                                        <h2 style={{
                                            fontSize: '20px',
                                            fontWeight: '700',
                                            color: '#2D3748',
                                            marginBottom: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            {getHonorTypeBadge(type)}
                                            <span style={{
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                color: '#718096',
                                                background: '#EDF2F7',
                                                padding: '2px 8px',
                                                borderRadius: '12px'
                                            }}>
                                                {typeHonors.length}
                                            </span>
                                        </h2>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {typeHonors.map((honor) => (
                                                <div
                                                    key={honor.id}
                                                    style={{
                                                        background: 'white',
                                                        borderRadius: '12px',
                                                        border: '1px solid #E9ECEF',
                                                        padding: '20px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }}
                                                >
                                                    <div
                                                        onClick={() => toggleHonorExpansion(honor.id)}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'flex-start',
                                                            position: 'relative',
                                                            paddingRight: '40px'
                                                        }}
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleStar(honor.id, honor.isStarred);
                                                            }}
                                                            style={{
                                                                position: 'absolute',
                                                                top: '0',
                                                                right: '0',
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '4px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                zIndex: 10
                                                            }}
                                                            title={honor.isStarred ? "Unstar honor" : "Star honor"}
                                                        >
                                                            <span
                                                                className="material-symbols-outlined"
                                                                style={{
                                                                    fontSize: '22px',
                                                                    color: honor.isStarred ? '#F59E0B' : '#D1D5DB',
                                                                    fontVariationSettings: honor.isStarred ? "'FILL' 1" : "'FILL' 0"
                                                                }}
                                                            >
                                                                star
                                                            </span>
                                                        </button>
                                                        <div style={{ flex: 1 }}>
                                                            <h3 style={{
                                                                fontSize: '18px',
                                                                fontWeight: '600',
                                                                color: '#1A202C',
                                                                margin: '0 0 8px 0',
                                                            }}>
                                                                {honor.honorTitle}
                                                            </h3>
                                                            <div style={{
                                                                fontSize: '14px',
                                                                color: '#437E84',
                                                                fontWeight: '500',
                                                            }}>
                                                                {new Date(honor.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                                            </div>
                                                        </div>
                                                        <span
                                                            className="material-symbols-outlined"
                                                            style={{
                                                                fontSize: '24px',
                                                                color: '#437E84',
                                                                transition: 'transform 0.2s ease',
                                                                transform: expandedHonors[honor.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            }}
                                                        >
                                                            expand_more
                                                        </span>
                                                    </div>

                                                    {expandedHonors[honor.id] && (
                                                        <div style={{
                                                            marginTop: '16px',
                                                            paddingTop: '16px',
                                                            borderTop: '1px solid #E9ECEF',
                                                        }}>
                                                            {honor.description && (
                                                                <p style={{
                                                                    fontSize: '14px',
                                                                    color: '#4A5568',
                                                                    margin: '0 0 12px 0',
                                                                    lineHeight: '1.6',
                                                                }}>
                                                                    <strong>Description:</strong> {honor.description}
                                                                </p>
                                                            )}
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openEditModal(honor);
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 16px',
                                                                        background: '#437E84',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        fontSize: '13px',
                                                                        fontWeight: '500',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDelete(honor.id);
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 16px',
                                                                        background: '#EF4444',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        fontSize: '13px',
                                                                        fontWeight: '500',
                                                                        cursor: 'pointer',
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
                        </div>
                    )}
                </main>
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
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
                        zIndex: 1000,
                    }}
                    onClick={closeModal}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '32px',
                            maxWidth: '500px',
                            width: '90%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>
                            {editingHonor ? 'Edit Honor' : 'Add Honor'}
                        </h2>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                                Honor Title *
                            </label>
                            <input
                                type="text"
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                }}
                                placeholder="e.g., National Merit Scholar"
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                                Honor Type *
                            </label>
                            <select
                                value={formType}
                                onChange={(e) => setFormType(e.target.value as any)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                }}
                            >
                                <option value="school">School-wide 🏫</option>
                                <option value="state">State/Regional 📌</option>
                                <option value="national">National 🇺🇸</option>
                                <option value="international">International 🌐</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                                Date Received *
                            </label>
                            <input
                                type="date"
                                value={formDate}
                                onChange={(e) => setFormDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                                Description (Optional)
                            </label>
                            <textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    minHeight: '100px',
                                    resize: 'vertical',
                                }}
                                placeholder="Describe your achievement..."
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={closeModal}
                                style={{
                                    padding: '10px 20px',
                                    background: '#E5E7EB',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                style={{
                                    padding: '10px 20px',
                                    background: '#437E84',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                }}
                            >
                                {editingHonor ? 'Save Changes' : 'Add Honor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, deleteDoc, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../../dashboard/dashboard.module.css';

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

interface College {
    id: string;
    collegeName: string;
    collegeScore: string;
    toured: boolean;
    applicationStatus: string; // 'not_applying' | 'applying' | 'applied' | 'accepted'
    notes: string;
    images: string[];
    imageNames: string[];
    createdAt: Date;
}

type EssayStatus = 'Idea' | 'In Progress' | 'Proofread' | 'Submitted';

interface Essay {
    id: string;
    title: string;
    idea: string;
    status?: EssayStatus;
    assignedColleges?: string[];
}

interface Prompt {
    id: string;
    collegeId: string;
    promptText: string;
    linkedEssayId?: string;
    wordLimit?: number;
}

export default function CollegeDetail() {
    const params = useParams();
    const router = useRouter();
    const collegeId = params.id as string;

    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });
    const [college, setCollege] = useState<College | null>(null);
    const [essays, setEssays] = useState<Essay[]>([]);
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

    // Inline editing states
    const [editingName, setEditingName] = useState(false);
    const [editingScore, setEditingScore] = useState(false);
    const [editingNotes, setEditingNotes] = useState(false);
    const [editingToured, setEditingToured] = useState(false);
    const [editingApplying, setEditingApplying] = useState(false);

    // Temp values for editing
    const [tempName, setTempName] = useState('');
    const [tempScore, setTempScore] = useState('');
    const [tempNotes, setTempNotes] = useState('');
    const [tempToured, setTempToured] = useState(false);
    const [tempApplying, setTempApplying] = useState(false);

    // Prompt adding state
    const [isAddingPrompt, setIsAddingPrompt] = useState(false);
    const [newPromptText, setNewPromptText] = useState('');
    const [newPromptWordLimit, setNewPromptWordLimit] = useState('');

    const fetchCollege = async (uid: string, id: string) => {
        try {
            const collegeDoc = await getDoc(doc(db, 'users', uid, 'colleges', id));
            if (collegeDoc.exists()) {
                const data = collegeDoc.data();
                setCollege({
                    id: collegeDoc.id,
                    collegeName: data.collegeName || '',
                    collegeScore: data.collegeScore || '',
                    toured: data.toured || false,
                    applicationStatus: data.applicationStatus || (data.wantToApply ? 'applying' : 'not_applying'),
                    notes: data.notes || '',
                    images: data.images || [],
                    imageNames: data.imageNames || [],
                    createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
                });
            } else {
                router.push('/colleges');
            }
        } catch (error) {
            console.error('Error fetching college:', error);
            router.push('/colleges');
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
                await fetchCollege(user.uid, collegeId);

                // Fetch essays
                const essaysSnapshot = await getDocs(collection(db, 'users', user.uid, 'essays'));
                const essaysData = essaysSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                } as Essay));
                // Filter essays that are assigned to this college
                const collegeEssays = essaysData.filter((essay) =>
                    essay.assignedColleges?.includes(collegeId)
                );
                setEssays(collegeEssays);

                // Fetch Prompts for this college
                const promptsQuery = query(
                    collection(db, 'users', user.uid, 'essay_prompts'),
                    where('collegeId', '==', collegeId)
                );
                const promptsSnapshot = await getDocs(promptsQuery);
                const promptsData = promptsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Prompt));
                setPrompts(promptsData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router, collegeId]);

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

    const deleteCollege = async () => {
        if (!user || !college) return;
        if (!confirm('Are you sure you want to delete this college? This cannot be undone.')) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'colleges', college.id));
            router.push('/colleges');
        } catch (error) {
            console.error('Error deleting college:', error);
        }
    };

    const saveField = async (field: string, value: any) => {
        if (!user || !college) return;

        try {
            const collegeDoc = doc(db, 'users', user.uid, 'colleges', college.id);
            await updateDoc(collegeDoc, { [field]: value });
            await fetchCollege(user.uid, collegeId);
        } catch (error) {
            console.error('Error updating college:', error);
        }
    };

    const startEditName = () => {
        setTempName(college?.collegeName || '');
        setEditingName(true);
    };

    const saveNameEdit = async () => {
        await saveField('collegeName', tempName);
        setEditingName(false);
    };

    const startEditScore = () => {
        setTempScore(college?.collegeScore || '');
        setEditingScore(true);
    };

    const saveScoreEdit = async () => {
        await saveField('collegeScore', tempScore);
        setEditingScore(false);
    };

    const startEditNotes = () => {
        setTempNotes(college?.notes || '');
        setEditingNotes(true);
    };

    const saveNotesEdit = async () => {
        await saveField('notes', tempNotes);
        setEditingNotes(false);
    };

    const updateScore = async (score: string) => {
        if (!college) return;
        await saveField('collegeScore', score);
    };

    const toggleToured = async () => {
        if (!college) return;
        await saveField('toured', !college.toured);
    };

    const updateApplicationStatus = async (status: string) => {
        if (!college) return;
        await saveField('applicationStatus', status);
    };

    const getApplicationStatusDisplay = (status: string) => {
        const statusMap: { [key: string]: { text: string; emoji: string; bg: string; color: string } } = {
            'not_applying': { text: 'Not Applying', emoji: '', bg: '#F8F9FA', color: '#718096' },
            'applying': { text: 'Applying', emoji: '📝', bg: '#E3F2FD', color: '#1565C0' },
            'applied': { text: 'Applied', emoji: '✉️', bg: '#FFF4E6', color: '#E67700' },
            'accepted': { text: 'Accepted', emoji: '🎉', bg: '#E6F4EA', color: '#137333' },
        };
        return statusMap[status] || statusMap['not_applying'];
    };

    const handleAddPrompt = async () => {
        if (!user || !newPromptText.trim()) return;

        try {
            const newPrompt = {
                collegeId,
                promptText: newPromptText.trim(),
                linkedEssayId: '',
                ...(newPromptWordLimit && { wordLimit: parseInt(newPromptWordLimit) })
            };

            const docRef = await addDoc(collection(db, 'users', user.uid, 'essay_prompts'), newPrompt);

            setPrompts(prev => [...prev, { id: docRef.id, ...newPrompt }]);
            setNewPromptText('');
            setNewPromptWordLimit('');
            setIsAddingPrompt(false);
        } catch (error) {
            console.error('Error adding prompt:', error);
        }
    };

    const getStatusColor = (status?: EssayStatus) => {
        switch (status) {
            case 'Submitted':
                return { bg: '#D1FAE5', text: '#059669' };
            case 'Proofread':
                return { bg: '#FEF3C7', text: '#D97706' };
            case 'In Progress':
                return { bg: '#DBEAFE', text: '#2563EB' };
            case 'Idea':
            default:
                return { bg: '#F3F4F6', text: '#6B7280' };
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingImage}>
                        <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                    </div>
                    <div className={styles.loading}>Loading college...</div>
                </div>
            </div>
        );
    }

    if (!college) {
        return null;
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

            <div className={styles.mainLayoutTwoCol}>
                <aside className={styles.leftSidebar}>
                    <div className={styles.sidebarContent}>
                        <button className={styles.sidebarItem} onClick={() => router.push('/dashboard')}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>dashboard</span>
                            Dashboard
                        </button>

                        <div className={styles.sidebarSection}>
                            <div className={styles.sectionLabel}>MANAGE</div>
                            <button className={styles.sidebarItem} onClick={() => router.push('/activities')}>
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
                            <button className={`${styles.sidebarItem} ${styles.sidebarItemActive}`} onClick={() => router.push('/colleges')}>
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
                        </div>
                    </div>
                </aside>

                <main className={styles.centerContent}>
                    <div style={{ marginBottom: '20px' }}>
                        <button
                            onClick={() => router.push('/colleges')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'none',
                                border: 'none',
                                color: '#437E84',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '8px 0',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
                            Back to Colleges
                        </button>
                    </div>

                    {/* College Name - Editable */}
                    <div style={{ marginBottom: '24px' }}>
                        {editingName ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    style={{
                                        fontSize: '32px',
                                        fontWeight: '600',
                                        padding: '8px',
                                        border: '2px solid #437E84',
                                        borderRadius: '4px',
                                        flex: 1,
                                    }}
                                    autoFocus
                                />
                                <button
                                    onClick={saveNameEdit}
                                    style={{
                                        padding: '8px 16px',
                                        background: '#437E84',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setEditingName(false)}
                                    style={{
                                        padding: '8px 16px',
                                        background: '#E9ECEF',
                                        color: '#4A5568',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <h1 className={styles.pageTitle} style={{ margin: 0 }}>{college.collegeName}</h1>
                                <button
                                    onClick={startEditName}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#A0AEC0',
                                        padding: '2px',
                                    }}
                                    title="Edit name"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Score, Toured & Application Status - All as badges */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
                        {/* Score Dropdown - styled like a badge */}
                        <select
                            value={college.collegeScore}
                            onChange={(e) => updateScore(e.target.value)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '12px',
                                background: '#F0F4F8',
                                fontSize: '16px',
                                color: '#4A5568',
                                border: '1px solid #F0F4F8',
                                cursor: 'pointer',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <option value="">No Score</option>
                            {Array.from({ length: 10 }, (_, i) => 10 - i).map((score) => (
                                <option key={score} value={score.toString()}>
                                    {getScoreDisplay(score.toString())}
                                </option>
                            ))}
                        </select>

                        {/* Toured Toggle - Clean, no edit icon */}
                        <button
                            onClick={toggleToured}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '12px',
                                background: college.toured ? '#E6F4EA' : '#F8F9FA',
                                fontSize: '16px',
                                color: college.toured ? '#137333' : '#718096',
                                border: college.toured ? '1px solid #E6F4EA' : '1px solid #E9ECEF',
                                cursor: 'pointer',
                            }}
                        >
                            {college.toured ? '✓ Toured' : 'Not Toured'}
                        </button>

                        {/* Application Status Dropdown - styled like a badge */}
                        <select
                            value={college.applicationStatus}
                            onChange={(e) => updateApplicationStatus(e.target.value)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '12px',
                                background: getApplicationStatusDisplay(college.applicationStatus).bg,
                                fontSize: '16px',
                                color: getApplicationStatusDisplay(college.applicationStatus).color,
                                border: `1px solid ${getApplicationStatusDisplay(college.applicationStatus).bg}`,
                                cursor: 'pointer',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                            }}
                        >
                            <option value="not_applying">Not Applying</option>
                            <option value="applying">📝 Applying</option>
                            <option value="applied">✉️ Applied</option>
                            <option value="accepted">🎉 Accepted</option>
                        </select>
                    </div>

                    {/* Notes - Editable */}
                    {(college.notes || editingNotes) && (
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1A202C', margin: 0 }}>Notes</h2>
                                {!editingNotes && (
                                    <button
                                        onClick={startEditNotes}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#A0AEC0',
                                            padding: '0px',
                                        }}
                                        title="Edit notes"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                                    </button>
                                )}
                            </div>
                            {editingNotes ? (
                                <div>
                                    <textarea
                                        value={tempNotes}
                                        onChange={(e) => setTempNotes(e.target.value)}
                                        rows={6}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '2px solid #437E84',
                                            fontSize: '14px',
                                            fontFamily: 'inherit',
                                            resize: 'vertical',
                                        }}
                                        autoFocus
                                    />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <button
                                            onClick={saveNotesEdit}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#437E84',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                            }}
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditingNotes(false)}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#E9ECEF',
                                                color: '#4A5568',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    background: '#F8F9FA',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    fontSize: '14px',
                                    color: '#4A5568',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.6',
                                }}>
                                    {college.notes}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Images */}
                    {college.images && college.images.length > 0 && (
                        <div style={{ marginBottom: '48px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1A202C', marginBottom: '12px' }}>
                                Images ({college.images.length})
                            </h2>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: '16px',
                            }}>
                                {college.images.map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img}
                                        alt={`College ${idx + 1}`}
                                        style={{
                                            width: '100%',
                                            height: '200px',
                                            objectFit: 'cover',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => setSelectedImageUrl(img)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prompts Section */}
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1A202C', margin: 0 }}>
                                Essay Prompts ({prompts.length})
                            </h2>
                            {!isAddingPrompt && (
                                <button
                                    onClick={() => setIsAddingPrompt(true)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#437E84',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                    Add Prompt
                                </button>
                            )}
                        </div>

                        {isAddingPrompt && (
                            <div style={{
                                background: '#F9FAFB',
                                padding: '16px',
                                borderRadius: '8px',
                                marginBottom: '16px',
                                border: '1px solid #E5E7EB'
                            }}>
                                <input
                                    type="text"
                                    value={newPromptText}
                                    onChange={(e) => setNewPromptText(e.target.value)}
                                    placeholder="Enter prompt text..."
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #D1D5DB',
                                        fontSize: '14px',
                                        marginBottom: '8px'
                                    }}
                                    autoFocus
                                />
                                <input
                                    type="number"
                                    value={newPromptWordLimit}
                                    onChange={(e) => setNewPromptWordLimit(e.target.value)}
                                    placeholder="Word limit (optional)"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #D1D5DB',
                                        fontSize: '14px',
                                        marginBottom: '12px'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setIsAddingPrompt(false)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #D1D5DB',
                                            background: 'white',
                                            color: '#374151',
                                            fontSize: '13px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddPrompt}
                                        disabled={!newPromptText.trim()}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            background: '#437E84',
                                            color: 'white',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            opacity: newPromptText.trim() ? 1 : 0.5
                                        }}
                                    >
                                        Save Prompt
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {prompts.map(prompt => (
                                <div
                                    key={prompt.id}
                                    style={{
                                        background: 'white',
                                        padding: '16px',
                                        borderRadius: '8px',
                                        border: '1px solid #E5E7EB',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: '16px'
                                    }}
                                >
                                    <div>
                                        <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: '1.5' }}>
                                            {prompt.promptText}
                                        </p>
                                        {prompt.wordLimit && (
                                            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', fontStyle: 'italic' }}>
                                                Word limit: {prompt.wordLimit}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => router.push(`/essays?view=Colleges&collegeId=${collegeId}`)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #D1D5DB',
                                            background: 'white',
                                            color: '#437E84',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_note</span>
                                        Manage
                                    </button>
                                </div>
                            ))}
                            {prompts.length === 0 && !isAddingPrompt && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#9CA3AF', fontSize: '14px', background: '#F9FAFB', borderRadius: '8px' }}>
                                    No prompts added yet.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Essays Section */}
                    {essays.length > 0 && (
                        <div style={{ marginBottom: '48px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1A202C', marginBottom: '16px' }}>
                                Essays for {college.collegeName} ({essays.length})
                            </h2>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '16px',
                            }}>
                                {essays.map((essay) => {
                                    const statusColor = getStatusColor(essay.status);
                                    return (
                                        <div
                                            key={essay.id}
                                            onClick={() => router.push('/essays')}
                                            style={{
                                                background: 'white',
                                                borderRadius: '8px',
                                                border: `2px solid ${statusColor.text}`,
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                height: '220px',
                                                position: 'relative',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        >
                                            {/* Status Badge */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '8px',
                                                    left: '8px',
                                                    padding: '3px 8px',
                                                    borderRadius: '10px',
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    background: statusColor.bg,
                                                    color: statusColor.text,
                                                    zIndex: 5,
                                                }}
                                            >
                                                {essay.status || 'Idea'}
                                            </div>

                                            {/* Document Preview Area */}
                                            <div
                                                style={{
                                                    flex: 1,
                                                    background: 'linear-gradient(180deg, #F8F9FA 0%, #FFFFFF 100%)',
                                                    padding: '32px 12px 12px 12px',
                                                    borderBottom: '1px solid #E9ECEF',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: '9px',
                                                        lineHeight: '1.4',
                                                        color: '#6B7280',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 6,
                                                        WebkitBoxOrient: 'vertical',
                                                    }}
                                                >
                                                    {essay.idea}
                                                </div>
                                            </div>

                                            {/* Document Info Area */}
                                            <div
                                                style={{
                                                    padding: '10px 12px',
                                                    background: 'white',
                                                }}
                                            >
                                                <h3
                                                    style={{
                                                        fontSize: '13px',
                                                        fontWeight: '500',
                                                        color: '#202124',
                                                        margin: 0,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {essay.title}
                                                </h3>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Delete Button - At Bottom */}
                    <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #E9ECEF' }}>
                        <button
                            onClick={deleteCollege}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: '1px solid #DC2626',
                                background: 'white',
                                color: '#DC2626',
                                cursor: 'pointer',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                            Delete College
                        </button>
                    </div>
                </main>
            </div>

            {/* Image Lightbox */}
            {selectedImageUrl && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1001,
                    }}
                    onClick={() => setSelectedImageUrl(null)}
                >
                    <img
                        src={selectedImageUrl}
                        alt="Full size"
                        style={{
                            maxWidth: '90%',
                            maxHeight: '90%',
                            objectFit: 'contain',
                            borderRadius: '8px',
                        }}
                    />
                    <button
                        onClick={() => setSelectedImageUrl(null)}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            )}
        </div>
    );
}

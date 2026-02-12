'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../dashboard/dashboard.module.css';
import Sidebar from '@/components/Sidebar';

interface UserData {
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
    role?: 'student' | 'consultant' | 'admin';
}

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

interface Counts {
    activities: number;
    honors: number;
    tests: number;
    essays: number;
    colleges: number;
}

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
        religious: 'Religious 🙏',
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

export default function Activities() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });
    const router = useRouter();

    const [showModal, setShowModal] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [formData, setFormData] = useState({
        organizationName: '',
        activityType: 'academic',
        position: '',
        description: '',
        gradeLevels: [] as number[],
        hoursPerWeek: '',
        weeksPerYear: '',
        participateInCollege: false,
        participationTiming: 'School Year'
    });

    const handleAddActivity = () => {
        setEditingActivity(null);
        setFormData({
            organizationName: '',
            activityType: 'academic',
            position: '',
            description: '',
            gradeLevels: [],
            hoursPerWeek: '',
            weeksPerYear: '',
            participateInCollege: false,
            participationTiming: 'School Year'
        });
        setShowModal(true);
    };

    const handleEditActivity = (activity: Activity) => {
        setEditingActivity(activity);
        setFormData({
            organizationName: activity.organizationName,
            activityType: activity.activityType,
            position: activity.position,
            description: activity.description,
            gradeLevels: activity.gradeLevels,
            hoursPerWeek: activity.hoursPerWeek,
            weeksPerYear: activity.weeksPerYear,
            participateInCollege: activity.participateInCollege,
            participationTiming: activity.participationTiming || 'School Year'
        });
        setShowModal(true);
    };

    const handleSaveActivity = async () => {
        if (!user) return;

        if (!formData.organizationName || !formData.position) {
            alert('Please fill in at least the Organization Name and Position.');
            return;
        }

        try {
            const activityData = {
                organizationName: formData.organizationName,
                activityType: formData.activityType,
                position: formData.position,
                description: formData.description,
                gradeLevels: formData.gradeLevels,
                hoursPerWeek: formData.hoursPerWeek,
                weeksPerYear: formData.weeksPerYear,
                participateInCollege: formData.participateInCollege,
                participationTiming: formData.participationTiming
            };

            if (editingActivity) {
                await updateDoc(doc(db, 'users', user.uid, 'activities', editingActivity.id), activityData);
                setActivities(prev => prev.map(a => a.id === editingActivity.id ? { ...a, ...activityData } : a));
            } else {
                const docRef = await addDoc(collection(db, 'users', user.uid, 'activities'), activityData);
                setActivities(prev => [...prev, { id: docRef.id, ...activityData }]);
                setCounts(prev => ({ ...prev, activities: prev.activities + 1 }));
            }
            setShowModal(false);
        } catch (error) {
            console.error('Error saving activity:', error);
            alert('Failed to save activity');
        }
    };

    const toggleGradeLevel = (grade: number) => {
        setFormData(prev => {
            const levels = prev.gradeLevels.includes(grade)
                ? prev.gradeLevels.filter(g => g !== grade)
                : [...prev.gradeLevels, grade].sort((a, b) => a - b);
            return { ...prev, gradeLevels: levels };
        });
    };

    const fetchActivities = async (userId: string) => {
        try {
            const activitiesSnapshot = await getDocs(collection(db, 'users', userId, 'activities'));
            const activitiesData = activitiesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Activity[];
            setActivities(activitiesData);
        } catch (error) {
            console.error('Error fetching activities:', error);
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

                await fetchActivities(user.uid);

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

    const toggleActivityVisibility = (activityId: string) => {
        setExpandedActivities((prev) => ({
            ...prev,
            [activityId]: !prev[activityId],
        }));
    };

    const handleDelete = async (activityId: string) => {
        if (!user) return;

        if (confirm('Are you sure you want to delete this activity? This cannot be undone.')) {
            try {
                await deleteDoc(doc(db, 'users', user.uid, 'activities', activityId));
                setActivities((prev) => prev.filter((activity) => activity.id !== activityId));
                setCounts((prev) => ({ ...prev, activities: prev.activities - 1 }));
            } catch (error) {
                console.error('Error deleting activity:', error);
                alert('Failed to delete activity. Please try again.');
            }
        }
    };

    const handleToggleStar = async (activityId: string, currentStatus?: boolean) => {
        if (!user) return;

        const starredCount = activities.filter(a => a.isStarred).length;
        if (!currentStatus && starredCount >= 10) {
            alert('You can only star up to 10 activities (Common App limit).');
            return;
        }

        try {
            await updateDoc(doc(db, 'users', user.uid, 'activities', activityId), {
                isStarred: !currentStatus
            });
            setActivities(prev => prev.map(a => a.id === activityId ? { ...a, isStarred: !currentStatus } : a));
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
                    userRole={userData?.role as any}
                    counts={counts}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/activities"
                />

                <main className={styles.centerContent}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h1 className={styles.pageTitle}>Activities</h1>
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
                                Starred: {activities.filter(a => a.isStarred).length}/10
                            </div>
                            <button
                                onClick={handleAddActivity}
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
                                Add Activity
                            </button>
                        </div>
                    </div>

                    {!loading && activities.length > 0 && (
                        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                placeholder="Search activities..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    flex: '1',
                                    minWidth: '200px',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '14px',
                                    fontFamily: 'DMSans, sans-serif',
                                }}
                            />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '2px solid #e2e8f0',
                                    fontSize: '14px',
                                    fontFamily: 'DMSans, sans-serif',
                                    minWidth: '180px',
                                }}
                            >
                                <option value="all">All Types</option>
                                <option value="starred">Starred ⭐</option>
                                <option value="academic">Academic 📖</option>
                                <option value="sciencemath">Science/Math 🧪</option>
                                <option value="research">Research 🔬</option>
                                <option value="tech">Tech 📡</option>
                                <option value="robotics">Robotics 🤖</option>
                                <option value="athlete">Athletics 🏆</option>
                                <option value="clubAthlete">Club Athletics 🏅</option>
                                <option value="art">Art 🎨</option>
                                <option value="instrumental">Instrumental Music 🎷</option>
                                <option value="vocal">Singing 🎤</option>
                                <option value="dance">Dance 🕺</option>
                                <option value="theater">Theater 🎭</option>
                                <option value="volunteer">Volunteering ☺️</option>
                                <option value="environmental">Environmental 🌱</option>
                                <option value="justice">Social Justice ✊</option>
                                <option value="politics">Politics/Student Government 👩‍⚖️</option>
                                <option value="career">Career-Oriented 🏢</option>
                                <option value="internship">Internship 📈</option>
                                <option value="work">Job 💵</option>
                                <option value="journalism">Journalism 📰</option>
                                <option value="speech">Speech/Debate 💼</option>
                                <option value="religious">Religious 🙏</option>
                                <option value="cultural">Cultural 🌎</option>
                                <option value="lgbt">LGBT+ 🏳️‍🌈</option>
                                <option value="family">Family 👨‍👩‍👧‍👦</option>
                                <option value="schoolspirit">School Spirit 🎉</option>
                                <option value="foreign">Foreign Exchange ✈️</option>
                                <option value="rotc">Jr. R.O.T.C. 🇺🇸</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    )}

                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingImage}>
                                <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                            </div>
                            <div className={styles.loading}>Loading activities...</div>
                        </div>
                    ) : activities.length === 0 ? (
                        <div className={styles.placeholderCard}>
                            <div className={styles.placeholderIcon}>
                                <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#437E84' }}>edit_note</span>
                            </div>
                            <h2 className={styles.placeholderTitle}>No Activities Yet</h2>
                            <p className={styles.placeholderText}>
                                You haven't added any activities yet. Activities help showcase your extracurricular involvement, leadership positions, and achievements.
                            </p>
                            <p className={styles.placeholderSubtext}>
                                Add your first activity to get started!
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {Object.entries(
                                activities
                                    .filter((activity) => {
                                        const matchesSearch =
                                            activity.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            activity.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            activity.description.toLowerCase().includes(searchQuery.toLowerCase());
                                        const matchesFilter = filterType === 'all'
                                            ? true
                                            : filterType === 'starred'
                                                ? activity.isStarred
                                                : activity.activityType === filterType;
                                        return matchesSearch && matchesFilter;
                                    })
                                    .reduce((groups, activity) => {
                                        const type = activity.activityType;
                                        if (!groups[type]) {
                                            groups[type] = [];
                                        }
                                        groups[type].push(activity);
                                        return groups;
                                    }, {} as Record<string, Activity[]>)
                            ).map(([type, groupActivities]) => {
                                const typeColors: Record<string, string> = {
                                    academic: '#2563EB',
                                    sciencemath: '#7C3AED',
                                    research: '#4F46E5',
                                    tech: '#0891B2',
                                    robotics: '#0D9488',
                                    athlete: '#DC2626',
                                    clubAthlete: '#EA580C',
                                    art: '#BE185D',
                                    instrumental: '#7E22CE',
                                    vocal: '#9333EA',
                                    dance: '#BE123C',
                                    theater: '#9F1239',
                                    volunteer: '#059669',
                                    environmental: '#047857',
                                    justice: '#B91C1C',
                                    politics: '#6D28D9',
                                    career: '#1D4ED8',
                                    internship: '#0369A1',
                                    work: '#0E7490',
                                    journalism: '#B45309',
                                    speech: '#A16207',
                                    religious: '#6D28D9',
                                    cultural: '#B45309',
                                    lgbt: '#BE185D',
                                    family: '#C2410C',
                                    schoolspirit: '#A16207',
                                    foreign: '#0891B2',
                                    rotc: '#B91C1C',
                                    other: '#4B5563',
                                };
                                const color = typeColors[type] || typeColors.other;

                                return (
                                    <div key={type} style={{ marginBottom: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                            <h2 style={{ fontSize: '18px', fontWeight: '700', color: color, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {getActivityTypeLabel(type)}
                                            </h2>
                                            <div style={{ height: '1px', flex: 1, background: '#E2E8F0' }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                            {groupActivities.map((activity) => (
                                                <div
                                                    key={activity.id}
                                                    style={{
                                                        background: 'white',
                                                        borderRadius: '12px',
                                                        border: '1px solid #E2E8F0',
                                                        padding: '16px',
                                                        transition: 'all 0.2s ease',
                                                        cursor: 'pointer',
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                                                    }}
                                                    onClick={() => toggleActivityVisibility(activity.id)}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                                        e.currentTarget.style.borderColor = '#CBD5E1';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                                                        e.currentTarget.style.borderColor = '#E2E8F0';
                                                    }}
                                                >
                                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: color }} />

                                                    <div style={{ paddingLeft: '12px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                            <div>
                                                                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', margin: '0 0 4px 0', lineHeight: '1.4' }}>
                                                                    {activity.organizationName}
                                                                </h3>
                                                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                                                    {activity.position}
                                                                </p>
                                                            </div>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#9CA3AF', flexShrink: 0 }}>
                                                                {expandedActivities[activity.id] ? 'expand_less' : 'expand_more'}
                                                            </span>
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleStar(activity.id, activity.isStarred);
                                                            }}
                                                            style={{
                                                                position: 'absolute',
                                                                top: '12px',
                                                                right: '40px',
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: '4px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                zIndex: 10
                                                            }}
                                                            title={activity.isStarred ? "Unstar activity" : "Star activity"}
                                                        >
                                                            <span
                                                                className="material-symbols-outlined"
                                                                style={{
                                                                    fontSize: '22px',
                                                                    color: activity.isStarred ? '#F59E0B' : '#D1D5DB',
                                                                    fontVariationSettings: activity.isStarred ? "'FILL' 1" : "'FILL' 0"
                                                                }}
                                                            >
                                                                star
                                                            </span>
                                                        </button>

                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: expandedActivities[activity.id] ? '12px' : '0' }}>
                                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#F3F4F6', color: '#4B5563', fontWeight: '500' }}>
                                                                Grades: {activity.gradeLevels.join(', ')}
                                                            </span>
                                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#F3F4F6', color: '#4B5563', fontWeight: '500' }}>
                                                                {activity.participationTiming}
                                                            </span>
                                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#F3F4F6', color: '#4B5563', fontWeight: '500' }}>
                                                                {activity.hoursPerWeek}h/wk • {activity.weeksPerYear}w/yr
                                                            </span>
                                                        </div>

                                                        {expandedActivities[activity.id] && (
                                                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F3F4F6' }}>
                                                                <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.5', marginBottom: '16px' }}>
                                                                    {activity.description}
                                                                </p>

                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ fontSize: '12px', color: activity.participateInCollege ? '#059669' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        {activity.participateInCollege && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>school</span>}
                                                                        {activity.participateInCollege ? 'College Interest' : ''}
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleEditActivity(activity); }}
                                                                            style={{
                                                                                padding: '4px 10px',
                                                                                background: 'white',
                                                                                border: '1px solid #D1D5DB',
                                                                                borderRadius: '6px',
                                                                                fontSize: '12px',
                                                                                fontWeight: '500',
                                                                                color: '#374151',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleDelete(activity.id); }}
                                                                            style={{
                                                                                padding: '4px 10px',
                                                                                background: '#FEF2F2',
                                                                                border: '1px solid #FECACA',
                                                                                borderRadius: '6px',
                                                                                fontSize: '12px',
                                                                                fontWeight: '500',
                                                                                color: '#DC2626',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.keys(
                                activities
                                    .filter((activity) => {
                                        const matchesSearch =
                                            activity.organizationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            activity.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            activity.description.toLowerCase().includes(searchQuery.toLowerCase());
                                        const matchesFilter = filterType === 'all'
                                            ? true
                                            : filterType === 'starred'
                                                ? activity.isStarred
                                                : activity.activityType === filterType;
                                        return matchesSearch && matchesFilter;
                                    })
                                    .reduce((groups, activity) => {
                                        const type = activity.activityType;
                                        if (!groups[type]) {
                                            groups[type] = [];
                                        }
                                        groups[type].push(activity);
                                        return groups;
                                    }, {} as Record<string, Activity[]>)
                            ).length === 0 && (
                                    <div className={styles.placeholderCard}>
                                        <div className={styles.placeholderIcon}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#437E84' }}>search_off</span>
                                        </div>
                                        <h2 className={styles.placeholderTitle}>No Activities Found</h2>
                                        <p className={styles.placeholderText}>
                                            No activities match your search or filter criteria. Try adjusting your search or selecting a different activity type.
                                        </p>
                                    </div>
                                )}
                        </div>
                    )}
                </main>
            </div>

            {/* Add/Edit Activity Modal */}
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
                            maxWidth: '600px',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px', color: '#1F2937' }}>
                            {editingActivity ? 'Edit Activity' : 'Add Activity'}
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                    Activity Type
                                </label>
                                <select
                                    value={formData.activityType}
                                    onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                                >
                                    <option value="academic">Academic 📖</option>
                                    <option value="art">Art 🎨</option>
                                    <option value="athlete">Athletics 🏆</option>
                                    <option value="career">Career-Oriented 🏢</option>
                                    <option value="volunteer">Volunteering ☺️</option>
                                    <option value="tech">Tech 📡</option>
                                    <option value="cultural">Cultural 🌎</option>
                                    <option value="dance">Dance 🕺</option>
                                    <option value="speech">Speech/Debate 💼</option>
                                    <option value="environmental">Environmental 🌱</option>
                                    <option value="family">Family 👨‍👩‍👧‍👦</option>
                                    <option value="foreign">Foreign Exchange ✈️</option>
                                    <option value="internship">Internship 📈</option>
                                    <option value="journalism">Journalism 📰</option>
                                    <option value="rotc">Jr. R.O.T.C. 🇺🇸</option>
                                    <option value="lgbt">LGBT+ 🏳️‍🌈</option>
                                    <option value="instrumental">Instrumental Music 🎷</option>
                                    <option value="vocal">Singing 🎤</option>
                                    <option value="religious">Religious 🙏</option>
                                    <option value="research">Research 🔬</option>
                                    <option value="robotics">Robotics 🤖</option>
                                    <option value="schoolspirit">School Spirit 🎉</option>
                                    <option value="sciencemath">Science/Math 🧪</option>
                                    <option value="justice">Social Justice ✊</option>
                                    <option value="politics">Politics/Student Government 👩‍⚖️</option>
                                    <option value="theater">Theater 🎭</option>
                                    <option value="work">Job 💵</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                    Position/Role
                                </label>
                                <input
                                    type="text"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    placeholder="e.g. Member, Captain"
                                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                Organization Name
                            </label>
                            <input
                                type="text"
                                value={formData.organizationName}
                                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                                placeholder="e.g. Math Club, Varsity Soccer"
                                style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe your involvement and achievements..."
                                rows={4}
                                style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '6px', resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                Grade Levels
                            </label>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                {[9, 10, 11, 12].map(grade => (
                                    <label key={grade} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.gradeLevels.includes(grade)}
                                            onChange={() => toggleGradeLevel(grade)}
                                        />
                                        Grade {grade}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                    Timing
                                </label>
                                <select
                                    value={formData.participationTiming}
                                    onChange={(e) => setFormData({ ...formData, participationTiming: e.target.value })}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                                >
                                    <option value="School Year">School Year</option>
                                    <option value="Break">Break</option>
                                    <option value="All Year">All Year</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                    Hours/Week
                                </label>
                                <input
                                    type="number"
                                    value={formData.hoursPerWeek}
                                    onChange={(e) => setFormData({ ...formData, hoursPerWeek: e.target.value })}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                                    Weeks/Year
                                </label>
                                <input
                                    type="number"
                                    value={formData.weeksPerYear}
                                    onChange={(e) => setFormData({ ...formData, weeksPerYear: e.target.value })}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.participateInCollege}
                                    onChange={(e) => setFormData({ ...formData, participateInCollege: e.target.checked })}
                                />
                                <span style={{ fontSize: '14px', color: '#374151' }}>I intend to participate in a similar activity in college</span>
                            </label>
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
                                onClick={handleSaveActivity}
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
                                {editingActivity ? 'Save Changes' : 'Add Activity'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useEffect } from 'react';
import styles from '../dashboard/dashboard.module.css';
import Sidebar from '@/components/Sidebar';

import { motion, AnimatePresence } from 'framer-motion';

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

const sectionIcons: { [key: string]: string } = {
    'Location': '📍',
    'Academics': '📚',
    'School Pride': '🦁',
    'Athletics': '🏆',
    'Affordability': '💰',
    'Party Scene': '🎉',
    'Dorms': '🛏️',
    'Campus': '🌳',
    'Safety': '🛡️',
};

export default function CollegeSearch() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });

    // Form state
    const [selectedButtons, setSelectedButtons] = useState<{ [key: string]: string }>({});
    const [notes, setNotes] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [travelDistance, setTravelDistance] = useState('');
    const [studyInterest, setStudyInterest] = useState('');
    const [sportPlayed, setSportPlayed] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sections = [
        'Location',
        'Academics',
        'School Pride',
        'Athletics',
        'Affordability',
        'Party Scene',
        'Dorms',
        'Campus',
        'Safety',
    ];

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
            } catch (error) {
                console.error('Error fetching data:', error);
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

    const handleButtonPress = (section: string, value: string) => {
        setSelectedButtons((prev) => {
            if (prev[section] === value) {
                // Deselect
                if (section === 'Location') {
                    setLocationInput('');
                    setTravelDistance('');
                }
                if (section === 'StudyInterest') {
                    setStudyInterest('');
                }
                if (section === 'Athletics') {
                    setSportPlayed('');
                }
                const newState = { ...prev };
                delete newState[section];
                return newState;
            }

            if (section === 'Location' && value === 'not') {
                setLocationInput('');
                setTravelDistance('');
            }
            if (section === 'StudyInterest' && value === 'IDK') {
                setStudyInterest('');
            }
            return { ...prev, [section]: value };
        });
    };

    const handleSearch = async () => {
        setLoading(true);
        setError(null);

        try {
            // Format priorities
            const veryImportant = Object.entries(selectedButtons)
                .filter(
                    ([key, value]) =>
                        value === 'very' &&
                        !['StudyInterest', 'Application', 'Spectator', 'IvyLeague'].includes(key)
                )
                .map(([key]) => key.toLowerCase());

            const requestBody = {
                priorities: veryImportant.length > 0 ? veryImportant.join(', ') : 'none specified',
                location: locationInput || 'not specified',
                distance: travelDistance || 'not specified',
                major: studyInterest || 'not specified',
                sport: sportPlayed || 'none',
                notes: notes || 'none',
            };

            console.log('Sending request:', requestBody);

            const response = await fetch('/api/college-recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received recommendations:', data);

            // Navigate to results page with data
            router.push(`/college-recommendations?data=${encodeURIComponent(JSON.stringify(data))}`);
        } catch (error: any) {
            console.error('Error fetching recommendations:', error);
            setError(error.message);
        } finally {
            setLoading(false);
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
                    currentPath="/college-search"
                />

                <main className={styles.centerContent}>
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ marginBottom: '40px', textAlign: 'center' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                            <h1 className={styles.pageTitle} style={{
                                margin: 0,
                                background: 'linear-gradient(135deg, #437E84 0%, #2C5282 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                fontSize: '48px',
                                fontWeight: '800'
                            }}>
                                Find Your Dream School
                            </h1>
                            <motion.img
                                src="/assets/flyingAIsmile.png"
                                alt="Neil"
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.85 }}
                                style={{ height: '100px' }}
                            />
                        </div>
                        <p style={{ fontSize: '18px', color: '#718096', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                            Tell us what matters most and Neil will help find the perfect colleges for you! ✨
                        </p>
                    </motion.div>

                    <div style={{ marginBottom: '32px', marginTop: "-20px" }}>
                        <motion.h2
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px', color: '#2D3748', display: 'flex', alignItems: 'center', gap: '12px' }}
                        >
                            <span style={{ background: '#E6FFFA', padding: '8px', borderRadius: '12px' }}>⭐</span> How important is...
                        </motion.h2>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '24px',
                                marginBottom: '40px'
                            }}
                        >
                            {sections.map((section, index) => (
                                <motion.div
                                    key={section}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    style={{
                                        background: '#FFFFFF',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                                        border: '1px solid #E2E8F0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '16px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '24px' }}>{sectionIcons[section]}</span>
                                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#2D3748' }}>
                                            {section}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', background: '#F7FAFC', padding: '4px', borderRadius: '12px' }}>
                                        {['not', 'a little', 'very'].map((value) => (
                                            <motion.button
                                                key={value}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handleButtonPress(section, value)}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px 12px',
                                                    borderRadius: '8px',
                                                    background: selectedButtons[section] === value ? '#437E84' : 'transparent',
                                                    color: selectedButtons[section] === value ? '#FFFFFF' : '#718096',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    fontWeight: selectedButtons[section] === value ? '600' : '500',
                                                    transition: 'background-color 0.2s, color 0.2s',
                                                    boxShadow: selectedButtons[section] === value ? '0 2px 4px rgba(67, 126, 132, 0.2)' : 'none',
                                                }}
                                            >
                                                {value}
                                            </motion.button>
                                        ))}
                                    </div>

                                    <AnimatePresence>
                                        {/* Location conditional inputs */}
                                        {section === 'Location' &&
                                            (selectedButtons[section] === 'very' || selectedButtons[section] === 'a little') && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <p style={{ fontSize: '12px', color: '#718096', marginBottom: '12px', fontStyle: 'italic' }}>
                                                        Neil can understand plain text- describe what you want like you're talking to a friend!
                                                    </p>
                                                    <input
                                                        type="text"
                                                        value={locationInput}
                                                        onChange={(e) => setLocationInput(e.target.value)}
                                                        placeholder='Where do you want to be?'
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px',
                                                            borderRadius: '8px',
                                                            border: '2px solid #E2E8F0',
                                                            fontSize: '14px',
                                                            marginBottom: '8px',
                                                            background: '#F8FAFC'
                                                        }}
                                                    />
                                                    <p style={{ fontSize: '12px', color: '#718096', marginBottom: '12px', fontStyle: 'italic' }}>
                                                        i.e. "New York, NY"; "West Coast"; or "90210"
                                                    </p>
                                                    <input
                                                        type="text"
                                                        value={travelDistance}
                                                        onChange={(e) => setTravelDistance(e.target.value)}
                                                        placeholder='How close do you want to be?'
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px',
                                                            borderRadius: '8px',
                                                            border: '2px solid #E2E8F0',
                                                            fontSize: '14px',
                                                            marginBottom: '8px',
                                                            background: '#F8FAFC'
                                                        }}
                                                    />
                                                    <p style={{ fontSize: '12px', color: '#718096', marginBottom: '12px', fontStyle: 'italic' }}>
                                                        i.e. "3 hour drive"; "in-state"; or "a short flight"
                                                    </p>
                                                </motion.div>
                                            )}

                                        {/* Academics - Ivy League question */}
                                        {section === 'Academics' && selectedButtons[section] === 'very' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                style={{ overflow: 'hidden', paddingTop: '8px' }}
                                            >
                                                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#4A5568' }}>
                                                    Do you want to go to an Ivy League school? 🌿
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {['yes', 'no', 'maybe'].map((value) => (
                                                        <button
                                                            key={value}
                                                            onClick={() => handleButtonPress('IvyLeague', value)}
                                                            style={{
                                                                flex: 1,
                                                                padding: '8px',
                                                                borderRadius: '6px',
                                                                background: selectedButtons['IvyLeague'] === value ? '#437E84' : '#EDF2F7',
                                                                color: selectedButtons['IvyLeague'] === value ? '#FFFFFF' : '#4A5568',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                fontSize: '12px',
                                                                fontWeight: '600',
                                                            }}
                                                        >
                                                            {value}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Athletics - Sport input */}
                                        {section === 'Athletics' &&
                                            (selectedButtons[section] === 'very' || selectedButtons[section] === 'a little') && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <input
                                                        type="text"
                                                        value={sportPlayed}
                                                        onChange={(e) => setSportPlayed(e.target.value)}
                                                        placeholder='Which sport do you want to play?'
                                                        disabled={selectedButtons['Spectator'] === 'true'}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px',
                                                            borderRadius: '8px',
                                                            border: '2px solid #E2E8F0',
                                                            fontSize: '14px',
                                                            marginBottom: '8px',
                                                            opacity: selectedButtons['Spectator'] === 'true' ? 0.5 : 1,
                                                            background: '#F8FAFC'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => handleButtonPress('Spectator', 'true')}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px',
                                                            borderRadius: '8px',
                                                            background: selectedButtons['Spectator'] === 'true' ? '#437E84' : '#EDF2F7',
                                                            color: selectedButtons['Spectator'] === 'true' ? '#FFFFFF' : '#4A5568',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                        }}
                                                    >
                                                        I just want to watch! 📣
                                                    </button>
                                                </motion.div>
                                            )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </motion.div>

                        {/* Study Interest Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            style={{
                                background: '#FFFFFF',
                                borderRadius: '16px',
                                padding: '24px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                                border: '1px solid #E2E8F0',
                                marginBottom: '24px'
                            }}
                        >
                            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#2D3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🎓</span> What are you interested in studying?
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={studyInterest}
                                    onChange={(e) => setStudyInterest(e.target.value)}
                                    placeholder='e.g. Computer Science, Biology, History...'
                                    disabled={selectedButtons.StudyInterest === 'IDK'}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        borderRadius: '12px',
                                        border: '2px solid #E2E8F0',
                                        fontSize: '15px',
                                        opacity: selectedButtons.StudyInterest === 'IDK' ? 0.5 : 1,
                                        background: '#F8FAFC',
                                        transition: 'all 0.2s'
                                    }}
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleButtonPress('StudyInterest', 'IDK')}
                                    style={{
                                        padding: '14px 24px',
                                        borderRadius: '12px',
                                        background: selectedButtons.StudyInterest === 'IDK' ? '#437E84' : '#EDF2F7',
                                        color: selectedButtons.StudyInterest === 'IDK' ? '#FFFFFF' : '#4A5568',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    I'm not sure yet 🤷‍♂️
                                </motion.button>
                            </div>
                        </motion.div>

                        {/* Notes Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                            style={{
                                background: '#FFFFFF',
                                borderRadius: '16px',
                                padding: '24px',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                                border: '1px solid #E2E8F0',
                                marginBottom: '32px'
                            }}
                        >
                            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#2D3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>📝</span> Other notes (dealbreakers, size, etc.)
                            </div>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Tell us anything else you do or don't want! Big school? Small school? Near a beach? Urban? A particular club?"
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: '2px solid #E2E8F0',
                                    fontSize: '15px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    background: '#F8FAFC'
                                }}
                            />
                        </motion.div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '12px',
                                        background: '#FEE2E2',
                                        color: '#DC2626',
                                        marginBottom: '24px',
                                        fontSize: '15px',
                                        fontWeight: '500',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <span>⚠️</span> {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Search Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSearch}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '20px',
                                borderRadius: '16px',
                                background: loading ? '#CBD5E0' : 'linear-gradient(135deg, #437E84 0%, #2C5282 100%)',
                                color: '#FFFFFF',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '18px',
                                fontWeight: '700',
                                marginBottom: '16px',
                                boxShadow: '0 4px 12px rgba(67, 126, 132, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px'
                            }}
                        >
                            {loading ? (
                                <>Searching... 🔍</>
                            ) : (
                                <>Find My Colleges!</>
                            )}
                        </motion.button>
                    </div>
                </main>
            </div>
        </div>
    );
}

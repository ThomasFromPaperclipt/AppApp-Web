'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../dashboard/dashboard.module.css';
import ReactMarkdown from 'react-markdown';
import Sidebar from '@/components/Sidebar';

import { motion } from 'framer-motion';

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

interface CollegeRecommendation {
    id: number;
    type: string;
    name: string;
    content: string;
}

// Helper function to strip markdown formatting from text
const stripMarkdown = (text: string): string => {
    return text
        // Remove headers (# ## ### etc.)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic markers
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove inline code
        .replace(/`([^`]+)`/g, '$1')
        // Remove links but keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove bullet points
        .replace(/^[\s]*[-*+]\s+/gm, '')
        // Remove numbered lists
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // Remove blockquotes
        .replace(/^>\s+/gm, '')
        // Remove horizontal rules
        .replace(/^[-*_]{3,}$/gm, '')
        // Clean up extra whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export default function CollegeRecommendations() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<User | null>(null);
    console.log('CollegeRecommendations render. User:', user?.uid);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [counts, setCounts] = useState<Counts>({
        activities: 0,
        honors: 0,
        tests: 0,
        essays: 0,
        colleges: 0,
    });
    const [recommendations, setRecommendations] = useState<any>(null);
    const [parsedContent, setParsedContent] = useState<{ intro: string; colleges: CollegeRecommendation[] } | null>(null);

    useEffect(() => {
        console.log('Setting up auth listener');
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed. User:', user?.uid);
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

        // Parse recommendations from URL params
        const dataParam = searchParams.get('data');
        if (dataParam) {
            try {
                const parsedData = JSON.parse(dataParam);
                setRecommendations(parsedData);

                // Parse the text content
                const text = typeof parsedData === 'string' ? parsedData : parsedData.text;
                if (text) {
                    const lines = text.split('\n');
                    let intro = '';
                    const colleges: CollegeRecommendation[] = [];
                    let currentCollege: CollegeRecommendation | null = null;
                    let collegeCounter = 0;
                    let inIntro = true;

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];

                        // Robust header matching:
                        // 1. Markdown headers: ## Name, ### Name
                        // 2. Bolded lines that look like headers: **Name**
                        // 3. Numbered lists that look like headers: 1. Name

                        const headerMatch = line.match(/^(?:#{1,6}|(?:\d+\.)|\*+)\s+(.+?)(?:\*+)?$/);
                        const isLikelyHeader = headerMatch && (line.startsWith('#') || /^\d+\./.test(line) || (line.startsWith('**') && line.endsWith('**')));

                        if (isLikelyHeader) {
                            // Found a new college heading
                            if (currentCollege) {
                                currentCollege.content = currentCollege.content.trim();
                                colleges.push(currentCollege);
                            }

                            inIntro = false;
                            collegeCounter++;

                            let headerText = headerMatch[1].trim();

                            // Clean up common prefixes/suffixes
                            // Remove leading numbers, dots, and ANY asterisks/spaces at the start
                            headerText = headerText.replace(/^[\d\.\s\*]+/, '').replace(/\*+$/, '').trim();

                            // Extract type if present (e.g. "REACH: Name", "SAFER BET: Name")
                            const typeMatch = headerText.match(/^(REACH|TARGET|MATCH|SAFETY|SAFER|SAFER BET|LIKELY):\s*(.+)$/i);

                            let type = 'COLLEGE';
                            let name = headerText;

                            if (typeMatch) {
                                type = typeMatch[1].toUpperCase();
                                name = typeMatch[2].trim();
                            }

                            // Double check for any remaining asterisks at the start of the name
                            name = name.replace(/^[\*\s]+/, '').replace(/[\*\s]+$/, '');

                            currentCollege = {
                                id: collegeCounter,
                                type: type,
                                name: name,
                                content: ''
                            };
                        } else if (currentCollege) {
                            currentCollege.content += line + '\n';
                        } else if (inIntro) {
                            intro += line + '\n';
                        }
                    }

                    // Don't forget to add the last college
                    if (currentCollege) {
                        currentCollege.content = currentCollege.content.trim();
                        colleges.push(currentCollege);
                    }

                    setParsedContent({ intro: intro.trim(), colleges });
                }

            } catch (error) {
                console.error('Error parsing recommendations:', error);
            }
        }

        return () => unsubscribe();
    }, [router, searchParams]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const getTypeColor = (type: string) => {
        if (type.includes('REACH')) return '#E53E3E'; // Red
        if (type.includes('TARGET') || type.includes('MATCH')) return '#3182CE'; // Blue
        if (type.includes('SAFETY') || type.includes('SAFER') || type.includes('SAFER BET') || type.includes('LIKELY')) return '#38A169'; // Green
        return '#718096'; // Gray
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
                    counts={counts}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/college-recommendations"
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
                                Neil's Top Picks
                            </h1>
                            <motion.img
                                src="/assets/flyingAIsmile.png"
                                alt="Neil"
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                                style={{ height: '80px' }}
                            />
                        </div>
                        <p style={{ fontSize: '18px', color: '#718096', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
                            I've crunched the numbers and found some amazing schools just for you!
                        </p>
                    </motion.div>

                    {parsedContent ? (
                        <div>
                            {/* Intro Section */}
                            {parsedContent.intro && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, delay: 0.3 }}
                                    style={{
                                        background: 'linear-gradient(135deg, #E6FFFA 0%, #EBF8FF 100%)',
                                        padding: '32px',
                                        borderRadius: '24px',
                                        marginBottom: '40px',
                                        border: '2px solid #B2F5EA',
                                        boxShadow: '0 4px 6px rgba(67, 126, 132, 0.1)',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '-16px',
                                        left: '32px',
                                        background: '#38B2AC',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontWeight: '700',
                                        fontSize: '12px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                        MESSAGE FROM NEIL
                                    </div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: '500',
                                        lineHeight: '1.8',
                                        color: '#2C5282'
                                    }}>
                                        <ReactMarkdown>{parsedContent.intro}</ReactMarkdown>
                                    </div>
                                </motion.div>
                            )}

                            {/* College Cards Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr',
                                gap: '32px'
                            }}>
                                {parsedContent.colleges.map((college, index) => (
                                    <motion.div
                                        key={college.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.5 + (index * 0.1) }}
                                    >
                                        <CollegeCard college={college} getTypeColor={getTypeColor} user={user} />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ) : recommendations ? (
                        // Fallback for unparsed content
                        <div style={{
                            background: '#F7FAFC',
                            borderRadius: '12px',
                            padding: '24px',
                            marginBottom: '24px',
                            border: '1px solid #E2E8F0',
                        }}>
                            <div className="markdown-content">
                                <ReactMarkdown>
                                    {typeof recommendations === 'string'
                                        ? recommendations
                                        : recommendations.text || JSON.stringify(recommendations, null, 2)}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: '48px',
                            textAlign: 'center',
                            color: '#718096',
                        }}>
                            No recommendations available. Please search for colleges first.
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '16px', marginTop: '48px', justifyContent: 'center' }}>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push('/college-search')}
                            style={{
                                padding: '16px 32px',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, #437E84 0%, #2C5282 100%)',
                                color: '#FFFFFF',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(67, 126, 132, 0.3)',
                                minWidth: '200px'
                            }}
                        >
                            <span className="material-symbols-outlined">search</span>
                            Start New Search
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push('/dashboard')}
                            style={{
                                padding: '16px 32px',
                                borderRadius: '16px',
                                background: '#FFFFFF',
                                color: '#4A5568',
                                border: '2px solid #E2E8F0',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: '700',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                                minWidth: '200px'
                            }}
                        >
                            Back to Dashboard
                        </motion.button>
                    </div>
                </main>
            </div>
        </div>
    );
}

function CollegeCard({ college, getTypeColor, user }: { college: CollegeRecommendation, getTypeColor: (type: string) => string, user: User | null }) {
    console.log(`CollegeCard render (${college.name}). User prop:`, user?.uid);
    console.log(`CollegeCard render (${college.name}). User prop:`, user?.uid);
    const [isHovered, setIsHovered] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('Attempting to save college:', college.name);

        // Use prop user or fallback to auth.currentUser
        const currentUser = user || auth.currentUser;
        console.log('Current user for save:', currentUser?.uid);

        if (!currentUser) {
            console.error('User is not logged in (checked both prop and auth.currentUser)');
            alert('You must be logged in to save colleges.');
            return;
        }

        if (isSaving || isSaved) {
            console.log('Already saving or saved');
            return;
        }

        setIsSaving(true);
        try {
            const collegeData = {
                collegeName: college.name,
                collegeScore: '5',
                toured: false,
                applicationStatus: 'not_applying',
                notes: stripMarkdown(college.content),
                images: [],
                imageNames: [],
                createdAt: new Date(),
                wantToApply: false
            };
            console.log('Saving data:', collegeData);

            const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'colleges'), collegeData);
            console.log('Document written with ID: ', docRef.id);
            setIsSaved(true);
        } catch (error: any) {
            console.error('Error saving college:', error);
            alert(`Failed to save college: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '32px',
                boxShadow: isHovered ? '0 8px 24px rgba(0, 0, 0, 0.12)' : '0 4px 6px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease',
                cursor: 'default',
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Top Accent Bar */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: getTypeColor(college.type),
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    {/* Type Badge */}
                    <span style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        background: `${getTypeColor(college.type)}15`,
                        fontSize: '13px',
                        fontWeight: '800',
                        color: getTypeColor(college.type),
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        display: 'inline-block',
                        marginBottom: '12px',
                    }}>
                        {college.type}
                    </span>

                    {/* College Name */}
                    <h3 style={{
                        fontSize: '28px',
                        fontWeight: '800',
                        color: '#1A202C',
                        margin: 0,
                        lineHeight: '1.2',
                        letterSpacing: '-0.02em',
                    }}>
                        {college.name}
                    </h3>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={isSaving || isSaved}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        background: isSaved ? '#E6F4EA' : '#F7FAFC',
                        color: isSaved ? '#137333' : '#4A5568',
                        border: isSaved ? '1px solid #E6F4EA' : '1px solid #E2E8F0',
                        cursor: isSaved ? 'default' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (!isSaved) {
                            e.currentTarget.style.background = '#EDF2F7';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isSaved) {
                            e.currentTarget.style.background = '#F7FAFC';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }
                    }}
                >
                    <span className="material-symbols-outlined" style={{
                        fontSize: '20px',
                        fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0"
                    }}>
                        {isSaved ? 'check_circle' : 'bookmark_add'}
                    </span>
                    {isSaved ? 'Saved!' : isSaving ? 'Saving...' : 'Save College'}
                </button>
            </div>

            {/* Full Content */}
            {college.content && (
                <div
                    className="markdown-content"
                    style={{
                        fontSize: '16px',
                        color: '#4A5568',
                        lineHeight: '1.7',
                    }}
                >
                    <ReactMarkdown>{college.content}</ReactMarkdown>
                </div>
            )}
        </motion.div>
    );
}

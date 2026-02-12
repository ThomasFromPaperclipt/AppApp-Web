'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import dashboardStyles from '@/app/dashboard/dashboard.module.css';
import styles from './math.module.css';
import { desmosLessons, Lesson, Question } from './desmosData';

declare global {
    interface Window {
        Desmos: any;
    }
}

interface UserData {
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
}

export default function MathPractice() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    // New state for lessons
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
    const [userAnswers, setUserAnswers] = useState<{ [key: string]: string }>({});
    const [questionStatus, setQuestionStatus] = useState<{ [key: string]: 'unanswered' | 'correct' | 'incorrect' }>({});
    const [completedLessons, setCompletedLessons] = useState<string[]>([]);

    const [isCalculatorLoaded, setIsCalculatorLoaded] = useState(false);
    const calculatorRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
                    const data = userDoc.data() as UserData & { completedMathLessons?: string[] };
                    setUserData(data);

                    // Load completed lessons from Firebase
                    if (data.completedMathLessons && Array.isArray(data.completedMathLessons)) {
                        setCompletedLessons(data.completedMathLessons);
                        // Sync to local storage for offline backup/consistency
                        localStorage.setItem('desmosCompletedLessons', JSON.stringify(data.completedMathLessons));
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                setLoading(false);
            }
        });

        // Fallback: Load from localStorage if not yet loaded from Firebase (or if offline)
        // This is less critical now that we fetch from Firebase, but good for initial render if needed
        const saved = localStorage.getItem('desmosCompletedLessons');
        if (saved && completedLessons.length === 0) {
            // Only use local storage if state is empty, to avoid overwriting Firebase data with stale local data
            // However, strictly speaking, we should prefer Firebase. 
            // Let's just rely on the Firebase fetch above for the source of truth when logged in.
            // But we can keep it as a fast initial state before the async fetch returns.
            setCompletedLessons(JSON.parse(saved));
        }

        return () => unsubscribe();
    }, [router]);

    // Initialize calculator when entering a lesson or when script loads
    useEffect(() => {
        if (window.Desmos && containerRef.current && !calculatorRef.current) {
            initCalculator();
        }
    }, [currentLesson, isCalculatorLoaded]);

    const initCalculator = () => {
        if (window.Desmos && containerRef.current && !calculatorRef.current) {
            calculatorRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
                keypad: true,
                expressions: true,
                settingsMenu: true,
                zoomButtons: true,
                expressionsCollapsed: false
            });
            setIsCalculatorLoaded(true);
        }
    };

    const handleInputChange = (questionId: string, value: string) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionId]: value
        }));
        // Reset status when typing
        if (questionStatus[questionId] === 'incorrect') {
            setQuestionStatus(prev => ({
                ...prev,
                [questionId]: 'unanswered'
            }));
        }
    };

    const checkAnswer = (question: Question) => {
        const input = userAnswers[question.id]?.trim().toLowerCase();
        if (!input) return;

        const isCorrect = question.acceptableAnswers.some(ans =>
            ans.toLowerCase() === input || ans.toLowerCase().replace(/\s/g, '') === input.replace(/\s/g, '')
        );

        if (isCorrect) {
            setQuestionStatus(prev => ({
                ...prev,
                [question.id]: 'correct'
            }));

            // Show graph if correct
            if (calculatorRef.current && question.desmosExpressions) {
                calculatorRef.current.setExpressions([]);
                question.desmosExpressions.forEach(expr => {
                    calculatorRef.current.setExpression(expr);
                });
            }

            // Check for lesson completion
            if (currentLesson) {
                const allCorrect = currentLesson.questions.every(q =>
                    q.id === question.id ? true : questionStatus[q.id] === 'correct'
                );

                if (allCorrect && !completedLessons.includes(currentLesson.id)) {
                    const newCompleted = [...completedLessons, currentLesson.id];
                    setCompletedLessons(newCompleted);
                    localStorage.setItem('desmosCompletedLessons', JSON.stringify(newCompleted));

                    // Save to Firebase
                    if (user) {
                        const userRef = doc(db, 'users', user.uid);
                        // Use updateDoc with arrayUnion to add the lesson ID without overwriting other data
                        import('firebase/firestore').then(({ updateDoc, arrayUnion, setDoc }) => {
                            updateDoc(userRef, {
                                completedMathLessons: arrayUnion(currentLesson.id)
                            }).catch(async (error) => {
                                // If the document doesn't exist or field is missing, try setting it
                                if (error.code === 'not-found' || error.message.includes('No document to update')) {
                                    await setDoc(userRef, {
                                        completedMathLessons: [currentLesson.id]
                                    }, { merge: true });
                                } else {
                                    console.error("Error saving progress:", error);
                                }
                            });
                        });
                    }
                }
            }
        } else {
            setQuestionStatus(prev => ({
                ...prev,
                [question.id]: 'incorrect'
            }));
        }
    };

    const handleLessonSelect = (lesson: Lesson) => {
        setCurrentLesson(lesson);
        setUserAnswers({});
        setQuestionStatus({});
        // Calculator will be re-initialized by the useEffect when the container renders
    };

    const handleBackToMenu = () => {
        setCurrentLesson(null);
        if (calculatorRef.current) {
            calculatorRef.current.destroy();
            calculatorRef.current = null;
        }
    };

    if (loading) {
        return (
            <div className={dashboardStyles.loadingContainer}>
                <div className={dashboardStyles.loadingImage}>
                    <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                </div>
                <div className={dashboardStyles.loading}>Loading math practice...</div>
            </div>
        );
    }

    return (
        <div className={dashboardStyles.container}>
            <Script
                src="https://www.desmos.com/api/v1.10/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"
                onLoad={() => setIsCalculatorLoaded(true)}
            />

            <nav className={dashboardStyles.topNav}>
                <div className={dashboardStyles.navContent}>
                    <img src="/assets/elongatedNeil.png" alt="AppApp" className={dashboardStyles.logoImage} />
                    <div className={dashboardStyles.topUserCard} onClick={() => router.push('/profile')}>
                        <div className={dashboardStyles.topUserAvatar}>
                            {userData?.firstName?.charAt(0)}{userData?.lastName?.charAt(0)}
                        </div>
                        <div className={dashboardStyles.topUserDetails}>
                            <div className={dashboardStyles.topUserName}>{userData?.firstName} {userData?.lastName}</div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className={dashboardStyles.mainLayoutTwoCol}>
                <main className={dashboardStyles.centerContent} style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', height: 'calc(100vh - 100px)' }}>

                    {/* Lesson List View */}
                    {!currentLesson && (
                        <div className={styles.menuContainer}>
                            <button className={styles.backButton} onClick={() => router.push('/test-prep')}>
                                <span className="material-symbols-outlined">arrow_back</span>
                                Back to Test Prep
                            </button>

                            <header className={styles.header}>
                                <h1 className={styles.title}>Master Desmos</h1>
                                <p className={styles.subtitle}>
                                    Learn how Desmos can help you solve these problems!
                                </p>
                            </header>

                            <div className={styles.lessonGrid}>
                                {desmosLessons.map(lesson => (
                                    <div
                                        key={lesson.id}
                                        className={`${styles.lessonCard} ${completedLessons.includes(lesson.id) ? styles.completedCard : ''}`}
                                        onClick={() => handleLessonSelect(lesson)}
                                    >
                                        <div className={styles.cardHeader}>
                                            <div className={styles.lessonIcon}>{lesson.icon}</div>
                                            {completedLessons.includes(lesson.id) && (
                                                <div className={styles.completedBadge}>
                                                    <span className="material-symbols-outlined">check_circle</span>
                                                </div>
                                            )}
                                        </div>
                                        <h2 className={styles.lessonTitle}>{lesson.title}</h2>
                                        <p className={styles.lessonDesc}>{lesson.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Active Lesson View */}
                    {currentLesson && (
                        <div className={styles.splitLayout}>
                            {/* Left Panel: Lesson Content */}
                            <div className={styles.leftPanel}>
                                <button className={styles.backButton} onClick={handleBackToMenu}>
                                    <span className="material-symbols-outlined">arrow_back</span>
                                    Back to Lessons
                                </button>

                                <header className={styles.header}>
                                    <h1 className={styles.title}>
                                        <span className={styles.headerIcon}>{currentLesson.icon}</span>
                                        {currentLesson.title}
                                    </h1>
                                </header>

                                <div className={styles.contentCard}>
                                    <p className={styles.cardText}>{currentLesson.content}</p>

                                    {currentLesson.proTip && (
                                        <div className={styles.instructionBox}>
                                            <div className={styles.instructionTitle}>
                                                <span className="material-symbols-outlined">lightbulb</span>
                                                {currentLesson.proTip.title}
                                            </div>
                                            <p className={styles.instructionText}>
                                                {currentLesson.proTip.text}
                                            </p>
                                        </div>
                                    )}

                                    <div className={styles.questionsList}>
                                        {currentLesson.questions.map((q, idx) => (
                                            <div key={q.id} className={styles.practiceProblem}>
                                                <h3 className={styles.problemTitle}>Practice Question {idx + 1}</h3>
                                                <p className={styles.questionText}>{q.text}</p>

                                                <div className={styles.inputContainer}>
                                                    <input
                                                        type="text"
                                                        className={`${styles.answerInput} ${questionStatus[q.id] === 'correct' ? styles.inputCorrect : ''} ${questionStatus[q.id] === 'incorrect' ? styles.inputIncorrect : ''}`}
                                                        placeholder="Enter answer..."
                                                        value={userAnswers[q.id] || ''}
                                                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && checkAnswer(q)}
                                                        disabled={questionStatus[q.id] === 'correct'}
                                                    />
                                                    <button
                                                        className={styles.checkButton}
                                                        onClick={() => checkAnswer(q)}
                                                        disabled={questionStatus[q.id] === 'correct'}
                                                    >
                                                        {questionStatus[q.id] === 'correct' ? 'Correct!' : 'Check'}
                                                    </button>
                                                </div>

                                                {questionStatus[q.id] === 'incorrect' && (
                                                    <p className={styles.errorMessage}>Try again! Use Desmos to help you.</p>
                                                )}

                                                {questionStatus[q.id] === 'correct' && (
                                                    <div className={styles.answerBox}>
                                                        <strong>Great job!</strong>
                                                        {q.graphCheck && (
                                                            <>
                                                                <br />
                                                                {q.graphCheck}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {currentLesson.questions.every(q => questionStatus[q.id] === 'correct') && (
                                        <div className={styles.completionContainer}>
                                            <div className={styles.completionMessage}>
                                                <span className="material-symbols-outlined">celebration</span>
                                                Lesson Completed!
                                            </div>
                                            <button className={styles.returnButton} onClick={handleBackToMenu}>
                                                Return to Lessons
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div style={{ height: '50px' }}></div>
                            </div>

                            {/* Right Panel: Desmos Calculator */}
                            <div className={styles.rightPanel}>
                                <div ref={containerRef} className={styles.calculatorContainer}></div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import dashboardStyles from '@/app/dashboard/dashboard.module.css';
import styles from '../test-prep.module.css';
import { satReadingQuestions, SATQuestion } from './satReading';

interface UserData {
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
}

interface QuestionStatus {
    [id: string]: 'correct' | 'incorrect';
}

// Helper function to render text with markdown formatting
const renderFormattedText = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let key = 0;

    // Match text between asterisks for italics
    const regex = /\*([^*]+)\*/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        // Add the italicized text
        parts.push(<em key={key++}>{match[1]}</em>);
        lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
};

const PieChart = ({ correct, incorrect, total, size = 100 }: { correct: number, incorrect: number, total: number, size?: number }) => {
    const radius = size / 2;
    const center = size / 2;
    const strokeWidth = size * 0.15; // Responsive stroke width
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const unattempted = total - correct - incorrect;

    if (total === 0) {
        return (
            <div style={{ position: 'relative', width: size, height: size }}>
                <svg height={size} width={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle
                        stroke="#e2e8f0"
                        fill="transparent"
                        strokeWidth={strokeWidth}
                        r={normalizedRadius}
                        cx={center}
                        cy={center}
                    />
                </svg>
            </div>
        );
    }

    const correctOffset = circumference - (correct / total) * circumference;
    const incorrectOffset = circumference - (incorrect / total) * circumference;
    const unattemptedOffset = circumference - (unattempted / total) * circumference;

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg height={size} width={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Circle */}
                <circle
                    stroke="#edf2f7"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={normalizedRadius}
                    cx={center}
                    cy={center}
                />

                {/* Incorrect Segment (Red) */}
                <circle
                    stroke="#f56565"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    style={{ strokeDashoffset: circumference - ((correct + incorrect) / total) * circumference, transition: 'stroke-dashoffset 0.5s ease' }}
                    r={normalizedRadius}
                    cx={center}
                    cy={center}
                />

                {/* Correct Segment (Green) */}
                <circle
                    stroke="#48bb78"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    style={{ strokeDashoffset: correctOffset, transition: 'stroke-dashoffset 0.5s ease' }}
                    r={normalizedRadius}
                    cx={center}
                    cy={center}
                />
            </svg>
            {/* Center Text */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                fontSize: size * 0.2,
                fontWeight: 'bold',
                color: '#2d3748'
            }}>
                {Math.round((correct / total) * 100)}%
            </div>
        </div>
    );
};

export default function ReadingPractice() {
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    const [viewMode, setViewMode] = useState<'grid' | 'practice'>('grid');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [questionStatus, setQuestionStatus] = useState<QuestionStatus>({});

    // New state for practice modes
    const [practiceType, setPracticeType] = useState<'sequential' | 'random' | 'review'>('sequential');
    const [reviewQueue, setReviewQueue] = useState<number[]>([]);

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

                // Load progress
                const progressRef = doc(db, 'users', user.uid, 'reading_progress', 'bluebook_v1');
                const progressDoc = await getDoc(progressRef);
                if (progressDoc.exists()) {
                    const data = progressDoc.data();
                    setQuestionStatus(data.questionStatus || {});
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const currentQuestion = satReadingQuestions[currentQuestionIndex];

    const handleAnswerSelect = (optionIndex: number) => {
        if (showResult) return;
        setSelectedAnswer(optionIndex);
    };

    const handleCheckAnswer = async () => {
        if (selectedAnswer === null) return;
        setShowResult(true);

        if (!user) return;

        const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

        // In Review Mode, if incorrect, we don't update status yet (allow retry)
        // If correct, we update status to correct
        if (practiceType === 'review' && !isCorrect) {
            return;
        }

        const newStatus = { ...questionStatus, [currentQuestion.id]: isCorrect ? 'correct' : 'incorrect' } as QuestionStatus;
        setQuestionStatus(newStatus);

        try {
            const progressRef = doc(db, 'users', user.uid, 'reading_progress', 'bluebook_v1');
            const progressDoc = await getDoc(progressRef);

            // Calculate stats
            const correctCount = Object.values(newStatus).filter(s => s === 'correct').length;
            const attemptedCount = Object.keys(newStatus).length;

            if (progressDoc.exists()) {
                await updateDoc(progressRef, {
                    questionsCorrect: correctCount,
                    questionsAttempted: attemptedCount,
                    lastPracticed: new Date(),
                    [`questionStatus.${currentQuestion.id}`]: isCorrect ? 'correct' : 'incorrect'
                });
            } else {
                await setDoc(progressRef, {
                    questionsCorrect: correctCount,
                    questionsAttempted: attemptedCount,
                    lastPracticed: new Date(),
                    questionStatus: newStatus
                });
            }
        } catch (error) {
            console.error('Error saving reading progress:', error);
        }
    };

    const handleTryAgain = () => {
        setShowResult(false);
        setSelectedAnswer(null);
    };

    const handleNextQuestion = () => {
        setShowResult(false);
        setSelectedAnswer(null);

        if (practiceType === 'random') {
            // Pick a random question
            const randomIndex = Math.floor(Math.random() * satReadingQuestions.length);
            setCurrentQuestionIndex(randomIndex);
        } else if (practiceType === 'review') {
            // Move to next in queue
            // If current question was answered correctly, it's effectively "removed" from future reviews by status update
            // We just move to the next index in our local queue
            const currentQueueIndex = reviewQueue.indexOf(currentQuestionIndex);
            if (currentQueueIndex < reviewQueue.length - 1) {
                setCurrentQuestionIndex(reviewQueue[currentQueueIndex + 1]);
            } else {
                // End of review queue
                alert("Review session complete!");
                setViewMode('grid');
            }
        } else {
            // Next sequential question
            let newIndex = 0;
            if (currentQuestionIndex < satReadingQuestions.length - 1) {
                newIndex = currentQuestionIndex + 1;
            }
            setCurrentQuestionIndex(newIndex);
        }
        window.scrollTo(0, 0);
    };

    const startRandomPractice = () => {
        setPracticeType('random');
        const randomIndex = Math.floor(Math.random() * satReadingQuestions.length);
        setCurrentQuestionIndex(randomIndex);
        setViewMode('practice');
        setShowResult(false);
        setSelectedAnswer(null);
    };

    const startReviewMistakes = () => {
        const incorrectIndices = satReadingQuestions
            .map((q, idx) => ({ idx, status: questionStatus[q.id] }))
            .filter(item => item.status === 'incorrect')
            .map(item => item.idx);

        if (incorrectIndices.length === 0) {
            alert("No mistakes to review! Great job!");
            return;
        }

        setReviewQueue(incorrectIndices);
        setPracticeType('review');
        setCurrentQuestionIndex(incorrectIndices[0]);
        setViewMode('practice');
        setShowResult(false);
        setSelectedAnswer(null);
    };

    const startQuestion = (index: number) => {
        setPracticeType('sequential');
        setCurrentQuestionIndex(index);
        setViewMode('practice');
        setShowResult(false);
        setSelectedAnswer(null);
    };

    // Analytics Helpers
    const getDomainStats = (domain: string) => {
        const domainQuestions = satReadingQuestions.filter(q => q.domain === domain);
        const total = domainQuestions.length;
        const correct = domainQuestions.filter(q => questionStatus[q.id] === 'correct').length;
        const incorrect = domainQuestions.filter(q => questionStatus[q.id] === 'incorrect').length;
        return { correct, incorrect, total };
    };

    const overallStats = {
        correct: Object.values(questionStatus).filter(s => s === 'correct').length,
        incorrect: Object.values(questionStatus).filter(s => s === 'incorrect').length,
        total: satReadingQuestions.length
    };

    const domains = Array.from(new Set(satReadingQuestions.map(q => q.domain)));

    if (loading) {
        return (
            <div className={dashboardStyles.loadingContainer}>
                <div className={dashboardStyles.loadingImage}>
                    <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                </div>
                <div className={dashboardStyles.loading}>Loading reading practice...</div>
            </div>
        );
    }

    if (viewMode === 'grid') {
        return (
            <div className={dashboardStyles.container}>
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
                    <main className={dashboardStyles.centerContent} style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                        <button className={styles.backButton} onClick={() => router.push('/test-prep')}>
                            <span className="material-symbols-outlined">arrow_back</span>
                            Back to Test Prep
                        </button>

                        <div className={styles.headerRow}>
                            <h1 className={dashboardStyles.pageTitle}>Reading & Writing</h1>
                            <div className={styles.topActionButtons}>
                                <button className={`${styles.actionButton} ${styles.reviewButton}`} onClick={startReviewMistakes}>
                                    <span className="material-symbols-outlined">history</span>
                                    Review Mistakes
                                </button>
                                <button className={`${styles.actionButton} ${styles.randomButton}`} onClick={startRandomPractice}>
                                    <span className="material-symbols-outlined">shuffle</span>
                                    Random Practice
                                </button>
                            </div>
                        </div>

                        {/* Analytics Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
                            {/* Overall Stats */}
                            <div className={styles.moduleCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.5rem 1rem' }}>
                                <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '700', color: '#2d3748' }}>Overall</h3>
                                <PieChart {...overallStats} size={90} />
                                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#718096' }}>
                                    <span style={{ color: '#48bb78', fontWeight: 'bold' }}>{overallStats.correct}</span> / {overallStats.total}
                                </div>
                            </div>

                            {/* Domain Stats */}
                            {domains.map(domain => {
                                const stats = getDomainStats(domain);
                                return (
                                    <div key={domain} className={styles.moduleCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.5rem 1rem' }}>
                                        <h3 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: '600', color: '#4a5568', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1.2' }}>{domain}</h3>
                                        <PieChart {...stats} size={70} />
                                        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#718096' }}>
                                            {stats.correct}/{stats.total}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Questions Grid */}
                        {domains.map(domain => (
                            <div key={domain} style={{ marginBottom: '2.5rem' }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: '#2d3748', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                                    {domain}
                                </h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '1rem' }}>
                                    {satReadingQuestions.map((q, idx) => {
                                        if (q.domain !== domain) return null;
                                        const status = questionStatus[q.id];
                                        let buttonClass = styles.gridButton;

                                        if (status === 'correct') {
                                            buttonClass += ` ${styles.correct}`;
                                        } else if (status === 'incorrect') {
                                            buttonClass += ` ${styles.incorrect}`;
                                        }

                                        return (
                                            <button
                                                key={q.id}
                                                onClick={() => startQuestion(idx)}
                                                className={buttonClass}
                                            >
                                                {idx + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </main>
                </div>
            </div>
        );
    }

    // Practice View
    return (
        <div className={dashboardStyles.container}>
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
                <main className={dashboardStyles.centerContent} style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <button className={styles.backButton} onClick={() => setViewMode('grid')}>
                            <span className="material-symbols-outlined">grid_view</span>
                            Back to Grid
                        </button>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {practiceType === 'random' && (
                                <span style={{ background: '#edf2f7', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '600', color: '#4a5568' }}>
                                    Random Practice Mode
                                </span>
                            )}
                            {practiceType === 'review' && (
                                <span style={{ background: '#fed7d7', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '600', color: '#c53030' }}>
                                    Review Mistakes Mode
                                </span>
                            )}
                        </div>
                    </div>

                    <div className={styles.headerRow}>
                        <h1 className={dashboardStyles.pageTitle}>Reading & Writing</h1>
                        <div className={styles.passageCounter}>
                            Question {currentQuestionIndex + 1} of {satReadingQuestions.length}
                        </div>
                    </div>

                    <div className={styles.readingContainer}>
                        {/* Left Column: Passage */}
                        <div className={styles.passageColumn} style={{ display: 'block' }}>
                            <div className={styles.passageCard}>
                                <div className={styles.passageMeta}>
                                    <span className={`${styles.difficultyBadge} ${styles.medium}`}>
                                        {currentQuestion.domain}
                                    </span>
                                    {currentQuestion.subdomain && (
                                        <span style={{ marginLeft: '0.5rem', color: '#718096', fontSize: '0.9rem' }}>
                                            • {currentQuestion.subdomain}
                                        </span>
                                    )}
                                </div>
                                <div className={styles.passageText}>
                                    {(() => {
                                        // Check if passage starts with "The following text is" or similar introductory phrases
                                        const introPatterns = [
                                            /^(The following text is .*?\.)(\s+)/,
                                            /^(Text \d+\s*\n)/,
                                            /^(While researching.*?:)(\s+)/
                                        ];

                                        let intro = null;
                                        let mainText = currentQuestion.passageText;

                                        for (const pattern of introPatterns) {
                                            const match = currentQuestion.passageText.match(pattern);
                                            if (match) {
                                                intro = match[1];
                                                mainText = currentQuestion.passageText.substring(match[0].length);
                                                break;
                                            }
                                        }

                                        return (
                                            <>
                                                {intro && (
                                                    <p style={{
                                                        fontStyle: 'italic',
                                                        color: '#4a5568',
                                                        marginBottom: '1.5rem',
                                                        paddingBottom: '1rem',
                                                        borderBottom: '1px solid #e2e8f0'
                                                    }}>
                                                        {renderFormattedText(intro)}
                                                    </p>
                                                )}
                                                <p style={{ whiteSpace: 'pre-wrap' }}>{renderFormattedText(mainText)}</p>
                                            </>
                                        );
                                    })()}
                                    {currentQuestion.passageText2 && (
                                        <>
                                            <hr style={{ margin: '2rem 0', border: 'none', borderTop: '2px solid #cbd5e0' }} />
                                            {(() => {
                                                // Check for intro in second passage too
                                                const introPatterns = [
                                                    /^(Text \d+\s*\n)/,
                                                    /^(The following.*?\.)(\s+)/
                                                ];

                                                let intro = null;
                                                let mainText = currentQuestion.passageText2;

                                                for (const pattern of introPatterns) {
                                                    const match = currentQuestion.passageText2.match(pattern);
                                                    if (match) {
                                                        intro = match[1];
                                                        mainText = currentQuestion.passageText2.substring(match[0].length);
                                                        break;
                                                    }
                                                }

                                                return (
                                                    <>
                                                        {intro && (
                                                            <p style={{
                                                                fontStyle: 'italic',
                                                                color: '#4a5568',
                                                                marginBottom: '1.5rem',
                                                                paddingBottom: '1rem',
                                                                borderBottom: '1px solid #e2e8f0'
                                                            }}>
                                                                {renderFormattedText(intro)}
                                                            </p>
                                                        )}
                                                        <p style={{ whiteSpace: 'pre-wrap' }}>{renderFormattedText(mainText)}</p>
                                                    </>
                                                );
                                            })()}
                                        </>
                                    )}
                                </div>
                                {currentQuestion.source && (
                                    <div style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#a0aec0', fontStyle: 'italic' }}>
                                        Source: {currentQuestion.source}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Question & Options */}
                        <div className={styles.questionsColumn} style={{ display: 'block' }}>
                            <div className={styles.questionCard}>
                                <div className={styles.questionText}>
                                    {renderFormattedText(currentQuestion.prompt)}
                                </div>
                                <div className={styles.optionsList}>
                                    {currentQuestion.options.map((option, idx) => {
                                        const isSelected = selectedAnswer === idx;
                                        const isCorrect = currentQuestion.correctAnswer === idx;
                                        let optionClass = styles.optionButton;

                                        if (showResult) {
                                            // In Review Mode, if wrong, we ONLY show incorrect (red), NOT correct (green)
                                            const isWrongInReview = practiceType === 'review' && selectedAnswer !== currentQuestion.correctAnswer;

                                            if (isCorrect && !isWrongInReview) optionClass += ` ${styles.correct}`;
                                            else if (isSelected && !isCorrect) optionClass += ` ${styles.incorrect}`;
                                        } else if (isSelected) {
                                            optionClass += ` ${styles.selected}`;
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                className={optionClass}
                                                onClick={() => handleAnswerSelect(idx)}
                                                disabled={showResult}
                                            >
                                                <span className={styles.optionLetter}>{String.fromCharCode(65 + idx)}</span>
                                                {renderFormattedText(option)}
                                            </button>
                                        );
                                    })}
                                </div>
                                {showResult && !(practiceType === 'review' && selectedAnswer !== currentQuestion.correctAnswer) && (
                                    <div className={styles.explanationBox}>
                                        <strong>Explanation:</strong> {renderFormattedText(currentQuestion.explanation)}
                                    </div>
                                )}
                            </div>

                            <div className={styles.actionArea}>
                                {!showResult ? (
                                    <button
                                        className={styles.submitButton}
                                        onClick={handleCheckAnswer}
                                        disabled={selectedAnswer === null}
                                    >
                                        Check Answer
                                    </button>
                                ) : (
                                    <>
                                        {practiceType === 'review' && selectedAnswer !== currentQuestion.correctAnswer ? (
                                            <button
                                                className={styles.submitButton}
                                                onClick={handleTryAgain}
                                                style={{ width: '100%', justifyContent: 'center', backgroundColor: '#e53e3e' }}
                                            >
                                                Try Again
                                                <span className="material-symbols-outlined">refresh</span>
                                            </button>
                                        ) : (
                                            <button
                                                className={styles.nextButton}
                                                onClick={handleNextQuestion}
                                                style={{ width: '100%', justifyContent: 'center' }}
                                            >
                                                {practiceType === 'random' ? 'Next Random Question' :
                                                    practiceType === 'review' ? 'Next Review Question' :
                                                        (currentQuestionIndex < satReadingQuestions.length - 1 ? 'Next Question' : 'Back to Grid')}
                                                <span className="material-symbols-outlined">arrow_forward</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

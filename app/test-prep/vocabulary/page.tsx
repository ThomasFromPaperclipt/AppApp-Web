'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../test-prep.module.css';
import dashboardStyles from '../../dashboard/dashboard.module.css';
import { satWords } from './satWords';

interface Word {
    id: string;
    word: string;
    definition: string;
    example: string;
    difficulty: string;
}

interface UserData {
    firstName: string;
    lastName: string;
}

type Mode = 'sets' | 'flashcards' | 'review';
type Difficulty = 'no-idea' | 'hard' | 'good' | 'easy';

interface CardData {
    wordId: string;
    difficulty: Difficulty | null; // User's rating for this word
    lastReviewed: Date;
}

export default function VocabularyPractice() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [mode, setMode] = useState<Mode>('sets');
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [cardDataMap, setCardDataMap] = useState<Map<string, CardData>>(new Map());
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'entering' | null>(null);
    const [showRatingButtons, setShowRatingButtons] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Difficulty | 'not-studied' | null>(null);
    const [studyList, setStudyList] = useState<Word[]>([]);

    // Sets & Review State
    const [currentSetIndex, setCurrentSetIndex] = useState<number | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedSets, setSelectedSets] = useState<Set<number>>(new Set());
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewSetIndex, setReviewSetIndex] = useState<number | null>(null);
    const [reviewFilters, setReviewFilters] = useState<Difficulty[]>([]);

    // Session Summary State
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [sessionStats, setSessionStats] = useState<Record<string, Difficulty | 'not-studied'>>({});
    const [lastSessionResults, setLastSessionResults] = useState<{ total: number; improved: number; mastered: number } | null>(null);

    const router = useRouter();

    // Load user data and card progress
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

                // Load all card data
                const vocabSnapshot = await getDocs(collection(db, 'users', user.uid, 'vocabulary'));
                const cardMap = new Map<string, CardData>();

                vocabSnapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    cardMap.set(docSnap.id, {
                        wordId: docSnap.id,
                        difficulty: data.difficulty || null,
                        lastReviewed: data.lastReviewed?.toDate() || new Date()
                    });
                });

                setCardDataMap(cardMap);

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (mode !== 'flashcards' || loading) return;

            if (e.code === 'Space' && !showRatingButtons) {
                e.preventDefault();
                handleFlip();
            } else if (showRatingButtons && isFlipped) {
                // Number keys for rating when flipped
                if (e.code === 'Digit1') {
                    e.preventDefault();
                    handleRating('no-idea');
                } else if (e.code === 'Digit2') {
                    e.preventDefault();
                    handleRating('hard');
                } else if (e.code === 'Digit3') {
                    e.preventDefault();
                    handleRating('good');
                } else if (e.code === 'Digit4') {
                    e.preventDefault();
                    handleRating('easy');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, loading, isFlipped, showRatingButtons]);

    const getCurrentWord = () => {
        return studyList[currentCardIndex] || null;
    };

    const currentWord = getCurrentWord();

    const handleFlip = () => {
        setIsFlipped(true);
        setShowRatingButtons(true);
    };



    // Helper Functions
    const getSets = () => {
        const sets = [];
        for (let i = 0; i < satWords.length; i += 10) {
            sets.push(satWords.slice(i, i + 10));
        }
        return sets;
    };

    const getSetProgress = (set: Word[]) => {
        let learnedCount = 0;
        set.forEach(word => {
            const card = cardDataMap.get(word.id);
            if (card && (card.difficulty === 'good' || card.difficulty === 'easy')) {
                learnedCount++;
            }
        });
        return learnedCount;
    };

    const handleSetSelect = (index: number) => {
        if (selectionMode) {
            const newSelected = new Set(selectedSets);
            if (newSelected.has(index)) {
                newSelected.delete(index);
            } else {
                newSelected.add(index);
            }
            setSelectedSets(newSelected);
            return;
        }

        const sets = getSets();
        const newStudyList = sets[index];
        setStudyList(newStudyList);
        setCurrentSetIndex(index);
        setCurrentCardIndex(0);
        setMode('flashcards');

        // Initialize session stats
        const initialStats: Record<string, Difficulty | 'not-studied'> = {};
        newStudyList.forEach(word => {
            const card = cardDataMap.get(word.id);
            initialStats[word.id] = card?.difficulty || 'not-studied';
        });
        setSessionStats(initialStats);
    };

    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedSets(new Set());
    };

    const handleReviewPress = (index: number) => {
        setReviewSetIndex(index);
        setReviewFilters([]);
        setShowReviewModal(true);
    };

    const handleMultiReviewPress = () => {
        setReviewSetIndex(null);
        setReviewFilters([]);
        setShowReviewModal(true);
    };

    const toggleReviewFilter = (difficulty: Difficulty) => {
        setReviewFilters(prev =>
            prev.includes(difficulty)
                ? prev.filter(d => d !== difficulty)
                : [...prev, difficulty]
        );
    };

    const startReviewSession = () => {
        const sets = getSets();
        let wordsToReview: Word[] = [];

        if (reviewSetIndex !== null) {
            wordsToReview = sets[reviewSetIndex];
        } else if (selectedSets.size > 0) {
            selectedSets.forEach(index => {
                wordsToReview = [...wordsToReview, ...sets[index]];
            });
        }

        if (reviewFilters.length > 0) {
            wordsToReview = wordsToReview.filter(word => {
                const card = cardDataMap.get(word.id);
                return card && reviewFilters.includes(card.difficulty!);
            });
        }

        if (wordsToReview.length === 0) return;

        setStudyList(wordsToReview);
        setCurrentSetIndex(reviewSetIndex);
        setCurrentCardIndex(0);
        setMode('flashcards');
        setShowReviewModal(false);
        setSelectionMode(false);
        setSelectedSets(new Set());
        setReviewSetIndex(null);

        // Initialize session stats
        const initialStats: Record<string, Difficulty | 'not-studied'> = {};
        wordsToReview.forEach(word => {
            const card = cardDataMap.get(word.id);
            initialStats[word.id] = card?.difficulty || 'not-studied';
        });
        setSessionStats(initialStats);
    };

    const finishSession = () => {
        let improved = 0;
        let mastered = 0;

        studyList.forEach(word => {
            const initialDiff = sessionStats[word.id];
            const currentCard = cardDataMap.get(word.id);
            const currentDiff = currentCard?.difficulty || 'not-studied';

            const difficultyRank: Record<string, number> = { 'not-studied': 0, 'no-idea': 1, 'hard': 2, 'good': 3, 'easy': 4 };
            if (difficultyRank[currentDiff] > difficultyRank[initialDiff]) {
                improved++;
            }

            if (currentDiff === 'easy' || currentDiff === 'good') {
                mastered++;
            }
        });

        setLastSessionResults({
            total: studyList.length,
            improved,
            mastered
        });
        setShowSummaryModal(true);
    };

    const handleKeepStudying = () => {
        setShowSummaryModal(false);
        setCurrentCardIndex(0);

        // Re-initialize stats
        const initialStats: Record<string, Difficulty | 'not-studied'> = {};
        studyList.forEach(word => {
            const card = cardDataMap.get(word.id);
            initialStats[word.id] = card?.difficulty || 'not-studied';
        });
        setSessionStats(initialStats);
    };

    const handleFinishSession = () => {
        setShowSummaryModal(false);
        setMode('sets');
        setCurrentSetIndex(null);
    };

    // Check for session completion in handleRating
    const handleRating = async (difficulty: Difficulty) => {
        if (!user || !currentWord || slideDirection) return;

        // Trigger animation
        setSlideDirection(difficulty === 'no-idea' || difficulty === 'hard' ? 'left' : 'right');

        // Update Firestore
        try {
            const wordRef = doc(db, 'users', user.uid, 'vocabulary', currentWord.id);
            await setDoc(wordRef, {
                wordId: currentWord.id,
                difficulty: difficulty,
                lastReviewed: new Date()
            });

            // Update local state
            setCardDataMap(prev => {
                const newMap = new Map(prev);
                newMap.set(currentWord.id, {
                    wordId: currentWord.id,
                    difficulty: difficulty,
                    lastReviewed: new Date()
                });
                return newMap;
            });

        } catch (error) {
            console.error('Error updating card:', error);
        }

        // Wait for animation to finish before changing card
        setTimeout(() => {
            // Check if session is complete
            if (currentCardIndex >= studyList.length - 1) {
                finishSession();
                return;
            }

            setIsFlipped(false);
            setShowRatingButtons(false);

            // Move to next card
            const nextIndex = currentCardIndex + 1;
            setCurrentCardIndex(nextIndex);

            setSlideDirection('entering');

            // Wait for enter animation
            setTimeout(() => {
                setSlideDirection(null);
            }, 500);
        }, 500);
    };

    if (loading) {
        return (
            <div className={dashboardStyles.loadingContainer}>
                <div className={dashboardStyles.loadingImage}>
                    <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                </div>
                <div className={dashboardStyles.loading}>Loading vocabulary...</div>
            </div>
        );
    }

    // Calculate statistics
    const noIdeaCards = Array.from(cardDataMap.values()).filter(c => c.difficulty === 'no-idea');
    const hardCards = Array.from(cardDataMap.values()).filter(c => c.difficulty === 'hard');
    const goodCards = Array.from(cardDataMap.values()).filter(c => c.difficulty === 'good');
    const easyCards = Array.from(cardDataMap.values()).filter(c => c.difficulty === 'easy');
    const unstudiedCards = satWords.filter(w => !cardDataMap.has(w.id));

    const filteredWords = selectedCategory
        ? satWords.filter(w => {
            const card = cardDataMap.get(w.id);
            if (selectedCategory === 'not-studied') return !card;
            return card?.difficulty === selectedCategory;
        })
        : satWords;

    const handleCategoryClick = (category: Difficulty | 'not-studied') => {
        if (selectedCategory === category) {
            setSelectedCategory(null); // Deselect if already selected
        } else {
            setSelectedCategory(category);
        }
    };

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
                <main className={dashboardStyles.centerContent} style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <button className={styles.backButton} onClick={() => router.push('/test-prep')}>
                        <span className="material-symbols-outlined">arrow_back</span>
                        Back to Test Prep
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <h1 className={dashboardStyles.pageTitle} style={{ margin: 0 }}>📚 Vocabulary Practice</h1>
                        <div style={{ position: 'relative' }}>
                            <button
                                className={`${styles.helpButton} ${showHelp ? styles.active : ''}`}
                                onClick={() => setShowHelp(!showHelp)}
                                aria-label="Help"
                            >
                                ?
                            </button>
                            {showHelp && (
                                <div className={styles.helpTooltip}>
                                    <h3>
                                        <span style={{ fontSize: '1.5rem' }}>💡</span>
                                        How it works
                                    </h3>
                                    <p>
                                        Study each word and rate your knowledge. We'll track your progress to help you focus on what you need to learn.
                                    </p>
                                    <div className={styles.helpLegend}>
                                        <div className={styles.helpItem}>
                                            <span className={styles.helpEmoji}>😵</span>
                                            <span className={styles.helpLabel}>No idea</span>
                                            <span className={styles.helpDesc}>Don't know it yet</span>
                                        </div>
                                        <div className={styles.helpItem}>
                                            <span className={styles.helpEmoji}>😓</span>
                                            <span className={styles.helpLabel}>Hard</span>
                                            <span className={styles.helpDesc}>Struggling with it</span>
                                        </div>
                                        <div className={styles.helpItem}>
                                            <span className={styles.helpEmoji}>🙂</span>
                                            <span className={styles.helpLabel}>Good</span>
                                            <span className={styles.helpDesc}>Know it well</span>
                                        </div>
                                        <div className={styles.helpItem}>
                                            <span className={styles.helpEmoji}>😎</span>
                                            <span className={styles.helpLabel}>Easy</span>
                                            <span className={styles.helpDesc}>Mastered it</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowHelp(false)}
                                        style={{
                                            marginTop: '1.5rem',
                                            background: '#437E84',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '0.75rem',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            width: '100%',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        Got it!
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.modeSelector}>
                        <button
                            className={`${styles.modeButton} ${mode === 'sets' ? styles.active : ''}`}
                            onClick={() => setMode('sets')}
                        >
                            Sets
                        </button>
                        <button
                            className={`${styles.modeButton} ${mode === 'review' ? styles.active : ''}`}
                            onClick={() => setMode('review')}
                        >
                            Statistics
                        </button>
                    </div>

                    {mode === 'sets' && (
                        <div>
                            <div className={styles.headerRow}>
                                <h2 style={{ fontSize: '1.5rem', color: '#2d3748' }}>Vocabulary Sets</h2>
                                <button
                                    className={styles.headerActionButton}
                                    style={{ background: selectionMode ? '#e53e3e' : '#437E84', color: 'white' }}
                                    onClick={toggleSelectionMode}
                                >
                                    {selectionMode ? 'Cancel Selection' : 'Select Sets'}
                                </button>
                            </div>

                            <div className={styles.setsGrid}>
                                {getSets().map((set, index) => {
                                    const progress = getSetProgress(set);
                                    const isCompleted = progress === 10;
                                    const isSelected = selectedSets.has(index);

                                    // Calculate set stats
                                    let easy = 0, good = 0, hard = 0, noIdea = 0;
                                    set.forEach(word => {
                                        const card = cardDataMap.get(word.id);
                                        if (card) {
                                            if (card.difficulty === 'easy') easy++;
                                            else if (card.difficulty === 'good') good++;
                                            else if (card.difficulty === 'hard') hard++;
                                            else if (card.difficulty === 'no-idea') noIdea++;
                                        }
                                    });

                                    return (
                                        <div
                                            key={index}
                                            className={`${styles.setCard} ${isSelected ? styles.selected : ''}`}
                                            onClick={() => handleSetSelect(index)}
                                        >
                                            <div>
                                                <div className={styles.setHeader}>
                                                    <div>
                                                        <div className={styles.setTitle}>Set {index + 1}</div>
                                                        <div className={styles.setSubtitle}>{progress}/10 Words</div>
                                                    </div>
                                                    {selectionMode ? (
                                                        <div className={styles.setCheck}>
                                                            {isSelected && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>}
                                                        </div>
                                                    ) : (
                                                        !isCompleted && <span className="material-symbols-outlined" style={{ color: '#cbd5e0' }}>chevron_right</span>
                                                    )}
                                                </div>

                                                <div className={styles.miniStatsContainer}>
                                                    {easy > 0 && <div className={styles.miniStatBadge} style={{ background: "#BEE3F8" }}>😎 {easy}</div>}
                                                    {good > 0 && <div className={styles.miniStatBadge} style={{ background: "#C6F6D5" }}>🙂 {good}</div>}
                                                    {hard > 0 && <div className={styles.miniStatBadge} style={{ background: "#FEEBC8" }}>😓 {hard}</div>}
                                                    {noIdea > 0 && <div className={styles.miniStatBadge} style={{ background: "#FED7D7" }}>😵 {noIdea}</div>}
                                                </div>
                                            </div>

                                            {!selectionMode && isCompleted && (
                                                <button
                                                    className={styles.reviewButton}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleReviewPress(index);
                                                    }}
                                                >
                                                    Review
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectionMode && selectedSets.size > 0 && (
                                <button className={styles.floatingReviewButton} onClick={handleMultiReviewPress}>
                                    Review {selectedSets.size} Sets
                                </button>
                            )}
                        </div>
                    )}

                    {mode === 'flashcards' && currentWord && (
                        <>
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{ width: `${((currentCardIndex + 1) / studyList.length) * 100}%` }}
                                />
                            </div>
                            <div className={styles.progressText}>
                                Word {currentCardIndex + 1} of {studyList.length}
                            </div>

                            <div className={styles.flashcardContainer}>
                                <div
                                    className={`${styles.flashcard} ${isFlipped ? styles.flipped : ''} ${slideDirection === 'left' ? styles.slideLeft :
                                        slideDirection === 'right' ? styles.slideRight :
                                            slideDirection === 'entering' ? styles.entering : ''
                                        } `}
                                    onClick={() => !isFlipped && handleFlip()}
                                    style={{ cursor: isFlipped ? 'default' : 'pointer' }}
                                >
                                    <div className={`${styles.cardFace} ${styles.cardFront} `}>
                                        <div className={styles.word}>{currentWord.word}</div>
                                        <p style={{ fontSize: '1rem', opacity: 0.9 }}>Click or press space to reveal</p>
                                    </div>
                                    <div className={`${styles.cardFace} ${styles.cardBack} `}>
                                        <div className={styles.definition}>{currentWord.definition}</div>
                                        <div className={styles.example}>"{currentWord.example}"</div>
                                    </div>
                                </div>
                            </div>

                            {showRatingButtons && isFlipped && (
                                <div className={styles.ratingGrid}>
                                    <button
                                        className={`${styles.ratingButton} ${styles.noIdea}`}
                                        onClick={() => handleRating('no-idea')}
                                    >
                                        <span className={styles.ratingEmoji}>😵</span>
                                        <span className={styles.ratingLabel}>No Idea</span>
                                        <span className={styles.keyHint}>1</span>
                                    </button>
                                    <button
                                        className={`${styles.ratingButton} ${styles.hard}`}
                                        onClick={() => handleRating('hard')}
                                    >
                                        <span className={styles.ratingEmoji}>😓</span>
                                        <span className={styles.ratingLabel}>Hard</span>
                                        <span className={styles.keyHint}>2</span>
                                    </button>
                                    <button
                                        className={`${styles.ratingButton} ${styles.good}`}
                                        onClick={() => handleRating('good')}
                                    >
                                        <span className={styles.ratingEmoji}>🙂</span>
                                        <span className={styles.ratingLabel}>Good</span>
                                        <span className={styles.keyHint}>3</span>
                                    </button>
                                    <button
                                        className={`${styles.ratingButton} ${styles.easy}`}
                                        onClick={() => handleRating('easy')}
                                    >
                                        <span className={styles.ratingEmoji}>😎</span>
                                        <span className={styles.ratingLabel}>Easy</span>
                                        <span className={styles.keyHint}>4</span>
                                    </button>
                                </div>
                            )}

                            {!isFlipped && (
                                <div style={{ textAlign: 'center', marginTop: '1rem', color: '#718096', fontSize: '0.875rem' }}>
                                    Press <kbd style={{
                                        padding: '0.25rem 0.5rem',
                                        background: '#e2e8f0',
                                        borderRadius: '4px',
                                        fontFamily: 'monospace'
                                    }}>Space</kbd> to flip
                                </div>
                            )}

                            {isFlipped && showRatingButtons && (
                                <div style={{ textAlign: 'center', marginTop: '1rem', color: '#718096', fontSize: '0.875rem' }}>
                                    Press <kbd style={{
                                        padding: '0.25rem 0.5rem',
                                        background: '#e2e8f0',
                                        borderRadius: '4px',
                                        fontFamily: 'monospace'
                                    }}>1</kbd> <kbd style={{
                                        padding: '0.25rem 0.5rem',
                                        background: '#e2e8f0',
                                        borderRadius: '4px',
                                        fontFamily: 'monospace'
                                    }}>2</kbd> <kbd style={{
                                        padding: '0.25rem 0.5rem',
                                        background: '#e2e8f0',
                                        borderRadius: '4px',
                                        fontFamily: 'monospace'
                                    }}>3</kbd> <kbd style={{
                                        padding: '0.25rem 0.5rem',
                                        background: '#e2e8f0',
                                        borderRadius: '4px',
                                        fontFamily: 'monospace'
                                    }}>4</kbd> to rate
                                </div>
                            )}
                        </>
                    )}

                    {mode === 'review' && (
                        <div style={{ padding: '2rem 0' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', color: '#2d3748' }}>
                                📊 Your Progress
                            </h2>

                            <div className={styles.statsGrid}>
                                <div
                                    className={`${styles.statCard} ${styles.notStudied} ${selectedCategory === 'not-studied' ? styles.selected : ''}`}
                                    onClick={() => handleCategoryClick('not-studied')}
                                >
                                    <div className={styles.statCount}>{unstudiedCards.length}</div>
                                    <div className={styles.statLabel}>Not Studied</div>
                                </div>
                                <div
                                    className={`${styles.statCard} ${styles.noIdea} ${selectedCategory === 'no-idea' ? styles.selected : ''}`}
                                    onClick={() => handleCategoryClick('no-idea')}
                                >
                                    <div className={styles.statCount}>{noIdeaCards.length}</div>
                                    <div className={styles.statLabel}>No Idea</div>
                                </div>
                                <div
                                    className={`${styles.statCard} ${styles.hard} ${selectedCategory === 'hard' ? styles.selected : ''}`}
                                    onClick={() => handleCategoryClick('hard')}
                                >
                                    <div className={styles.statCount}>{hardCards.length}</div>
                                    <div className={styles.statLabel}>Hard</div>
                                </div>
                                <div
                                    className={`${styles.statCard} ${styles.good} ${selectedCategory === 'good' ? styles.selected : ''}`}
                                    onClick={() => handleCategoryClick('good')}
                                >
                                    <div className={styles.statCount}>{goodCards.length}</div>
                                    <div className={styles.statLabel}>Good</div>
                                </div>
                                <div
                                    className={`${styles.statCard} ${styles.easy} ${selectedCategory === 'easy' ? styles.selected : ''}`}
                                    onClick={() => handleCategoryClick('easy')}
                                >
                                    <div className={styles.statCount}>{easyCards.length}</div>
                                    <div className={styles.statLabel}>Easy</div>
                                </div>
                            </div>

                            <div style={{
                                background: 'white',
                                borderRadius: '16px',
                                padding: '2rem',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                                <div className={styles.filterHeader}>
                                    <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#2d3748' }}>
                                        {selectedCategory ? (
                                            <>
                                                {selectedCategory === 'not-studied' ? 'Not Studied' :
                                                    selectedCategory === 'no-idea' ? 'No Idea' :
                                                        selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Words ({filteredWords.length})
                                            </>
                                        ) : (
                                            `All Words (${satWords.length})`
                                        )}
                                    </h3>
                                    {selectedCategory && (
                                        <button className={styles.clearFilter} onClick={() => setSelectedCategory(null)}>
                                            Clear Filter
                                        </button>
                                    )}
                                </div>

                                {selectedCategory && filteredWords.length > 0 && (
                                    <button
                                        onClick={() => {
                                            setStudyList(filteredWords);
                                            setMode('flashcards');
                                            setCurrentCardIndex(0);
                                        }}
                                        style={{
                                            marginBottom: '1.5rem',
                                            background: '#437E84',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.75rem 1.5rem',
                                            borderRadius: '8px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <span>📝</span> Study These Words
                                    </button>
                                )}

                                <div style={{
                                    display: 'grid',
                                    gap: '0.75rem',
                                    maxHeight: '500px',
                                    overflowY: 'auto'
                                }}>
                                    {filteredWords.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                                            No words found in this category.
                                        </div>
                                    ) : (
                                        filteredWords.map(word => {
                                            const cardData = cardDataMap.get(word.id);
                                            const difficultyLabel = !cardData?.difficulty ? 'Not studied' :
                                                cardData.difficulty === 'no-idea' ? 'No idea' :
                                                    cardData.difficulty === 'hard' ? 'Hard' :
                                                        cardData.difficulty === 'good' ? 'Good' : 'Easy';

                                            const bgColor = !cardData?.difficulty ? '#e2e8f0' :
                                                cardData.difficulty === 'no-idea' ? '#fed7d7' :
                                                    cardData.difficulty === 'hard' ? '#feebc8' :
                                                        cardData.difficulty === 'good' ? '#c6f6d5' : '#bee3f8';

                                            const textColor = !cardData?.difficulty ? '#4a5568' :
                                                cardData.difficulty === 'no-idea' ? '#742a2a' :
                                                    cardData.difficulty === 'hard' ? '#7c2d12' :
                                                        cardData.difficulty === 'good' ? '#22543d' : '#2c5282';

                                            return (
                                                <div key={word.id} style={{
                                                    padding: '1rem',
                                                    background: '#f7fafc',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '0.25rem' }}>
                                                            {word.word}
                                                        </div>
                                                        <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                                                            {word.definition}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        padding: '0.5rem 1rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600',
                                                        whiteSpace: 'nowrap',
                                                        background: bgColor,
                                                        color: textColor
                                                    }}>
                                                        {difficultyLabel}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>


            {/* Review Modal */}
            {
                showReviewModal && (
                    <div className={styles.modalOverlay} onClick={() => setShowReviewModal(false)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3 className={styles.modalTitle}>
                                    {reviewSetIndex !== null ? `Review Set ${reviewSetIndex + 1}` : `Review ${selectedSets.size} Sets`}
                                </h3>
                                <button className={styles.closeButton} onClick={() => setShowReviewModal(false)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <p className={styles.modalSubtitle}>Select difficulty levels to review:</p>

                            <div className={styles.filterContainer}>
                                <button
                                    className={`${styles.filterButton} ${reviewFilters.includes('no-idea') ? styles.active : ''}`}
                                    onClick={() => toggleReviewFilter('no-idea')}
                                >
                                    <span>😵</span> No Idea
                                </button>
                                <button
                                    className={`${styles.filterButton} ${reviewFilters.includes('hard') ? styles.active : ''}`}
                                    onClick={() => toggleReviewFilter('hard')}
                                >
                                    <span>😓</span> Hard
                                </button>
                                <button
                                    className={`${styles.filterButton} ${reviewFilters.includes('good') ? styles.active : ''}`}
                                    onClick={() => toggleReviewFilter('good')}
                                >
                                    <span>🙂</span> Good
                                </button>
                                <button
                                    className={`${styles.filterButton} ${reviewFilters.includes('easy') ? styles.active : ''}`}
                                    onClick={() => toggleReviewFilter('easy')}
                                >
                                    <span>😎</span> Easy
                                </button>
                            </div>

                            <button className={styles.primaryButton} onClick={startReviewSession}>
                                Start Review
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Session Summary Modal */}
            {
                showSummaryModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <h3 className={styles.modalTitle} style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                🎉 Session Complete!
                            </h3>

                            <div className={styles.summaryStats}>
                                <div className={styles.summaryStatItem}>
                                    <div className={styles.summaryStatValue}>{lastSessionResults?.total}</div>
                                    <div className={styles.summaryStatLabel}>Studied</div>
                                </div>
                                <div className={styles.summaryStatItem}>
                                    <div className={styles.summaryStatValue}>{lastSessionResults?.improved}</div>
                                    <div className={styles.summaryStatLabel}>Improved</div>
                                </div>
                                <div className={styles.summaryStatItem}>
                                    <div className={styles.summaryStatValue}>{lastSessionResults?.mastered}</div>
                                    <div className={styles.summaryStatLabel}>Mastered</div>
                                </div>
                            </div>

                            <p className={styles.modalSubtitle} style={{ textAlign: 'center' }}>
                                {lastSessionResults?.improved! > 0
                                    ? "Great job! You're making progress."
                                    : "Keep practicing to improve your score!"}
                            </p>

                            <div className={styles.modalActions}>
                                <button className={styles.primaryButton} onClick={handleKeepStudying}>
                                    Review Again
                                </button>
                                <button className={styles.secondaryButton} onClick={handleFinishSession}>
                                    Finish
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

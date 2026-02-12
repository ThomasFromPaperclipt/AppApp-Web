'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from '../../dashboard/dashboard.module.css';

interface IdeaGeneratorViewProps {
    user: User | null;
    counts: any;
    setCounts: any;
    setEssays: any;
    colleges?: { id: string; collegeName: string }[];
    essays?: SavedEssay[];
}

interface Idea {
    title: string;
    description: string;
    connections: string[];
}

interface SavedPrompt {
    id: string;
    collegeId: string;
    promptText: string;
    wordLimit?: number;
}

interface College {
    id: string;
    collegeName: string;
}

interface SavedEssay {
    id: string;
    title: string;
    idea: string;
    status?: string;
    promptText?: string;
    createdAt?: string;
}

const COMMON_APP_PROMPTS = [
    "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.",
    "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?",
    "Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?",
    "Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?",
    "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.",
    "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?",
    "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design."
];

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

type TabType = 'ideas' | 'common' | 'saved' | 'custom';

export default function IdeaGeneratorView({ user, counts, setCounts, setEssays, colleges: propColleges, essays: propEssays }: IdeaGeneratorViewProps) {
    const router = useRouter();
    const [step, setStep] = useState<'select' | 'generating' | 'results'>('select');
    const [activeTab, setActiveTab] = useState<TabType>('ideas');
    const [selectedPrompt, setSelectedPrompt] = useState(COMMON_APP_PROMPTS[0]);
    const [selectedPromptText, setSelectedPromptText] = useState(COMMON_APP_PROMPTS[0]);
    const [customPrompt, setCustomPrompt] = useState('');
    const [generatedIdeas, setGeneratedIdeas] = useState<Idea[]>([]);
    const [error, setError] = useState('');

    // Saved prompts state
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
    const [colleges, setColleges] = useState<College[]>(propColleges || []);
    const [loadingPrompts, setLoadingPrompts] = useState(true);

    // Get saved ideas from essays (status = 'Idea')
    const savedIdeas = (propEssays || []).filter(e => e.status === 'Idea');

    // Fetch saved prompts and colleges on mount
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                // Fetch saved prompts
                const promptsSnapshot = await getDocs(collection(db, 'users', user.uid, 'essay_prompts'));
                const promptsData = promptsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as SavedPrompt));
                setSavedPrompts(promptsData);

                // Fetch colleges if not provided via props
                if (!propColleges || propColleges.length === 0) {
                    const collegesSnapshot = await getDocs(collection(db, 'users', user.uid, 'colleges'));
                    const collegesData = collegesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        collegeName: doc.data().collegeName || 'Unknown College'
                    }));
                    setColleges(collegesData);
                }
            } catch (err) {
                console.error('Error fetching prompts:', err);
            } finally {
                setLoadingPrompts(false);
            }
        };

        fetchData();
    }, [user, propColleges]);

    // Group prompts by college
    const promptsByCollege = savedPrompts.reduce((acc, prompt) => {
        const collegeId = prompt.collegeId;
        if (!acc[collegeId]) {
            acc[collegeId] = [];
        }
        acc[collegeId].push(prompt);
        return acc;
    }, {} as Record<string, SavedPrompt[]>);

    const getCollegeName = (collegeId: string) => {
        return colleges.find(c => c.id === collegeId)?.collegeName || 'Unknown College';
    };

    const handleGenerate = async () => {
        if (!user) return;
        setStep('generating');
        setError('');

        try {
            // Fetch Activities and Honors directly from Firestore
            const activitiesSnapshot = await getDocs(collection(db, 'users', user.uid, 'activities'));
            const honorsSnapshot = await getDocs(collection(db, 'users', user.uid, 'honors'));

            const activitiesData = activitiesSnapshot.docs.map(doc => doc.data());
            const honorsData = honorsSnapshot.docs.map(doc => doc.data());

            // Determine prompt based on active tab
            let promptToSend = '';
            if (activeTab === 'custom') {
                promptToSend = customPrompt;
            } else {
                promptToSend = selectedPromptText;
            }

            const response = await fetch('https://us-central1-appappi.cloudfunctions.net/generateTargetedEssayIdeas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    essayPrompt: promptToSend,
                    activities: activitiesData,
                    honors: honorsData,
                    intendedMajor: "Undecided",
                    dreamCollege: ""
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Function error:", errorText);
                throw new Error('Failed to generate ideas');
            }

            const data = await response.json();
            if (data.ideas) {
                setGeneratedIdeas(data.ideas);
                setStep('results');
            } else {
                throw new Error('Invalid response format');
            }

        } catch (err) {
            console.error(err);
            setError('Failed to generate ideas. Please try again.');
            setStep('select');
        }
    };

    const handleSaveIdea = async (idea: Idea) => {
        if (!user) return;
        try {
            // Get the prompt text based on which tab was active
            const promptText = activeTab === 'custom' ? customPrompt : selectedPromptText;

            const newEssay = {
                title: stripMarkdown(idea.title),
                idea: `${stripMarkdown(idea.description)}\n\nKey Connections:\n${idea.connections.map(c => stripMarkdown(c)).join('\n')}`,
                status: 'Idea',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                promptText: promptText, // Store the prompt text directly
                isCommonApp: activeTab === 'common',
                sourceEssayId: null
            };

            const docRef = await addDoc(collection(db, 'users', user.uid, 'essays'), newEssay);
            setEssays((prev: any) => [{ id: docRef.id, ...newEssay }, ...prev]);
            setCounts((prev: any) => ({ ...prev, essays: prev.essays + 1 }));

            // Switch to ideas tab to show the saved idea
            setActiveTab('ideas');
            setStep('select');
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectSavedPrompt = (prompt: SavedPrompt) => {
        setSelectedPrompt(prompt.id);
        setSelectedPromptText(prompt.promptText);
    };

    const handleSelectCommonAppPrompt = (prompt: string, index: number) => {
        setSelectedPrompt(prompt);
        setSelectedPromptText(prompt);
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            {/* Header */}
            <div style={{
                marginBottom: '32px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #437E84 0%, #2D5559 100%)',
                borderRadius: '20px',
                padding: '32px',
                color: 'white',
                boxShadow: '0 10px 30px rgba(67, 126, 132, 0.25)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>lightbulb</span>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>
                        Neil's Idea Generator
                    </h1>
                </div>
                <p style={{ opacity: 0.9, fontSize: '16px', maxWidth: '500px', margin: '0 auto' }}>
                    Select a prompt and Neil will help you find the perfect angle using your activities and awards!
                </p>
            </div>

            {step === 'select' && (
                <div>
                    {/* Tab Navigation */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '24px',
                        background: 'white',
                        padding: '6px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                        {[
                            { id: 'ideas' as TabType, label: 'Saved Ideas', icon: 'bookmark', badge: savedIdeas.length },
                            { id: 'common' as TabType, label: 'Common App', icon: 'description' },
                            { id: 'saved' as TabType, label: 'Saved Prompts', icon: 'folder', badge: savedPrompts.length },
                            { id: 'custom' as TabType, label: 'New Prompt', icon: 'edit' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: activeTab === tab.id ? '#437E84' : 'transparent',
                                    color: activeTab === tab.id ? 'white' : '#64748b',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
                                {tab.label}
                                {tab.badge !== undefined && tab.badge > 0 && (
                                    <span style={{
                                        background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : '#E9F5F7',
                                        color: activeTab === tab.id ? 'white' : '#437E84',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '700'
                                    }}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        overflow: 'hidden'
                    }}>
                        {/* Saved Ideas Tab */}
                        {activeTab === 'ideas' && (
                            <div style={{ padding: '24px' }}>
                                {savedIdeas.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#D1D5DB', marginBottom: '16px', display: 'block' }}>
                                            lightbulb
                                        </span>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                            No saved ideas yet
                                        </h3>
                                        <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '300px', margin: '0 auto 16px' }}>
                                            Generate ideas from Common App prompts, saved prompts, or your own custom prompt!
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('common')}
                                            style={{
                                                padding: '10px 20px',
                                                background: '#437E84',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_awesome</span>
                                            Start Generating
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                                Your Saved Ideas
                                            </h3>
                                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                                Click an idea to open it in the essay editor
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {savedIdeas.map(idea => (
                                                <div
                                                    key={idea.id}
                                                    onClick={() => router.push(`/essays/${idea.id}`)}
                                                    style={{
                                                        padding: '20px',
                                                        borderRadius: '12px',
                                                        border: '1px solid #E5E7EB',
                                                        background: 'white',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                        gap: '16px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = '#437E84';
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(67, 126, 132, 0.15)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = '#E5E7EB';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                                                            {idea.title}
                                                        </h4>
                                                        <p style={{
                                                            fontSize: '14px',
                                                            color: '#6B7280',
                                                            margin: 0,
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {idea.idea.split('\n')[0]}
                                                        </p>
                                                        {idea.promptText && (
                                                            <div style={{
                                                                marginTop: '12px',
                                                                fontSize: '12px',
                                                                color: '#9CA3AF',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}>
                                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>format_quote</span>
                                                                {idea.promptText.substring(0, 60)}...
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="material-symbols-outlined" style={{ color: '#437E84', fontSize: '20px' }}>
                                                        arrow_forward
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Common App Tab */}
                        {activeTab === 'common' && (
                            <div style={{ padding: '24px' }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                        Common App Prompts
                                    </h3>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                        Choose from the 7 official Common Application essay prompts
                                    </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {COMMON_APP_PROMPTS.map((prompt, i) => (
                                        <div
                                            key={i}
                                            onClick={() => handleSelectCommonAppPrompt(prompt, i)}
                                            style={{
                                                padding: '16px',
                                                borderRadius: '12px',
                                                border: selectedPrompt === prompt ? '2px solid #437E84' : '1px solid #E5E7EB',
                                                background: selectedPrompt === prompt ? '#F0FDFA' : 'white',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                gap: '12px',
                                                alignItems: 'flex-start'
                                            }}
                                        >
                                            <div style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: selectedPrompt === prompt ? '#437E84' : '#F3F4F6',
                                                color: selectedPrompt === prompt ? 'white' : '#6B7280',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: '700',
                                                fontSize: '13px',
                                                flexShrink: 0
                                            }}>
                                                {i + 1}
                                            </div>
                                            <p style={{
                                                fontSize: '14px',
                                                lineHeight: '1.5',
                                                color: '#374151',
                                                margin: 0,
                                                flex: 1
                                            }}>
                                                {prompt}
                                            </p>
                                            {selectedPrompt === prompt && (
                                                <span className="material-symbols-outlined" style={{ color: '#437E84', fontSize: '20px' }}>
                                                    check_circle
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Saved Prompts Tab */}
                        {activeTab === 'saved' && (
                            <div style={{ padding: '24px' }}>
                                {loadingPrompts ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                                        Loading saved prompts...
                                    </div>
                                ) : savedPrompts.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#D1D5DB', marginBottom: '16px', display: 'block' }}>
                                            folder_open
                                        </span>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                            No saved prompts yet
                                        </h3>
                                        <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '300px', margin: '0 auto' }}>
                                            Add prompts from your college pages to see them here. Go to <strong>Colleges</strong> view to add prompts.
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ marginBottom: '16px' }}>
                                            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                                Your Saved Prompts
                                            </h3>
                                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                                Prompts you've added from your college list
                                            </p>
                                        </div>
                                        {Object.entries(promptsByCollege).map(([collegeId, prompts]) => (
                                            <div key={collegeId} style={{ marginBottom: '24px' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '12px',
                                                    paddingBottom: '8px',
                                                    borderBottom: '1px solid #E5E7EB'
                                                }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#437E84' }}>school</span>
                                                    <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937', margin: 0 }}>
                                                        {getCollegeName(collegeId)}
                                                    </h4>
                                                    <span style={{
                                                        fontSize: '12px',
                                                        color: '#6B7280',
                                                        background: '#F3F4F6',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px'
                                                    }}>
                                                        {prompts.length} prompt{prompts.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {prompts.map(prompt => (
                                                        <div
                                                            key={prompt.id}
                                                            onClick={() => handleSelectSavedPrompt(prompt)}
                                                            style={{
                                                                padding: '16px',
                                                                borderRadius: '12px',
                                                                border: selectedPrompt === prompt.id ? '2px solid #437E84' : '1px solid #E5E7EB',
                                                                background: selectedPrompt === prompt.id ? '#F0FDFA' : 'white',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'flex-start',
                                                                gap: '12px'
                                                            }}
                                                        >
                                                            <div style={{ flex: 1 }}>
                                                                <p style={{
                                                                    fontSize: '14px',
                                                                    lineHeight: '1.5',
                                                                    color: '#374151',
                                                                    margin: 0
                                                                }}>
                                                                    {prompt.promptText}
                                                                </p>
                                                                {prompt.wordLimit && (
                                                                    <span style={{
                                                                        fontSize: '12px',
                                                                        color: '#6B7280',
                                                                        display: 'inline-block',
                                                                        marginTop: '8px',
                                                                        background: '#F3F4F6',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '4px'
                                                                    }}>
                                                                        {prompt.wordLimit} words max
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {selectedPrompt === prompt.id && (
                                                                <span className="material-symbols-outlined" style={{ color: '#437E84', fontSize: '20px' }}>
                                                                    check_circle
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Custom Tab */}
                        {activeTab === 'custom' && (
                            <div style={{ padding: '24px' }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                                        New Prompt
                                    </h3>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                        Enter any prompt or topic you'd like to brainstorm
                                    </p>
                                </div>
                                <textarea
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="Paste your college supplemental prompt here..."
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        border: '1px solid #D1D5DB',
                                        minHeight: '150px',
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        resize: 'vertical',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        )}

                        {/* Context Info & Generate Button - Only show for prompt tabs */}
                        {activeTab !== 'ideas' && (
                            <div style={{ padding: '0 24px 24px' }}>
                                <div style={{
                                    background: '#F8FAFC',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    marginBottom: '20px',
                                    border: '1px solid #E2E8F0'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#437E84' }}>visibility</span>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Context included:</span>
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                        Neil will analyze your activities and honors to help you come up with a great idea!
                                    </p>
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={(activeTab === 'custom' && !customPrompt.trim()) ||
                                        (activeTab === 'saved' && savedPrompts.length === 0)}
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        background: 'linear-gradient(135deg, #437E84 0%, #2D5559 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: '600',
                                        fontSize: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        boxShadow: '0 4px 12px rgba(67, 126, 132, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        opacity: ((activeTab === 'custom' && !customPrompt.trim()) ||
                                            (activeTab === 'saved' && savedPrompts.length === 0)) ? 0.5 : 1
                                    }}
                                >
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                    Generate Ideas
                                </button>
                                {error && <p style={{ color: '#DC2626', marginTop: '12px', fontSize: '14px', textAlign: 'center' }}>{error}</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'generating' && (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div className={styles.loadingContainer} style={{ position: 'relative', background: 'transparent', height: 'auto', width: 'auto' }}>
                        <div className={styles.loadingImage}>
                            <img src="/assets/dancing.gif" alt="Thinking..." width={120} height={120} />
                        </div>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginTop: '16px' }}>Neil is brainstorming...</h3>
                    <p style={{ color: '#6B7280' }}>Connecting your experiences to the prompt.</p>
                </div>
            )}

            {step === 'results' && (
                <div>
                    <button
                        onClick={() => setStep('select')}
                        style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: '0', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <span className="material-symbols-outlined">arrow_back</span> Back to Prompts
                    </button>

                    {/* Show the selected prompt */}
                    <div style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        border: '1px solid #E5E7EB',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#437E84' }}>format_quote</span>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Selected Prompt
                            </span>
                        </div>
                        <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#374151', margin: 0 }}>
                            {activeTab === 'custom' ? customPrompt : selectedPromptText}
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        {generatedIdeas.map((idea, idx) => (
                            <div key={idx} style={{
                                background: 'white',
                                borderRadius: '16px',
                                padding: '24px',
                                border: '1px solid #E5E7EB',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{ background: '#F0FDFA', color: '#0F766E', fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', width: 'fit-content', marginBottom: '12px' }}>
                                    Angle {idx + 1}
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: '#1F2937' }}>{idea.title}</h3>
                                <p style={{ color: '#4B5563', fontSize: '15px', lineHeight: '1.6', marginBottom: '20px', flex: 1 }}>
                                    {idea.description}
                                </p>

                                <div style={{ marginBottom: '20px' }}>
                                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Key Connections:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {idea.connections.map((c, i) => (
                                            <span key={i} style={{ fontSize: '12px', background: '#F3F4F6', color: '#6B7280', padding: '4px 10px', borderRadius: '12px' }}>
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSaveIdea(idea)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'white',
                                        border: '2px solid #437E84',
                                        color: '#437E84',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#437E84';
                                        e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'white';
                                        e.currentTarget.style.color = '#437E84';
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                                    Save This Idea
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

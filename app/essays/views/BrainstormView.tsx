'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import styles from '../../dashboard/dashboard.module.css';

type EssayStatus = 'Idea' | 'In Progress' | 'Proofread' | 'Submitted';

interface Essay {
    id: string;
    title: string;
    idea: string;
    content?: string;
    status?: EssayStatus;
    assignedColleges?: string[];
    assignedValues?: string[];
    isCommonApp?: boolean;
    sourceEssayId?: string;
    promptId?: string;
    collegeId?: string;
}

interface BrainstormViewProps {
    user: User | null;
    essays: Essay[];
    setEssays: React.Dispatch<React.SetStateAction<Essay[]>>;
    setCounts: React.Dispatch<React.SetStateAction<any>>;
}

export default function BrainstormView({ user, essays, setEssays, setCounts }: BrainstormViewProps) {
    const router = useRouter();
    const [newIdeaTitle, setNewIdeaTitle] = useState('');
    const [newIdeaContent, setNewIdeaContent] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // Filter only essays with status 'Idea'
    const ideas = essays.filter(essay => !essay.status || essay.status === 'Idea');

    const handleAddIdea = async () => {
        if (!user || !newIdeaTitle.trim()) return;

        try {
            const newEssay = {
                title: newIdeaTitle.trim(),
                idea: newIdeaContent.trim(),
                status: 'Idea' as EssayStatus,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                assignedColleges: [],
                assignedValues: []
            };

            const docRef = await addDoc(collection(db, 'users', user.uid, 'essays'), newEssay);

            const createdEssay = {
                id: docRef.id,
                ...newEssay
            };

            setEssays(prev => [createdEssay, ...prev]);
            setCounts((prev: any) => ({ ...prev, essays: prev.essays + 1 }));

            setNewIdeaTitle('');
            setNewIdeaContent('');
            setIsAdding(false);
        } catch (error) {
            console.error('Error adding idea:', error);
        }
    };

    const handleConvertToEssay = async (essay: Essay) => {
        if (!user) return;

        try {
            await updateDoc(doc(db, 'users', user.uid, 'essays', essay.id), {
                status: 'In Progress'
            });

            setEssays(prev => prev.map(e =>
                e.id === essay.id ? { ...e, status: 'In Progress' } : e
            ));

            // Optional: Redirect to editor immediately
            // router.push(`/essays/${essay.id}`);
        } catch (error) {
            console.error('Error converting idea:', error);
        }
    };

    return (
        <div style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
            }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>Brainstorming Board</h2>
                    <p style={{ color: '#6B7280', fontSize: '14px' }}>Capture your thoughts before they fly away.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    style={{
                        background: '#437E84',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 4px rgba(67, 126, 132, 0.2)'
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                    New Idea
                </button>
            </div>

            {isAdding && (
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    border: '1px solid #E5E7EB',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <input
                        type="text"
                        placeholder="What's the core idea? (e.g. The time I got lost in Tokyo)"
                        value={newIdeaTitle}
                        onChange={(e) => setNewIdeaTitle(e.target.value)}
                        style={{
                            width: '100%',
                            fontSize: '16px',
                            fontWeight: '500',
                            padding: '12px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            outline: 'none'
                        }}
                        autoFocus
                    />
                    <textarea
                        placeholder="Elaborate a bit... (optional)"
                        value={newIdeaContent}
                        onChange={(e) => setNewIdeaContent(e.target.value)}
                        style={{
                            width: '100%',
                            minHeight: '100px',
                            padding: '12px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            fontSize: '14px'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button
                            onClick={() => setIsAdding(false)}
                            style={{
                                background: 'white',
                                border: '1px solid #D1D5DB',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#374151'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddIdea}
                            disabled={!newIdeaTitle.trim()}
                            style={{
                                background: '#437E84',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                opacity: newIdeaTitle.trim() ? 1 : 0.5
                            }}
                        >
                            Save Idea
                        </button>
                    </div>
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '20px',
                overflowY: 'auto',
                paddingBottom: '20px'
            }}>
                {ideas.map(idea => (
                    <div
                        key={idea.id}
                        style={{
                            background: '#FFFBEB', // Light yellow for sticky note feel
                            borderRadius: '2px',
                            padding: '20px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: '200px',
                            position: 'relative',
                            transition: 'transform 0.2s',
                            cursor: 'default',
                            borderTop: '24px solid rgba(0,0,0,0.03)' // Tape effect
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#4B5563' }}>
                            {idea.title}
                        </h3>
                        <p style={{
                            fontSize: '14px',
                            color: '#6B7280',
                            lineHeight: '1.6',
                            flex: 1,
                            whiteSpace: 'pre-wrap'
                        }}>
                            {idea.idea || idea.content?.replace(/<[^>]*>/g, '')}
                        </p>

                        <div style={{
                            marginTop: '20px',
                            paddingTop: '16px',
                            borderTop: '1px dashed rgba(0,0,0,0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <button
                                onClick={() => router.push(`/essays/${idea.id}`)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#6B7280',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                                Edit
                            </button>
                            <button
                                onClick={() => handleConvertToEssay(idea)}
                                style={{
                                    background: 'white',
                                    border: '1px solid #F59E0B',
                                    color: '#D97706',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                Start Writing
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                            </button>
                        </div>
                    </div>
                ))}

                {ideas.length === 0 && !isAdding && (
                    <div style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '60px',
                        color: '#9CA3AF',
                        background: '#F9FAFB',
                        borderRadius: '12px',
                        border: '2px dashed #E5E7EB'
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', color: '#D1D5DB' }}>lightbulb</span>
                        <p style={{ fontSize: '16px', fontWeight: '500' }}>No ideas yet</p>
                        <p style={{ fontSize: '14px' }}>Click "New Idea" to start brainstorming!</p>
                    </div>
                )}
            </div>
        </div>
    );
}

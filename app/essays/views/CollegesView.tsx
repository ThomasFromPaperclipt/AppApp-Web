'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, addDoc, deleteDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import styles from '../../dashboard/dashboard.module.css';

interface College {
    id: string;
    collegeName: string;
}

type EssayStatus = 'Idea' | 'In Progress' | 'Proofread' | 'Submitted';

interface Essay {
    id: string;
    title: string;
    idea: string;
    content?: string;
    status?: EssayStatus;
    assignedValues?: string[];
    assignedColleges?: string[];
    isCommonApp?: boolean;
    sourceEssayId?: string;
    promptId?: string;
    collegeId?: string;
}

interface Prompt {
    id: string;
    collegeId: string;
    promptText: string;
    linkedEssayId?: string;
    wordLimit?: number;
}

interface Value {
    id: string;
    name: string;
    color: string;
}

interface CollegesViewProps {
    user: User | null;
    essays: Essay[];
    colleges: College[];
    setEssays: React.Dispatch<React.SetStateAction<Essay[]>>;
    initialExpandedCollegeId?: string;
}

export default function CollegesView({ user, essays, colleges, setEssays, initialExpandedCollegeId }: CollegesViewProps) {
    const router = useRouter();
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [values, setValues] = useState<Value[]>([]);
    const [expandedCollegeId, setExpandedCollegeId] = useState<string | null>(null);
    const [newPromptText, setNewPromptText] = useState('');
    const [newPromptWordLimit, setNewPromptWordLimit] = useState('');
    const [addingPromptTo, setAddingPromptTo] = useState<string | null>(null);
    const [draggedEssayId, setDraggedEssayId] = useState<string | null>(null);
    const [editingWordLimitFor, setEditingWordLimitFor] = useState<string | null>(null);
    const [editWordLimitValue, setEditWordLimitValue] = useState('');

    useEffect(() => {
        if (initialExpandedCollegeId) {
            setExpandedCollegeId(initialExpandedCollegeId);
            // Optional: Scroll to element logic could go here
        }
    }, [initialExpandedCollegeId]);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                // Fetch Prompts
                const promptsSnapshot = await getDocs(collection(db, 'users', user.uid, 'essay_prompts'));
                const promptsData = promptsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Prompt));
                setPrompts(promptsData);

                // Fetch Values (for displaying dots)
                const valuesSnapshot = await getDocs(collection(db, 'users', user.uid, 'essay_values'));
                const valuesData = valuesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Value));
                setValues(valuesData);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, [user]);

    const handleAddPrompt = async (collegeId: string) => {
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
            setAddingPromptTo(null);
        } catch (error) {
            console.error('Error adding prompt:', error);
        }
    };

    const handleDeletePrompt = async (promptId: string) => {
        if (!user || !confirm('Delete this prompt?')) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'essay_prompts', promptId));
            setPrompts(prev => prev.filter(p => p.id !== promptId));
        } catch (error) {
            console.error('Error deleting prompt:', error);
        }
    };

    const handleUpdateWordLimit = async (promptId: string) => {
        if (!user) return;

        try {
            const wordLimit = editWordLimitValue ? parseInt(editWordLimitValue) : null;
            await updateDoc(doc(db, 'users', user.uid, 'essay_prompts', promptId), {
                wordLimit: wordLimit || null
            });

            setPrompts(prev => prev.map(p =>
                p.id === promptId ? { ...p, wordLimit: wordLimit || undefined } : p
            ));
            setEditingWordLimitFor(null);
            setEditWordLimitValue('');
        } catch (error) {
            console.error('Error updating word limit:', error);
        }
    };

    const handleAssignEssayToPrompt = async (promptId: string, essayId: string) => {
        if (!user) return;

        try {
            await updateDoc(doc(db, 'users', user.uid, 'essay_prompts', promptId), {
                linkedEssayId: essayId
            });

            setPrompts(prev => prev.map(p =>
                p.id === promptId ? { ...p, linkedEssayId: essayId } : p
            ));

            // Also update the essay to include this college in assignedColleges if not already
            const prompt = prompts.find(p => p.id === promptId);
            const essay = essays.find(e => e.id === essayId);

            if (prompt && essay && !essay.assignedColleges?.includes(prompt.collegeId)) {
                const newColleges = [...(essay.assignedColleges || []), prompt.collegeId];
                await updateDoc(doc(db, 'users', user.uid, 'essays', essayId), {
                    assignedColleges: newColleges
                });
                setEssays(prev => prev.map(e =>
                    e.id === essayId ? { ...e, assignedColleges: newColleges } : e
                ));
            }
        } catch (error) {
            console.error('Error linking essay:', error);
        }
    };

    const handleWriteCustom = async (promptId: string) => {
        if (!user) return;

        const prompt = prompts.find(p => p.id === promptId);
        if (!prompt) return;

        try {
            // Create new essay
            const newEssay = {
                title: `Essay for ${colleges.find(c => c.id === prompt.collegeId)?.collegeName}`,
                idea: '',
                status: 'In Progress',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                assignedColleges: [prompt.collegeId],
                assignedValues: [],
                promptId: promptId,
                collegeId: prompt.collegeId
            };

            const docRef = await addDoc(collection(db, 'users', user.uid, 'essays'), newEssay);

            // Link it to prompt
            await handleAssignEssayToPrompt(promptId, docRef.id);

            // Redirect to editor
            router.push(`/essays/${docRef.id}`);
        } catch (error) {
            console.error('Error creating custom essay:', error);
        }
    };

    const handleBranchEssay = async (promptId: string, baseEssayId: string) => {
        if (!user) return;

        const baseEssay = essays.find(e => e.id === baseEssayId);
        const prompt = prompts.find(p => p.id === promptId);
        const college = colleges.find(c => c.id === prompt?.collegeId);

        if (!baseEssay || !prompt || !college) return;

        try {
            // Create a new version of the essay
            const newEssay = {
                title: `${baseEssay.title} - ${college.collegeName}`,
                idea: baseEssay.idea,
                content: baseEssay.content || '', // Copy content
                status: 'In Progress' as EssayStatus,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                assignedColleges: [college.id],
                assignedValues: baseEssay.assignedValues || [],
                sourceEssayId: baseEssay.id, // Link to base
                promptId: prompt.id,
                collegeId: college.id
            };

            const docRef = await addDoc(collection(db, 'users', user.uid, 'essays'), newEssay);

            // Link the NEW version to the prompt
            await updateDoc(doc(db, 'users', user.uid, 'essay_prompts', promptId), {
                linkedEssayId: docRef.id
            });

            setPrompts(prev => prev.map(p =>
                p.id === promptId ? { ...p, linkedEssayId: docRef.id } : p
            ));

            const createdEssay = { id: docRef.id, ...newEssay };
            setEssays(prev => [createdEssay, ...prev]);

        } catch (error) {
            console.error('Error branching essay:', error);
        }
    };

    const handleUnlinkEssay = async (promptId: string) => {
        if (!user) return;
        const prompt = prompts.find(p => p.id === promptId);
        if (!prompt || !prompt.linkedEssayId) return;

        const linkedEssay = essays.find(e => e.id === prompt.linkedEssayId);
        if (!linkedEssay) return;

        // Check if it's a versioned essay (has sourceEssayId)
        if (linkedEssay.sourceEssayId) {
            if (confirm("WARNING: Unlinking this essay will PERMANENTLY DELETE this college's version. Branches linked to other colleges will be saved. Do you wish to proceed?")) {
                try {
                    // Delete the essay doc
                    await deleteDoc(doc(db, 'users', user.uid, 'essays', linkedEssay.id));

                    // Update prompt to remove link
                    await updateDoc(doc(db, 'users', user.uid, 'essay_prompts', promptId), {
                        linkedEssayId: ''
                    });

                    // Update state
                    setEssays(prev => prev.filter(e => e.id !== linkedEssay.id));
                    setPrompts(prev => prev.map(p => p.id === promptId ? { ...p, linkedEssayId: '' } : p));
                } catch (error) {
                    console.error("Error unlinking/deleting essay:", error);
                }
            }
        } else {
            // Just unlink if it's not a version (fallback)
            handleAssignEssayToPrompt(promptId, '');
        }
    };

    const handleDragStart = (e: React.DragEvent, essayId: string) => {
        e.dataTransfer.setData('essayId', essayId);
        setDraggedEssayId(essayId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, promptId: string) => {
        e.preventDefault();
        const essayId = e.dataTransfer.getData('essayId');
        if (essayId) {
            // Check if it's a base essay or already a version
            const essay = essays.find(e => e.id === essayId);
            if (essay && !essay.sourceEssayId) {
                // It's a base essay, so BRANCH it
                handleBranchEssay(promptId, essayId);
            } else {
                // It's already a version (or we just want to link it directly? 
                // User said "whenever someone adds that idea... the doc to sort of branch".
                // So we should probably always branch if it's coming from the "Available Essays" list which are likely base essays/ideas.
                // But if they drag a version, maybe just move it? 
                // For now, assume dragging from the right sidebar (which shows all essays) implies branching if it's a base essay.
                handleAssignEssayToPrompt(promptId, essayId);
            }
        }
        setDraggedEssayId(null);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
            {/* Values Legend */}
            <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '16px',
                background: 'white',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Values Key:</span>
                {values.length === 0 ? (
                    <span style={{ fontSize: '14px', color: '#9CA3AF', fontStyle: 'italic' }}>No values defined yet. Go to Values tab to add some!</span>
                ) : (
                    values.map(value => (
                        <div key={value.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: value.color }} />
                            <span style={{ fontSize: '13px', color: '#4B5563' }}>{value.name}</span>
                        </div>
                    ))
                )}
            </div>

            <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
                {/* Left Column: Colleges Accordion */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px' }}>
                    {colleges.map(college => {
                        const isExpanded = expandedCollegeId === college.id;
                        const collegePrompts = prompts.filter(p => p.collegeId === college.id);

                        // Calculate values covered by this college
                        const coveredValueIds = new Set<string>();
                        collegePrompts.forEach(p => {
                            if (p.linkedEssayId) {
                                const essay = essays.find(e => e.id === p.linkedEssayId);
                                essay?.assignedValues?.forEach(vId => coveredValueIds.add(vId));
                            }
                        });

                        return (
                            <div
                                key={college.id}
                                style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    marginBottom: '16px',
                                    border: '1px solid #E5E7EB',
                                    overflow: 'hidden'
                                }}
                            >
                                <div
                                    onClick={() => setExpandedCollegeId(isExpanded ? null : college.id)}
                                    style={{
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: isExpanded ? '#F9FAFB' : 'white',
                                        borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937' }}>
                                            {college.collegeName}
                                        </h3>
                                        {/* Value Dots Summary */}
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {Array.from(coveredValueIds).map(vId => {
                                                const value = values.find(v => v.id === vId);
                                                if (!value) return null;
                                                return (
                                                    <div
                                                        key={vId}
                                                        title={value.name}
                                                        style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            background: value.color
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined" style={{
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                        transition: 'transform 0.2s'
                                    }}>
                                        expand_more
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div style={{ padding: '20px' }}>
                                        {collegePrompts.map(prompt => {
                                            const linkedEssay = essays.find(e => e.id === prompt.linkedEssayId);

                                            return (
                                                <div
                                                    key={prompt.id}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, prompt.id)}
                                                    style={{
                                                        marginBottom: '16px',
                                                        padding: '16px',
                                                        background: linkedEssay ? '#F0FDF4' : '#F9FAFB',
                                                        border: `1px dashed ${linkedEssay ? '#86EFAC' : '#D1D5DB'}`,
                                                        borderRadius: '8px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <p style={{ fontSize: '14px', color: '#374151', fontWeight: '500', marginBottom: '4px' }}>
                                                                {prompt.promptText}
                                                            </p>
                                                            {editingWordLimitFor === prompt.id ? (
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                                                    <input
                                                                        type="number"
                                                                        value={editWordLimitValue}
                                                                        onChange={(e) => setEditWordLimitValue(e.target.value)}
                                                                        placeholder="Word limit"
                                                                        style={{
                                                                            padding: '4px 8px',
                                                                            borderRadius: '4px',
                                                                            border: '1px solid #D1D5DB',
                                                                            fontSize: '12px',
                                                                            width: '100px'
                                                                        }}
                                                                        autoFocus
                                                                    />
                                                                    <button
                                                                        onClick={() => handleUpdateWordLimit(prompt.id)}
                                                                        style={{
                                                                            padding: '4px 8px',
                                                                            fontSize: '11px',
                                                                            background: '#10B981',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            borderRadius: '4px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingWordLimitFor(null);
                                                                            setEditWordLimitValue('');
                                                                        }}
                                                                        style={{
                                                                            padding: '4px 8px',
                                                                            fontSize: '11px',
                                                                            background: '#F3F4F6',
                                                                            color: '#374151',
                                                                            border: 'none',
                                                                            borderRadius: '4px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                                                    {prompt.wordLimit ? (
                                                                        <p style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic', margin: 0 }}>
                                                                            Word limit: {prompt.wordLimit}
                                                                        </p>
                                                                    ) : (
                                                                        <p style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>
                                                                            No word limit
                                                                        </p>
                                                                    )}
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingWordLimitFor(prompt.id);
                                                                            setEditWordLimitValue(prompt.wordLimit?.toString() || '');
                                                                        }}
                                                                        style={{
                                                                            padding: '2px 6px',
                                                                            fontSize: '11px',
                                                                            background: 'none',
                                                                            color: '#6B7280',
                                                                            border: '1px solid #D1D5DB',
                                                                            borderRadius: '4px',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        {prompt.wordLimit ? 'Edit' : 'Add'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeletePrompt(prompt.id)}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                                                        </button>
                                                    </div>

                                                    {linkedEssay ? (
                                                        <div style={{
                                                            background: 'white',
                                                            padding: '12px',
                                                            borderRadius: '6px',
                                                            border: '1px solid #E5E7EB',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center'
                                                        }}>
                                                            <div>
                                                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937' }}>
                                                                    {linkedEssay.title}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                                    {linkedEssay.assignedValues?.map(vId => {
                                                                        const value = values.find(v => v.id === vId);
                                                                        if (!value) return null;
                                                                        return (
                                                                            <div
                                                                                key={vId}
                                                                                style={{
                                                                                    fontSize: '10px',
                                                                                    padding: '2px 6px',
                                                                                    borderRadius: '10px',
                                                                                    background: value.color + '20',
                                                                                    color: value.color,
                                                                                    fontWeight: '500'
                                                                                }}
                                                                            >
                                                                                {value.name}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    onClick={() => router.push(`/essays/${linkedEssay.id}`)}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        fontSize: '12px',
                                                                        background: '#EFF6FF',
                                                                        color: '#3B82F6',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUnlinkEssay(prompt.id)}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        fontSize: '12px',
                                                                        background: '#FEF2F2',
                                                                        color: '#EF4444',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Unlink
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: '12px',
                                                            color: '#6B7280'
                                                        }}>
                                                            <div style={{ fontSize: '13px' }}>Drag an idea here or</div>
                                                            <button
                                                                onClick={() => handleWriteCustom(prompt.id)}
                                                                style={{
                                                                    background: 'white',
                                                                    border: '1px solid #D1D5DB',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '13px',
                                                                    cursor: 'pointer',
                                                                    fontWeight: '500'
                                                                }}
                                                            >
                                                                Write New Essay
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}


                                        {addingPromptTo === college.id ? (
                                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    value={newPromptText}
                                                    onChange={(e) => setNewPromptText(e.target.value)}
                                                    placeholder="Enter prompt text..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #E5E7EB',
                                                        fontSize: '14px'
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
                                                        border: '1px solid #E5E7EB',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => handleAddPrompt(college.id)}
                                                        disabled={!newPromptText.trim()}
                                                        style={{
                                                            background: '#437E84',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            padding: '8px 16px',
                                                            cursor: 'pointer',
                                                            opacity: newPromptText.trim() ? 1 : 0.5
                                                        }}
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setAddingPromptTo(null);
                                                            setNewPromptWordLimit('');
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: '1px solid #D1D5DB',
                                                            borderRadius: '6px',
                                                            padding: '8px 16px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setAddingPromptTo(college.id);
                                                    setNewPromptText('');
                                                    setNewPromptWordLimit('');
                                                }}
                                                style={{
                                                    marginTop: '8px',
                                                    background: 'none',
                                                    border: '1px dashed #D1D5DB',
                                                    width: '100%',
                                                    padding: '8px',
                                                    borderRadius: '6px',
                                                    color: '#6B7280',
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                                Add Prompt
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {colleges.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                            No colleges added yet. Go to "My Colleges" to add some!
                        </div>
                    )}
                </div>

                {/* Right Column: Draggable Ideas/Essays */}
                <div style={{
                    width: '300px',
                    background: '#F3F4F6',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>
                        Available Essays
                    </h3>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {essays.filter(e => !e.sourceEssayId && !e.isCommonApp).map(essay => (
                            <div
                                key={essay.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, essay.id)}
                                style={{
                                    background: 'white',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginBottom: '12px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    cursor: 'grab',
                                    border: '1px solid #E5E7EB',
                                    opacity: draggedEssayId === essay.id ? 0.5 : 1
                                }}
                            >
                                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: '#1F2937' }}>
                                    {essay.title}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                                    {essay.status || 'Idea'}
                                </div>
                                {/* Value Dots */}
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {essay.assignedValues?.map(vId => {
                                        const value = values.find(v => v.id === vId);
                                        if (!value) return null;
                                        return (
                                            <div
                                                key={vId}
                                                title={value.name}
                                                style={{
                                                    width: '6px',
                                                    height: '6px',
                                                    borderRadius: '50%',
                                                    background: value.color
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

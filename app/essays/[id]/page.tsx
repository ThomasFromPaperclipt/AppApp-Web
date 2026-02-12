'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import DOMPurify from 'dompurify';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import styles from '../../dashboard/dashboard.module.css';
import { useDebounce } from '@/hooks/useDebounce';

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
    commonAppPrompt?: string;
    sourceEssayId?: string;
    promptId?: string;
    collegeId?: string;
    promptText?: string; // Prompt text stored directly from idea generator
    isEmphasized?: boolean;
}

interface Prompt {
    id: string;
    promptText: string;
    wordLimit?: number;
}

interface Value {
    id: string;
    name: string;
    color: string;
}

interface College {
    id: string;
    collegeName: string;
}

export default function EssayEditor() {
    const router = useRouter();
    const params = useParams();
    const [user, setUser] = useState<User | null>(null);
    const [essay, setEssay] = useState<Essay | null>(null);
    const [prompt, setPrompt] = useState<Prompt | null>(null);
    const [college, setCollege] = useState<College | null>(null);
    const [collegeEssays, setCollegeEssays] = useState<Essay[]>([]);
    const [values, setValues] = useState<Value[]>([]);
    const [loading, setLoading] = useState(true);

    // Auto-save state
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Snapshot state for robust comparison
    const lastSavedSnapshot = useRef<string>('');
    const isInitialLoad = useRef(true);

    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [promptLocked, setPromptLocked] = useState(true);
    const [editedPromptText, setEditedPromptText] = useState('');

    // Word limit editing state
    const [editingWordLimit, setEditingWordLimit] = useState(false);
    const [editWordLimitValue, setEditWordLimitValue] = useState('');

    // Side-by-Side State
    const [showSideBySide, setShowSideBySide] = useState(false);
    const [siblingEssays, setSiblingEssays] = useState<Essay[]>([]);
    const [selectedSiblingId, setSelectedSiblingId] = useState<string | null>(null);
    const [siblingContent, setSiblingContent] = useState<string>('');

    // Word count state
    const [wordCount, setWordCount] = useState(0);

    // Debounce the essay state for auto-saving
    const debouncedEssay = useDebounce(essay, 2000);

    // Helper to generate a snapshot string for comparison
    const getEssaySnapshot = (e: Essay | null) => {
        if (!e) return '';
        return JSON.stringify({
            title: e.title,
            content: e.content,
            commonAppPrompt: e.commonAppPrompt,
            assignedValues: e.assignedValues?.sort(), // Sort for consistent comparison
            status: e.status
        });
    };

    // Calculate word count from editor content
    const calculateWordCount = (html: string): number => {
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) return 0;
        return text.split(/\s+/).length;
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Start writing your masterpiece...',
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: '',
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            if (essay) {
                const content = editor.getHTML();
                setEssay(prev => prev ? ({ ...prev, content }) : null);
                setWordCount(calculateWordCount(content));
            }
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
                style: 'min-height: 800px; padding: 40px; outline: none;'
            },
        },
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/');
                return;
            }
            setUser(user);

            if (params.id) {
                try {
                    const essayDoc = await getDoc(doc(db, 'users', user.uid, 'essays', params.id as string));
                    if (essayDoc.exists()) {
                        const essayData = { id: essayDoc.id, ...essayDoc.data() } as Essay;
                        setEssay(essayData);
                        lastSavedSnapshot.current = getEssaySnapshot(essayData); // Initialize snapshot
                        //setLastSaved(essayData.lastModified ? new Date(essayData.lastModified) : new Date());

                        editor?.commands.setContent(essayData.content || '');

                        // Fetch Prompt if exists
                        if (essayData.promptId) {
                            const promptDoc = await getDoc(doc(db, 'users', user.uid, 'essay_prompts', essayData.promptId));
                            if (promptDoc.exists()) {
                                setPrompt({ id: promptDoc.id, ...promptDoc.data() } as Prompt);
                            }
                        }

                        // Fetch Siblings (same sourceEssayId)
                        if (essayData.sourceEssayId) {
                            const essaysSnapshot = await getDocs(collection(db, 'users', user.uid, 'essays'));
                            const siblings = essaysSnapshot.docs
                                .map(d => ({ id: d.id, ...d.data() } as Essay))
                                .filter(e =>
                                    (e.sourceEssayId === essayData.sourceEssayId || e.id === essayData.sourceEssayId) &&
                                    e.id !== essayData.id
                                );
                            setSiblingEssays(siblings);
                        }

                        // Fetch College if exists
                        if (essayData.collegeId) {
                            const collegeDoc = await getDoc(doc(db, 'users', user.uid, 'colleges', essayData.collegeId));
                            if (collegeDoc.exists()) {
                                setCollege({ id: collegeDoc.id, ...collegeDoc.data() } as College);
                            }

                            // Fetch other essays for this college
                            const essaysSnapshot = await getDocs(collection(db, 'users', user.uid, 'essays'));
                            const otherCollegeEssays = essaysSnapshot.docs
                                .map(d => ({ id: d.id, ...d.data() } as Essay))
                                .filter(e => e.collegeId === essayData.collegeId && e.id !== essayData.id);
                            setCollegeEssays(otherCollegeEssays);
                        }
                    }

                    // Fetch Values
                    const valuesSnapshot = await getDocs(collection(db, 'users', user.uid, 'essay_values'));
                    const valuesData = valuesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as Value));
                    setValues(valuesData);

                } catch (error) {
                    console.error('Error fetching data:', error);
                } finally {
                    setLoading(false);
                    // allow auto-save after initial data load
                    setTimeout(() => { isInitialLoad.current = false; }, 1000);
                }
            }
        });

        return () => unsubscribe();
    }, [router, params.id, editor]);

    // Update word count when essay content loads
    useEffect(() => {
        if (essay?.content) {
            setWordCount(calculateWordCount(essay.content));
        }
    }, [essay?.content]);

    // Update sibling content when selection changes
    useEffect(() => {
        if (selectedSiblingId && user) {
            const fetchSibling = async () => {
                const docRef = await getDoc(doc(db, 'users', user.uid, 'essays', selectedSiblingId));
                if (docRef.exists()) {
                    const data = docRef.data() as Essay;
                    setSiblingContent(data.content || data.idea || '');
                }
            };
            fetchSibling();
        }
    }, [selectedSiblingId, user]);

    // Reusable save function
    const saveEssay = useCallback(async (essayToSave: Essay) => {
        if (!user || !essayToSave) return;

        // Check if actually changed before saving (double check for manual saves)
        const currentSnapshot = getEssaySnapshot(essayToSave);
        if (currentSnapshot === lastSavedSnapshot.current) {
            // Already saved this state, just update timestamp locally if needed
            return;
        }

        setSaving(true);
        try {
            const now = new Date();
            await updateDoc(doc(db, 'users', user.uid, 'essays', essayToSave.id), {
                title: essayToSave.title,
                content: essayToSave.content, // Use content from essay object
                lastModified: now.toISOString(),
                commonAppPrompt: essayToSave.commonAppPrompt || '',
                assignedValues: essayToSave.assignedValues || [],
                status: essayToSave.status
            });
            setLastSaved(now);
            lastSavedSnapshot.current = currentSnapshot; // Update snapshot on success
        } catch (error) {
            console.error('Error saving essay:', error);
        } finally {
            setSaving(false);
        }
    }, [user]);

    // Effect for auto-save
    useEffect(() => {
        // Skip auto-save on initial load to prevent overwriting with old state or empty
        if (isInitialLoad.current || !debouncedEssay) return;

        const currentSnapshot = getEssaySnapshot(debouncedEssay);
        if (currentSnapshot !== lastSavedSnapshot.current) {
            saveEssay(debouncedEssay);
        }
    }, [debouncedEssay, saveEssay]);

    const handleManualSave = () => {
        if (essay) {
            // Manual save should force save even if snapshot matches? 
            // Usually not needed, but let's allow it just in case user wants to be sure.
            // Actually, we can just call saveEssay, it handles the check. 
            // Ideally manual save forces it, but for logic, if it's identical, it is saved.
            // Let's force it for manual action feedback.

            const forceSave = async () => {
                if (!user || !essay) return;
                setSaving(true);
                try {
                    const now = new Date();
                    await updateDoc(doc(db, 'users', user.uid, 'essays', essay.id), {
                        title: essay.title,
                        content: essay.content,
                        lastModified: now.toISOString(),
                        commonAppPrompt: essay.commonAppPrompt || '',
                        assignedValues: essay.assignedValues || [],
                        status: essay.status
                    });
                    setLastSaved(now);
                    lastSavedSnapshot.current = getEssaySnapshot(essay);
                } catch (error) {
                    console.error('Error saving essay:', error);
                } finally {
                    setSaving(false);
                }
            };
            forceSave();
        }
    };

    const handleDelete = async () => {
        if (!user || !essay || !confirm('Are you sure you want to delete this essay? This cannot be undone.')) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'essays', essay.id));
            router.push('/essays');
        } catch (error) {
            console.error('Error deleting essay:', error);
        }
    };

    const handleStatusChange = async (newStatus: EssayStatus) => {
        if (!essay) return;
        // Immediate update for status in UI
        const updatedEssay = { ...essay, status: newStatus };
        setEssay(updatedEssay);
        // Let debounce handle the save, naturally capturing the status change
    };

    const toggleValue = (valueId: string) => {
        if (!essay) return;
        const currentValues = essay.assignedValues || [];
        const newValues = currentValues.includes(valueId)
            ? currentValues.filter(id => id !== valueId)
            : [...currentValues, valueId];

        setEssay(prev => prev ? ({ ...prev, assignedValues: newValues }) : null);
    };

    const handleUpdateWordLimit = async () => {
        if (!user || !prompt) return;

        try {
            const wordLimit = editWordLimitValue ? parseInt(editWordLimitValue) : null;
            await updateDoc(doc(db, 'users', user.uid, 'essay_prompts', prompt.id), {
                wordLimit: wordLimit || null
            });

            setPrompt({ ...prompt, wordLimit: wordLimit || undefined });
            setEditingWordLimit(false);
            setEditWordLimitValue('');
        } catch (error) {
            console.error('Error updating word limit:', error);
        }
    };

    const handleSavePrompt = async () => {
        if (!user || !prompt || !editedPromptText.trim()) return;

        try {
            await updateDoc(doc(db, 'users', user.uid, 'essay_prompts', prompt.id), {
                promptText: editedPromptText.trim()
            });

            setPrompt({ ...prompt, promptText: editedPromptText.trim() });
            setPromptLocked(true);
        } catch (error) {
            console.error('Error updating prompt:', error);
        }
    };

    const handleSiblingSelect = async (siblingId: string) => {
        setSelectedSiblingId(siblingId);
        if (!user) return;
        const siblingDoc = await getDoc(doc(db, 'users', user.uid, 'essays', siblingId));
        if (siblingDoc.exists()) {
            setSiblingContent(siblingDoc.data().content || '');
        }
    };

    const formatLastSaved = (date: Date | null) => {
        if (!date) return '';
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Saved';

        return `Saved at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    // Calculate if we have unsaved changes dynamically for UI
    const hasUnsavedChanges = essay && (getEssaySnapshot(essay) !== lastSavedSnapshot.current);

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingImage}>
                    <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                </div>
            </div>
        );
    }

    if (!essay) return <div>Essay not found</div>;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#F3F4F6' }}>
            {/* Header */}
            <div style={{
                padding: '12px 24px',
                background: 'white',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                zIndex: 10,
                position: 'relative'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => router.push('/essays')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280' }}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <input
                            type="text"
                            value={essay.title}
                            onChange={(e) => {
                                setEssay({ ...essay, title: e.target.value });
                            }}
                            style={{
                                fontSize: '18px',
                                fontWeight: '600',
                                border: 'none',
                                outline: 'none',
                                width: '400px',
                                color: '#1F2937',
                                background: 'transparent'
                            }}
                            placeholder="Untitled Essay"
                        />
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {saving ? (
                                <>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }}></span>
                                    Saving...
                                </>
                            ) : hasUnsavedChanges ? (
                                <>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94A3B8', display: 'inline-block' }}></span>
                                    Unsaved changes
                                </>
                            ) : (
                                <>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                                    {formatLastSaved(lastSaved)}
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {/* Essay Editor Banner Image */}
                <img
                    src="/assets/essayEditor.png"
                    alt="Essay Editor"
                    style={{
                        width: '12%',
                        borderRadius: '12px',
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)'
                    }}
                />

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        onClick={async () => {
                            if (!user || !essay) return;
                            const newValue = !essay.isEmphasized;
                            try {
                                await updateDoc(doc(db, 'users', user.uid, 'essays', essay.id), {
                                    isEmphasized: newValue
                                });
                                setEssay(prev => prev ? ({ ...prev, isEmphasized: newValue }) : null);
                            } catch (error) {
                                console.error('Error toggling emphasis:', error);
                            }
                        }}
                        title={essay?.isEmphasized ? 'Remove highlight from parent/counselor view' : 'Highlight for parent/counselor'}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: essay?.isEmphasized ? '1px solid #F59E0B' : '1px solid #E5E7EB',
                            background: essay?.isEmphasized ? '#FFFBEB' : 'white',
                            color: essay?.isEmphasized ? '#D97706' : '#374151',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: essay?.isEmphasized ? '#F59E0B' : '#9CA3AF' }}>
                            {essay?.isEmphasized ? 'star' : 'star_outline'}
                        </span>
                        {essay?.isEmphasized ? 'Shared' : 'Share'}
                    </button>

                    <button
                        onClick={() => setShowSideBySide(!showSideBySide)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #E5E7EB',
                            background: showSideBySide ? '#F3F4F6' : 'white',
                            color: '#374151',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>vertical_split</span>
                        Compare
                    </button>

                    <button
                        onClick={handleDelete}
                        style={{
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#EF4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        title="Delete Essay"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                    </button>

                    <button
                        onClick={handleManualSave}
                        disabled={saving}
                        style={{
                            padding: '8px 24px',
                            borderRadius: '6px',
                            background: saving ? '#94A3B8' : '#437E84',
                            color: 'white',
                            fontWeight: '500',
                            border: 'none',
                            cursor: saving ? 'default' : 'pointer',
                            fontSize: '14px',
                            transition: 'background 0.2s'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>

                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6B7280',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <span className="material-symbols-outlined">
                            {sidebarOpen ? 'last_page' : 'first_page'}
                        </span>
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Main Editor Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '0 32px 32px 32px', alignItems: 'center' }}>
                    <div style={{ maxWidth: showSideBySide && selectedSiblingId ? '1200px' : '850px', margin: '32px auto 0 auto', width: '100%' }}>



                        {/* Prompt Display (College Specific) */}
                        {prompt && (
                            <div style={{
                                background: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '20px',
                                marginBottom: '24px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Prompt
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (promptLocked) {
                                                setEditedPromptText(prompt.promptText);
                                            } else {
                                                handleSavePrompt();
                                            }
                                            setPromptLocked(!promptLocked);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#6B7280',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                            {promptLocked ? 'lock' : 'lock_open'}
                                        </span>
                                        {promptLocked ? 'Unlock to Edit' : 'Lock & Save'}
                                    </button>
                                </div>
                                {promptLocked ? (
                                    <div style={{ fontSize: '15px', lineHeight: '1.6', color: '#374151' }}>
                                        {prompt.promptText}
                                        {prompt.wordLimit && (
                                            <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px', fontStyle: 'italic' }}>
                                                Word limit: {prompt.wordLimit}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <textarea
                                        value={editedPromptText}
                                        onChange={(e) => setEditedPromptText(e.target.value)}
                                        placeholder="Enter prompt text..."
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '6px',
                                            border: '1px solid #D1D5DB',
                                            minHeight: '100px',
                                            fontSize: '15px',
                                            fontFamily: 'inherit',
                                            resize: 'vertical',
                                            lineHeight: '1.6'
                                        }}
                                    />
                                )}
                            </div>
                        )}

                        {/* Prompt Text (from Idea Generator) - show if no linked prompt but has promptText */}
                        {!prompt && essay.promptText && !essay.isCommonApp && (
                            <div style={{
                                background: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '20px',
                                marginBottom: '24px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#437E84' }}>format_quote</span>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Essay Prompt
                                    </div>
                                </div>
                                <div style={{ fontSize: '15px', lineHeight: '1.6', color: '#374151' }}>
                                    {essay.promptText}
                                </div>
                            </div>
                        )}

                        {/* Generated Idea Text - show for essays with status 'Idea' and idea content */}
                        {essay.status === 'Idea' && essay.idea && (
                            <div style={{
                                background: '#F0FDFA',
                                border: '1px solid #99F6E4',
                                borderRadius: '8px',
                                padding: '20px',
                                marginBottom: '24px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0F766E' }}>lightbulb</span>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F766E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Generated Idea
                                    </div>
                                </div>
                                <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#134E4A', whiteSpace: 'pre-wrap' }}>
                                    {essay.idea}
                                </div>
                            </div>
                        )}

                        {/* Common App Prompt Input */}
                        {essay.isCommonApp && (
                            <div style={{ marginBottom: '24px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Common App Prompt
                                    </label>
                                    <button
                                        onClick={() => setPromptLocked(!promptLocked)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#6B7280',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                            {promptLocked ? 'lock' : 'lock_open'}
                                        </span>
                                        {promptLocked ? 'Unlock to Edit' : 'Lock'}
                                    </button>
                                </div>
                                {promptLocked ? (
                                    <div style={{ fontSize: '15px', lineHeight: '1.6', color: '#374151', minHeight: '24px' }}>
                                        {essay.commonAppPrompt || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No prompt selected. Unlock to add one.</span>}
                                    </div>
                                ) : (
                                    <textarea
                                        value={essay.commonAppPrompt || ''}
                                        onChange={(e) => {
                                            setEssay({ ...essay, commonAppPrompt: e.target.value });
                                        }}
                                        placeholder="Paste your chosen Common App prompt here..."
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '6px',
                                            border: '1px solid #D1D5DB',
                                            minHeight: '100px',
                                            fontSize: '15px',
                                            fontFamily: 'inherit',
                                            resize: 'vertical',
                                            lineHeight: '1.5'
                                        }}
                                    />
                                )}
                            </div>
                        )}

                        {/* Main Editor Area */}
                        <div style={{
                            flex: 1,
                            maxWidth: showSideBySide && selectedSiblingId ? '1200px' : '950px',
                            margin: '0 auto',
                            display: 'grid',
                            gridTemplateColumns: showSideBySide && selectedSiblingId ? 'minmax(500px, 1fr) minmax(500px, 1fr)' : '1fr',
                            gap: '24px',
                            padding: '24px',
                            transition: 'all 0.3s'
                        }}>
                            {/* Comparison Selection Overlay */}
                            {showSideBySide && !selectedSiblingId && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(74, 86, 80, 0.95)',
                                    zIndex: 10,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '40px',
                                    textAlign: 'center'
                                }}>
                                    <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#ffffffff', marginBottom: '8px' }}>Compare Versions</h2>
                                    <p style={{ color: '#ffffffff', marginBottom: '32px', maxWidth: '400px' }}>Select another branch of this essay to view it side-by-side with your current draft.</p>

                                    {siblingEssays.length > 0 ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', width: '100%', maxWidth: '800px' }}>
                                            {siblingEssays.map(sibling => (
                                                <button
                                                    key={sibling.id}
                                                    onClick={() => handleSiblingSelect(sibling.id)}
                                                    style={{
                                                        padding: '16px',
                                                        borderRadius: '12px',
                                                        border: '1px solid #E5E7EB',
                                                        background: 'white',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = '#437E84';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = '#E5E7EB';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>{sibling.title}</div>
                                                    <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{sibling.status || 'Draft'}</div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No other branches found to compare.</div>
                                    )}

                                    <button
                                        onClick={() => setShowSideBySide(false)}
                                        style={{ marginTop: '32px', color: '#c2c2c2ff', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}

                            {/* Left Column: Current Editor */}
                            <div style={{
                                background: 'white',
                                minHeight: '1056px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                                borderRadius: showSideBySide && selectedSiblingId ? '8px' : '0'
                            }}>
                                {/* Toolbar - Sticky */}
                                <div style={{
                                    padding: '12px 24px',
                                    borderBottom: '1px solid #E5E7EB',
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    position: 'sticky',
                                    top: 0,
                                    background: 'white',
                                    zIndex: 5
                                }}>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleBold().run()}
                                        style={{ background: editor?.isActive('bold') ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_bold</span>
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                                        style={{ background: editor?.isActive('italic') ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_italic</span>
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleUnderline().run()}
                                        style={{ background: editor?.isActive('underline') ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_underlined</span>
                                    </button>
                                    <div style={{ width: '1px', height: '20px', background: '#E5E7EB', margin: '0 4px' }} />
                                    <button
                                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                                        style={{ background: editor?.isActive('heading', { level: 1 }) ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_h1</span>
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                                        style={{ background: editor?.isActive('heading', { level: 2 }) ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_h2</span>
                                    </button>
                                    <div style={{ width: '1px', height: '20px', background: '#E5E7EB', margin: '0 4px' }} />
                                    <button
                                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                                        style={{ background: editor?.isActive('bulletList') ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_list_bulleted</span>
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                                        style={{ background: editor?.isActive('orderedList') ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_list_numbered</span>
                                    </button>
                                    <div style={{ width: '1px', height: '20px', background: '#E5E7EB', margin: '0 4px' }} />
                                    <button
                                        onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                                        style={{ background: editor?.isActive({ textAlign: 'left' }) ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_align_left</span>
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                                        style={{ background: editor?.isActive({ textAlign: 'center' }) ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_align_center</span>
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                                        style={{ background: editor?.isActive({ textAlign: 'right' }) ? '#E5E7EB' : 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer' }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_align_right</span>
                                    </button>
                                </div>
                                <EditorContent editor={editor} className={styles.editorContent} />
                            </div>

                            {/* Right Column: Compared Version */}
                            {showSideBySide && selectedSiblingId && (
                                <div style={{
                                    background: '#F9FAFB',
                                    minHeight: '1056px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative',
                                    borderRadius: '8px',
                                    opacity: 0.8,
                                    border: '1px solid #E5E7EB'
                                }}>
                                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB', background: '#F3F4F6', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comparing with</div>
                                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#4B5563' }}>
                                                {siblingEssays.find(s => s.id === selectedSiblingId)?.title}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedSiblingId(null);
                                                setShowSideBySide(false);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#6B7280',
                                                padding: '4px',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#E5E7EB'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                            title="Close comparison"
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                                        </button>
                                    </div>
                                    <div
                                        className={styles.editorContent}
                                        style={{ padding: '40px', color: '#4B5563', cursor: 'text' }}
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(siblingContent) }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar */}
                {sidebarOpen && (
                    <div style={{ width: '300px', borderLeft: '1px solid #E5E7EB', background: 'white', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

                        {/* Status Selector */}
                        <div style={{ padding: '20px', borderBottom: '1px solid #E5E7EB' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Status
                            </h3>
                            <select
                                value={essay?.status || 'Idea'}
                                onChange={(e) => handleStatusChange(e.target.value as EssayStatus)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #D1D5DB',
                                    fontSize: '14px',
                                    color: '#374151',
                                    background: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="Idea">Idea</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Proofread">Proofread</option>
                                <option value="Submitted">Submitted</option>
                            </select>
                        </div>

                        {/* Word Count Section */}
                        <div style={{ padding: '20px', borderBottom: '1px solid #E5E7EB' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Word Count
                            </h3>
                            <div style={{
                                fontSize: '48px',
                                fontWeight: '700',
                                color: prompt?.wordLimit
                                    ? (wordCount > prompt.wordLimit ? '#EF4444' : wordCount > prompt.wordLimit * 0.9 ? '#F59E0B' : '#10B981')
                                    : '#437E84',
                                lineHeight: '1',
                                marginBottom: '8px'
                            }}>
                                {wordCount}
                            </div>
                            {prompt?.wordLimit && (
                                <div style={{ fontSize: '14px', color: '#6B7280' }}>
                                    / {prompt.wordLimit} words
                                    <div style={{
                                        marginTop: '8px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        color: wordCount > prompt.wordLimit ? '#EF4444' : wordCount > prompt.wordLimit * 0.9 ? '#F59E0B' : '#10B981'
                                    }}>
                                        {wordCount > prompt.wordLimit
                                            ? `${wordCount - prompt.wordLimit} over limit`
                                            : `${prompt.wordLimit - wordCount} remaining`}
                                    </div>
                                </div>
                            )}

                            {/* Word Limit Editor */}
                            {editingWordLimit ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
                                    <input
                                        type="number"
                                        value={editWordLimitValue}
                                        onChange={(e) => setEditWordLimitValue(e.target.value)}
                                        placeholder="Word limit"
                                        style={{
                                            flex: 1,
                                            padding: '6px 10px',
                                            borderRadius: '6px',
                                            border: '1px solid #D1D5DB',
                                            fontSize: '13px'
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleUpdateWordLimit}
                                        style={{
                                            padding: '6px 10px',
                                            fontSize: '12px',
                                            background: '#10B981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: '500'
                                        }}
                                    >
                                        ✓
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingWordLimit(false);
                                            setEditWordLimitValue('');
                                        }}
                                        style={{
                                            padding: '6px 10px',
                                            fontSize: '12px',
                                            background: '#F3F4F6',
                                            color: '#6B7280',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: '500'
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setEditingWordLimit(true);
                                        setEditWordLimitValue(prompt?.wordLimit?.toString() || '');
                                    }}
                                    style={{
                                        marginTop: '12px',
                                        width: '100%',
                                        padding: '8px',
                                        fontSize: '12px',
                                        background: 'white',
                                        color: '#6B7280',
                                        border: '1px solid #D1D5DB',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '500'
                                    }}
                                >
                                    {prompt?.wordLimit ? '✏️ Edit Word Limit' : '+ Add Word Limit'}
                                </button>
                            )}
                        </div>

                        {/* College & School Essays Section */}
                        <div style={{ padding: '20px', borderBottom: '1px solid #E5E7EB' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                School
                            </h3>
                            {college ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '8px', background: '#F0FDFA', borderRadius: '8px', border: '1px solid #CCFBF1' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#0D9488' }}>school</span>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#0F766E' }}>{college?.collegeName}</span>
                                </div>
                            ) : (
                                <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '16px', fontStyle: 'italic' }}>
                                    No college assigned to this essay.
                                </div>
                            )}

                            <h4 style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Other Essays for {college?.collegeName}
                            </h4>
                            {collegeEssays.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {collegeEssays.map(ce => (
                                        <button
                                            key={ce.id}
                                            onClick={() => router.push(`/essays/${ce.id}`)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '8px 10px',
                                                borderRadius: '6px',
                                                border: '1px solid #E5E7EB',
                                                background: 'white',
                                                fontSize: '13px',
                                                color: '#4B5563',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#437E84';
                                                e.currentTarget.style.color = '#437E84';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = '#E5E7EB';
                                                e.currentTarget.style.color = '#4B5563';
                                            }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6B7280' }}>description</span>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }}>{ce.title || 'Untitled'}</div>
                                                <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                                                    {ce.assignedValues?.map(valueId => {
                                                        const val = values.find(v => v.id === valueId);
                                                        if (!val) return null;
                                                        return (
                                                            <div
                                                                key={valueId}
                                                                style={{
                                                                    width: '6px',
                                                                    height: '6px',
                                                                    borderRadius: '50%',
                                                                    background: val.color
                                                                }}
                                                                title={val.name}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                    No other essays found for this school.
                                </div>
                            )}
                        </div>

                        {/* Values Section */}
                        <div style={{ padding: '20px', borderBottom: '1px solid #E5E7EB' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Assigned Values
                            </h3>
                            {values.length === 0 ? (
                                <div style={{ fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                    No values defined.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {values.map(value => {
                                        const isSelected = essay?.assignedValues?.includes(value.id);
                                        return (
                                            <div
                                                key={value.id}
                                                onClick={() => toggleValue(value.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    cursor: 'pointer',
                                                    padding: '6px',
                                                    borderRadius: '6px',
                                                    background: isSelected ? '#F3F4F6' : 'transparent'
                                                }}
                                            >
                                                <div style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '4px',
                                                    border: `1px solid ${isSelected ? value.color : '#D1D5DB'} `,
                                                    background: isSelected ? value.color : 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {isSelected && <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'white' }}>check</span>}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: value.color }} />
                                                    <span style={{ fontSize: '14px', color: '#374151' }}>{value.name}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Branches Section */}
                        <div style={{ padding: '20px', marginTop: 'auto', borderTop: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Other Branches
                            </h3>
                            {siblingEssays.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {siblingEssays.map(sibling => (
                                        <button
                                            key={sibling.id}
                                            onClick={() => router.push(`/essays/${sibling.id}`)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                border: '1px solid #E5E7EB',
                                                background: 'white',
                                                fontSize: '13px',
                                                color: '#374151',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#437E84';
                                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(67, 126, 132, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = '#E5E7EB';
                                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                            }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#6B7280' }}>fork_right</span>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sibling.title || 'Untitled'}</div>
                                                <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{sibling.status || 'Draft'}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic' }}>
                                    No other branches for this essay.
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}

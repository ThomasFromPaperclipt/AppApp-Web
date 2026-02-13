'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import styles from '../../../dashboard/dashboard.module.css';
import ReactMarkdown from 'react-markdown';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { CommentHighlight } from '../../extensions/CommentHighlight';
import CommentSidebar from '../../components/CommentSidebar';
import CommentPopover from '../../components/CommentPopover';
import { Comment } from '../../types/comment';

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
    promptText?: string;
    isEmphasized?: boolean;
    wordLimit?: number;
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

interface UserData {
    role?: 'student' | 'parent' | 'counselor';
    firstName?: string;
    lastName?: string;
    linkedStudentIds?: string[];
}

export default function EssayViewer() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const studentId = searchParams.get('studentId');

    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [essay, setEssay] = useState<Essay | null>(null);
    const [prompt, setPrompt] = useState<Prompt | null>(null);
    const [values, setValues] = useState<Value[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [wordCount, setWordCount] = useState(0);
    const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
    const [canComment, setCanComment] = useState(false);

    const calculateWordCount = (html: string): number => {
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) return 0;
        return text.split(/\s+/).length;
    };

    // Tiptap editor (read-only with comment highlights)
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            CommentHighlight.configure({
                comments: comments,
                onCommentClick: (commentId) => setSelectedCommentId(commentId),
            }),
        ],
        content: essay?.content || '',
        editable: false,
        immediatelyRender: false,
    });

    // Update editor content when essay changes
    useEffect(() => {
        if (editor && essay?.content) {
            editor.commands.setContent(essay.content);
        }
    }, [editor, essay?.content]);

    // Apply comment highlights when comments change
    useEffect(() => {
        if (!editor) return;

        // Clear ALL existing highlights by traversing the entire document
        const { doc } = editor.state;
        const { tr } = editor.state;
        const markType = editor.schema.marks.commentHighlight;
        if (markType) {
            doc.descendants((node, pos) => {
                if (node.isText) {
                    node.marks.forEach((mark) => {
                        if (mark.type.name === 'commentHighlight') {
                            tr.removeMark(pos, pos + node.nodeSize, markType);
                        }
                    });
                }
            });
            if (tr.steps.length > 0) {
                editor.view.dispatch(tr);
            }
        }

        // Only highlight unresolved comments
        comments.forEach((comment) => {
            // Only highlight top-level unresolved comments
            if (!comment.parentCommentId && !comment.isResolved) {
                const { startOffset, endOffset } = comment.anchor;
                try {
                    editor.chain()
                        .focus()
                        .setTextSelection({ from: startOffset, to: endOffset })
                        .setCommentHighlight(comment.id)
                        .run();
                } catch (error) {
                    console.warn('Could not apply highlight for comment:', comment.id, error);
                }
            }
        });

        // Reset selection
        try {
            editor.commands.setTextSelection(0);
        } catch (error) {
            // Ignore
        }
    }, [editor, comments]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/');
                return;
            }
            setUser(user);

            // Fetch current user's data to check role and permissions
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data() as UserData;
                    setUserData(data);

                    // Check if user can comment (parent/counselor with linked student)
                    if (studentId && data.role && (data.role === 'parent' || data.role === 'counselor')) {
                        const hasAccess = data.linkedStudentIds?.includes(studentId) || false;
                        setCanComment(hasAccess);
                    } else {
                        setCanComment(false);
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }

            if (params.id && studentId) {
                try {
                    // Fetch essay from student's account
                    const essayDoc = await getDoc(doc(db, 'users', studentId, 'essays', params.id as string));
                    if (essayDoc.exists()) {
                        const essayData = { id: essayDoc.id, ...essayDoc.data() } as Essay;
                        setEssay(essayData);

                        // Calculate word count
                        if (essayData.content) {
                            setWordCount(calculateWordCount(essayData.content));
                        }

                        // Fetch Prompt if exists
                        if (essayData.promptId) {
                            const promptDoc = await getDoc(doc(db, 'users', studentId, 'essay_prompts', essayData.promptId));
                            if (promptDoc.exists()) {
                                setPrompt({ id: promptDoc.id, ...promptDoc.data() } as Prompt);
                            }
                        }

                        // Fetch assigned values
                        if (essayData.assignedValues && essayData.assignedValues.length > 0) {
                            const valuePromises = essayData.assignedValues.map(valueId =>
                                getDoc(doc(db, 'users', studentId, 'essay_values', valueId))
                            );
                            const valueDocs = await Promise.all(valuePromises);
                            const valuesData = valueDocs
                                .filter(doc => doc.exists())
                                .map(doc => ({ id: doc.id, ...doc.data() } as Value));
                            setValues(valuesData);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching essay:', error);
                } finally {
                    setLoading(false);
                }
            }
        });

        return () => unsubscribe();
    }, [router, params.id, studentId]);

    // Real-time comment loading
    useEffect(() => {
        if (!studentId || !params.id) return;

        const commentsRef = collection(db, 'users', studentId, 'essays', params.id as string, 'comments');
        const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
            const commentsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Comment[];
            setComments(commentsData);
        });

        return () => unsubscribe();
    }, [studentId, params.id]);

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingImage}>
                    <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                </div>
            </div>
        );
    }

    if (!essay) return <div>Essay not found. It may have been deleted.</div>;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#F3F4F6' }}>
            {/* Header - matching essay editor style */}
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
                        onClick={() => router.push('/dashboard')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280' }}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#1F2937'
                        }}>
                            {essay.title || 'Untitled Essay'}
                        </div>
                        <div style={{ fontSize: '15px', color: '#6B7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94A3B8', display: 'inline-block' }}></span>
                            Comment-only view
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
                    <div style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #E5E7EB',
                        background: '#FEEBC8',
                        color: '#744210',
                        fontWeight: '500',
                        fontSize: '14px'
                    }}>
                        {essay.status || 'Draft'}
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Main Editor Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '0 32px 32px 32px', alignItems: 'center' }}>
                    <div style={{ maxWidth: '850px', margin: '32px auto 0 auto', width: '100%' }}>

                        {/* Prompt Display (matching editor style) */}
                        {prompt && (
                            <div style={{
                                background: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                padding: '20px',
                                marginBottom: '24px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                    Prompt
                                </div>
                                <div style={{ fontSize: '15px', lineHeight: '1.6', color: '#374151' }}>
                                    {prompt.promptText}
                                    {prompt.wordLimit && (
                                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px', fontStyle: 'italic' }}>
                                            Word limit: {prompt.wordLimit}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Prompt Text (from Idea Generator) */}
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

                        {/* Generated Idea Text */}
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

                        {/* Common App Prompt */}
                        {essay.isCommonApp && essay.commonAppPrompt && (
                            <div style={{ marginBottom: '24px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'block' }}>
                                    Common App Prompt
                                </label>
                                <div style={{ fontSize: '15px', lineHeight: '1.6', color: '#374151' }}>
                                    {essay.commonAppPrompt}
                                </div>
                            </div>
                        )}

                        {/* Main Editor Container - matching editor style */}
                        <div style={{
                            background: 'white',
                            minHeight: '1056px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative'
                        }}>
                            {/* Toolbar - Read-only version */}
                            <div style={{
                                padding: '12px 24px',
                                borderBottom: '1px solid #E5E7EB',
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                background: '#F9FAFB',
                                opacity: 0.6
                            }}>
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_bold</span>
                                </button>
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_italic</span>
                                </button>
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_underlined</span>
                                </button>
                                <div style={{ width: '1px', height: '20px', background: '#E5E7EB', margin: '0 4px' }} />
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_h1</span>
                                </button>
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_h2</span>
                                </button>
                                <div style={{ width: '1px', height: '20px', background: '#E5E7EB', margin: '0 4px' }} />
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_list_bulleted</span>
                                </button>
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_list_numbered</span>
                                </button>
                                <div style={{ width: '1px', height: '20px', background: '#E5E7EB', margin: '0 4px' }} />
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_align_left</span>
                                </button>
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_align_center</span>
                                </button>
                                <button disabled style={{ background: 'transparent', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>format_align_right</span>
                                </button>
                            </div>

                            {/* Essay Content */}
                            <div className={styles.editorContent} style={{
                                minHeight: '800px',
                                padding: '40px',
                                outline: 'none',
                                position: 'relative'
                            }}>
                                {essay.content && editor ? (
                                    <>
                                        <EditorContent editor={editor} className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none" />
                                        {canComment && (
                                            <CommentPopover
                                                editor={editor}
                                                studentId={studentId || ''}
                                                essayId={params.id as string}
                                                currentUserId={user?.uid || ''}
                                                currentUserName={userData ? `${userData.firstName} ${userData.lastName}` : 'Unknown'}
                                                currentUserRole={userData?.role || 'student'}
                                                canComment={canComment}
                                            />
                                        )}
                                    </>
                                ) : essay.idea ? (
                                    <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none">
                                        <ReactMarkdown>{essay.idea}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <p style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No essay content yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar - Comments and Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Comment Sidebar */}
                    {user && userData && studentId && (
                        <CommentSidebar
                            studentId={studentId}
                            essayId={params.id as string}
                            currentUserId={user.uid}
                            currentUserName={`${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown'}
                            currentUserRole={userData.role || 'student'}
                            canComment={canComment}
                            selectedCommentId={selectedCommentId}
                            onCommentClick={(commentId) => setSelectedCommentId(commentId)}
                            wordCount={wordCount}
                            wordLimit={prompt?.wordLimit || essay?.wordLimit}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

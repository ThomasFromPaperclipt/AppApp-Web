'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, deleteDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
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
    lastModified?: string;
    createdAt?: string;
    isCommonApp?: boolean;
    sourceEssayId?: string;
    promptId?: string;
    collegeId?: string;
    isEmphasized?: boolean;
}

interface College {
    id: string;
    collegeName: string;
}

interface EssaysListViewProps {
    user: User | null;
    essays: Essay[];
    colleges: College[];
    setEssays: React.Dispatch<React.SetStateAction<Essay[]>>;
    setCounts: React.Dispatch<React.SetStateAction<any>>;
    onShowWalkthrough: () => void;
}

export default function EssaysListView({ user, essays, colleges, setEssays, setCounts, onShowWalkthrough }: EssaysListViewProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBaseEssayId, setSelectedBaseEssayId] = useState<string | null>(null);

    // Filter for Common App Essays (can have multiple)
    const commonAppEssays = essays.filter(e => e.isCommonApp);

    // Filter for Base Essays (no sourceEssayId) excluding Common App
    const baseEssays = essays.filter(e => !e.sourceEssayId && !e.isCommonApp).filter(essay => {
        const matchesSearch = essay.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            essay.idea.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    const handleCreateCommonApp = async () => {
        if (!user) return;
        try {
            const newEssay = {
                title: 'Common App Essay',
                idea: 'Personal Statement',
                status: 'In Progress' as EssayStatus,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                isCommonApp: true,
                assignedColleges: [],
                assignedValues: []
            };
            const docRef = await addDoc(collection(db, 'users', user.uid, 'essays'), newEssay);
            const createdEssay = { id: docRef.id, ...newEssay };
            setEssays(prev => [createdEssay, ...prev]);
            router.push(`/essays/${docRef.id}`);
        } catch (error) {
            console.error('Error creating Common App essay:', error);
        }
    };

    const handleDeleteEssay = async (essayId: string) => {
        if (!user || !confirm('Are you sure you want to delete this essay?')) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'essays', essayId));
            setEssays(prev => prev.filter(e => e.id !== essayId));
            setCounts((prev: any) => ({ ...prev, essays: Math.max(0, prev.essays - 1) }));
        } catch (error) {
            console.error('Error deleting essay:', error);
        }
    };

    const getVersions = (baseEssayId: string) => {
        return essays.filter(e => e.sourceEssayId === baseEssayId);
    };

    const handleToggleEmphasis = async (essayId: string, currentStatus: boolean) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'essays', essayId), {
                isEmphasized: !currentStatus
            });
            setEssays(prev => prev.map(e =>
                e.id === essayId ? { ...e, isEmphasized: !currentStatus } : e
            ));
        } catch (error) {
            console.error('Error toggling emphasis:', error);
        }
    };

    return (
        <div style={{ paddingBottom: '40px' }}>
            {/* Common App Section */}
            <div style={{ marginBottom: '40px' }}>

                <button
                    onClick={onShowWalkthrough}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#F0FDFA',
                        border: '1px solid #CCFBF1',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        color: '#0F766E',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        marginBottom: '16px',
                        width: 'fit-content'
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lightbulb</span>
                    Learn about Neil's method
                </button>

                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1F2937' }}>
                    Personal Statement
                </h2>

                {commonAppEssays.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                        {commonAppEssays.map(commonAppEssay => (
                            <div
                                key={commonAppEssay.id}
                                style={{
                                    background: commonAppEssay.isEmphasized
                                        ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                                        : 'linear-gradient(135deg, #437E84 0%, #2D5A5E 100%)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    boxShadow: commonAppEssay.isEmphasized
                                        ? '0 4px 12px rgba(245, 158, 11, 0.35)'
                                        : '0 2px 8px rgba(67, 126, 132, 0.25)',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '12px',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <div
                                    style={{ flex: 1, minWidth: 0 }}
                                    onClick={() => router.push(`/essays/${commonAppEssay.id}`)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {commonAppEssay.title}
                                        </h3>
                                        {commonAppEssay.isEmphasized && (
                                            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                                ⭐ Shared
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ opacity: 0.85, fontSize: '13px', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {(commonAppEssay.content || commonAppEssay.idea).replace(/<[^>]*>/g, '').slice(0, 80)}
                                    </p>
                                    <div style={{ marginTop: '8px', display: 'inline-block', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
                                        {commonAppEssay.status || 'In Progress'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleEmphasis(commonAppEssay.id, commonAppEssay.isEmphasized ?? false);
                                        }}
                                        title={commonAppEssay.isEmphasized ? 'Remove from parent/counselor view' : 'Highlight for parent/counselor'}
                                        style={{
                                            background: 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            color: 'white',
                                            cursor: 'pointer',
                                            padding: '6px',
                                            borderRadius: '6px',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                            {commonAppEssay.isEmphasized ? 'star' : 'star_outline'}
                                        </span>
                                    </button>
                                    <span
                                        className="material-symbols-outlined"
                                        style={{ fontSize: '24px', opacity: 0.7 }}
                                        onClick={() => router.push(`/essays/${commonAppEssay.id}`)}
                                    >
                                        edit_document
                                    </span>
                                </div>
                            </div>
                        ))}
                        {/* Add new Common App essay button */}
                        <div
                            onClick={handleCreateCommonApp}
                            style={{
                                border: '2px dashed rgba(67, 126, 132, 0.4)',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                background: 'rgba(67, 126, 132, 0.05)',
                                color: '#437E84',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(67, 126, 132, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(67, 126, 132, 0.05)'}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_circle</span>
                            <span style={{ fontSize: '14px', fontWeight: '500' }}>Add Personal Statement Draft</span>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={handleCreateCommonApp}
                        style={{
                            border: '2px dashed #D1D5DB',
                            borderRadius: '16px',
                            padding: '32px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            background: '#F9FAFB',
                            color: '#6B7280',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#F9FAFB'}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '12px' }}>add_circle</span>
                        <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Start Common App Essay</h3>
                        <p>The main essay sent to most colleges.</p>
                    </div>
                )}
            </div>

            {/* My Essays Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937' }}>My Essays</h2>
                <div style={{ position: 'relative' }}>
                    <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '20px' }}>search</span>
                    <input
                        type="text"
                        placeholder="Search essays..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '8px 12px 8px 36px',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            fontSize: '14px',
                            width: '240px'
                        }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {baseEssays.map(essay => {
                    const versions = getVersions(essay.id);
                    const isExpanded = selectedBaseEssayId === essay.id;

                    return (
                        <div key={essay.id} style={{ position: 'relative' }}>
                            <div
                                onClick={() => setSelectedBaseEssayId(isExpanded ? null : essay.id)}
                                style={{
                                    background: essay.isEmphasized ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' : 'white',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    border: essay.isEmphasized ? '2px solid #F59E0B' : '1px solid #E5E7EB',
                                    boxShadow: essay.isEmphasized ? '0 4px 12px rgba(245, 158, 11, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{essay.title}</h3>
                                        {essay.isEmphasized && (
                                            <span style={{ fontSize: '11px', background: '#F59E0B', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                                Shared
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleEmphasis(essay.id, essay.isEmphasized ?? false);
                                            }}
                                            title={essay.isEmphasized ? 'Remove from parent/counselor view' : 'Highlight for parent/counselor'}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: essay.isEmphasized ? '#F59E0B' : '#9CA3AF',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                transition: 'color 0.2s'
                                            }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                                {essay.isEmphasized ? 'star' : 'star_outline'}
                                            </span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteEssay(essay.id);
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                                        </button>
                                    </div>
                                </div>

                                <p style={{
                                    fontSize: '14px',
                                    color: '#6B7280',
                                    marginBottom: '16px',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    flex: 1
                                }}>
                                    {(essay.content || essay.idea).replace(/<[^>]*>/g, '')}
                                </p>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                    <span style={{
                                        fontSize: '12px',
                                        color: '#6B7280',
                                        background: '#F3F4F6',
                                        padding: '4px 8px',
                                        borderRadius: '12px'
                                    }}>
                                        {versions.length} version{versions.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="material-symbols-outlined" style={{
                                        color: '#437E84',
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                        transition: 'transform 0.2s'
                                    }}>
                                        expand_more
                                    </span>
                                </div>
                            </div>

                            {/* Versions Dropdown */}
                            {isExpanded && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    borderRadius: '0 0 12px 12px',
                                    marginTop: '-8px',
                                    padding: '12px',
                                    paddingTop: '20px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    zIndex: 10,
                                    border: '1px solid #E5E7EB',
                                    borderTop: 'none'
                                }}>
                                    <div
                                        onClick={() => router.push(`/essays/${essay.id}`)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '4px',
                                            background: '#F9FAFB'
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4B5563' }}>description</span>
                                        Original (Base)
                                    </div>
                                    {versions.map(version => {
                                        const collegeName = colleges.find(c => c.id === version.collegeId)?.collegeName || 'Unknown College';
                                        return (
                                            <div
                                                key={version.id}
                                                onClick={() => router.push(`/essays/${version.id}`)}
                                                style={{
                                                    padding: '8px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '4px',
                                                    color: '#437E84'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#F0FDFA'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>call_split</span>
                                                {collegeName} Version
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

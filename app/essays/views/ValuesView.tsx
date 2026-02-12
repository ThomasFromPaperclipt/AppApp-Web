'use client';

import { useState, useEffect } from 'react';
import { doc, collection, addDoc, deleteDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import styles from '../../dashboard/dashboard.module.css';

interface Value {
    id: string;
    name: string;
    color: string;
}

interface Essay {
    id: string;
    title: string;
    idea: string;
    content?: string;
    assignedValues?: string[];
    isCommonApp?: boolean;
    sourceEssayId?: string;
    promptId?: string;
    collegeId?: string;
}

interface ValuesViewProps {
    user: User | null;
    essays: Essay[];
    setEssays: React.Dispatch<React.SetStateAction<Essay[]>>;
}

const PRESET_COLORS = [
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#6B7280', // Gray
];

export default function ValuesView({ user, essays, setEssays }: ValuesViewProps) {
    const [values, setValues] = useState<Value[]>([]);
    const [newValueName, setNewValueName] = useState('');
    const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!user) return;

        const fetchValues = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'users', user.uid, 'essay_values'));
                const valuesData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Value));
                setValues(valuesData);
                if (valuesData.length > 0) {
                    setSelectedValueId(valuesData[0].id);
                }
            } catch (error) {
                console.error('Error fetching values:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchValues();
    }, [user]);

    const handleAddValue = async () => {
        if (!user || !newValueName.trim()) return;

        const color = PRESET_COLORS[values.length % PRESET_COLORS.length];

        try {
            const docRef = await addDoc(collection(db, 'users', user.uid, 'essay_values'), {
                name: newValueName.trim(),
                color: color
            });

            const newValue = {
                id: docRef.id,
                name: newValueName.trim(),
                color: color
            };

            setValues([...values, newValue]);
            setNewValueName('');
            setSelectedValueId(newValue.id);
        } catch (error) {
            console.error('Error adding value:', error);
        }
    };

    const handleDeleteValue = async (valueId: string) => {
        if (!user || !confirm('Are you sure? This will remove this value from all essays.')) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'essay_values', valueId));

            // Remove value from all essays locally
            setEssays(prev => prev.map(essay => ({
                ...essay,
                assignedValues: essay.assignedValues?.filter(id => id !== valueId)
            })));

            // Update essays in Firestore
            const essaysToUpdate = essays.filter(e => e.assignedValues?.includes(valueId));
            for (const essay of essaysToUpdate) {
                const newValues = essay.assignedValues?.filter(id => id !== valueId) || [];
                await updateDoc(doc(db, 'users', user.uid, 'essays', essay.id), {
                    assignedValues: newValues
                });
            }

            const newValues = values.filter(v => v.id !== valueId);
            setValues(newValues);
            if (selectedValueId === valueId) {
                setSelectedValueId(newValues.length > 0 ? newValues[0].id : null);
            }
        } catch (error) {
            console.error('Error deleting value:', error);
        }
    };

    const toggleValueOnEssay = async (essayId: string, valueId: string) => {
        if (!user) return;

        const targetEssay = essays.find(e => e.id === essayId);
        if (!targetEssay) return;

        const currentValues = targetEssay.assignedValues || [];
        const isAssigned = currentValues.includes(valueId);

        const newValues = isAssigned
            ? currentValues.filter(id => id !== valueId)
            : [...currentValues, valueId];

        // Find all essays to update (the target essay + any branches if it's a base essay)
        const essaysToUpdate = [targetEssay];

        // If it's a base essay (no sourceEssayId), find its branches
        if (!targetEssay.sourceEssayId) {
            const branches = essays.filter(e => e.sourceEssayId === essayId);
            essaysToUpdate.push(...branches);
        }

        try {
            // Update all affected essays in Firestore and local state
            await Promise.all(essaysToUpdate.map(essay =>
                updateDoc(doc(db, 'users', user.uid, 'essays', essay.id), {
                    assignedValues: newValues
                })
            ));

            setEssays(prev => prev.map(e => {
                if (essaysToUpdate.some(update => update.id === e.id)) {
                    return { ...e, assignedValues: newValues };
                }
                return e;
            }));

        } catch (error) {
            console.error('Error updating essay values:', error);
        }
    };

    // Filter Logic
    const commonAppEssay = essays.find(e => e.isCommonApp);
    const baseEssays = essays.filter(e => !e.isCommonApp && !e.sourceEssayId);

    const filteredCommonApp = commonAppEssay && (
        commonAppEssay.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        commonAppEssay.idea.toLowerCase().includes(searchQuery.toLowerCase())
    ) ? commonAppEssay : null;

    const filteredBaseEssays = baseEssays.filter(essay =>
        essay.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        essay.idea.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 200px)' }}>
            {/* Left Column: Values List */}
            <div style={{
                width: '300px',
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Core Values</h2>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    <input
                        type="text"
                        value={newValueName}
                        onChange={(e) => setNewValueName(e.target.value)}
                        placeholder="Add a value (e.g. Leadership)"
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #E5E7EB',
                            fontSize: '14px'
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddValue()}
                    />
                    <button
                        onClick={handleAddValue}
                        disabled={!newValueName.trim()}
                        style={{
                            background: '#437E84',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0 12px',
                            cursor: 'pointer',
                            opacity: newValueName.trim() ? 1 : 0.5
                        }}
                    >
                        +
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {values.map(value => (
                        <div
                            key={value.id}
                            onClick={() => setSelectedValueId(value.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: selectedValueId === value.id ? '#F3F4F6' : 'transparent',
                                marginBottom: '4px',
                                transition: 'background 0.2s'
                            }}
                        >
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: value.color,
                                marginRight: '12px'
                            }} />
                            <span style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>{value.name}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteValue(value.id);
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#9CA3AF',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                            </button>
                        </div>
                    ))}
                    {values.length === 0 && !loading && (
                        <div style={{ textAlign: 'center', color: '#6B7280', fontSize: '13px', marginTop: '20px' }}>
                            Add values to track what your essays convey about you.
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Essays for Selected Value */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedValueId ? (
                    <>
                        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>
                                    Essays showing "{values.find(v => v.id === selectedValueId)?.name}"
                                </h2>
                                <p style={{ color: '#6B7280', fontSize: '14px' }}>
                                    Check the box to tag an essay (and its branches) with this value.
                                </p>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '18px' }}>search</span>
                                <input
                                    type="text"
                                    placeholder="Search essays..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        padding: '8px 12px 8px 32px',
                                        borderRadius: '8px',
                                        border: '1px solid #E5E7EB',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: '16px',
                            overflowY: 'auto',
                            paddingBottom: '20px'
                        }}>
                            {/* Common App Essay */}
                            {filteredCommonApp && (
                                <div
                                    key={filteredCommonApp.id}
                                    onClick={() => toggleValueOnEssay(filteredCommonApp.id, selectedValueId)}
                                    style={{
                                        background: 'white',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        border: filteredCommonApp.assignedValues?.includes(selectedValueId)
                                            ? `2px solid ${values.find(v => v.id === selectedValueId)?.color}`
                                            : '1px solid #E5E7EB',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: filteredCommonApp.assignedValues?.includes(selectedValueId) ? 1 : 0.7,
                                        gridColumn: '1 / -1' // Make it span full width if desired, or keep in grid
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '4px',
                                            border: `2px solid ${filteredCommonApp.assignedValues?.includes(selectedValueId) ? values.find(v => v.id === selectedValueId)?.color : '#D1D5DB'}`,
                                            background: filteredCommonApp.assignedValues?.includes(selectedValueId) ? values.find(v => v.id === selectedValueId)?.color : 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginTop: '2px'
                                        }}>
                                            {filteredCommonApp.assignedValues?.includes(selectedValueId) && (
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'white' }}>check</span>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>{filteredCommonApp.title}</h3>
                                                <span style={{ fontSize: '11px', background: '#E0F2F1', color: '#00695C', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>COMMON APP</span>
                                            </div>
                                            <p style={{
                                                fontSize: '13px',
                                                color: '#6B7280',
                                                lineHeight: '1.4',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>
                                                {(filteredCommonApp.content || filteredCommonApp.idea).replace(/<[^>]*>/g, '')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Base Essays */}
                            {filteredBaseEssays.map(essay => {
                                const isAssigned = essay.assignedValues?.includes(selectedValueId);
                                return (
                                    <div
                                        key={essay.id}
                                        onClick={() => toggleValueOnEssay(essay.id, selectedValueId)}
                                        style={{
                                            background: 'white',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            border: isAssigned
                                                ? `2px solid ${values.find(v => v.id === selectedValueId)?.color}`
                                                : '1px solid #E5E7EB',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            opacity: isAssigned ? 1 : 0.7
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                border: `2px solid ${isAssigned ? values.find(v => v.id === selectedValueId)?.color : '#D1D5DB'}`,
                                                background: isAssigned ? values.find(v => v.id === selectedValueId)?.color : 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginTop: '2px'
                                            }}>
                                                {isAssigned && (
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'white' }}>check</span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{essay.title}</h3>
                                                <p style={{
                                                    fontSize: '13px',
                                                    color: '#6B7280',
                                                    lineHeight: '1.4',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {(essay.content || essay.idea).replace(/<[^>]*>/g, '')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9CA3AF',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>category</span>
                        <p>Select a value to manage its essays</p>
                    </div>
                )}
            </div>
        </div>
    );
}

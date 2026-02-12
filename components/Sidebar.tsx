import React from 'react';
import styles from '../app/dashboard/dashboard.module.css';

interface SidebarProps {
    userRole?: 'student' | 'parent' | 'counselor';
    linkedStudents?: any[];
    searchQuery?: string;
    setSearchQuery?: (query: string) => void;
    selectedStudentId?: string | null;
    setSelectedStudentId?: (id: string | null) => void;
    activeTab?: string;
    setActiveTab?: (tab: string) => void;
    counts?: {
        activities: number;
        honors: number;
        tests: number;
        essays: number;
        colleges: number;
    };
    onNavigate: (path: string) => void;
    onSignOut: () => void;
    currentPath: string;
}

export default function Sidebar({
    userRole,
    linkedStudents = [],
    searchQuery = '',
    setSearchQuery,
    selectedStudentId,
    setSelectedStudentId,
    activeTab,
    setActiveTab,
    counts = { activities: 0, honors: 0, tests: 0, essays: 0, colleges: 0 },
    onNavigate,
    onSignOut,
    currentPath
}: SidebarProps) {
    if (userRole === 'counselor' || userRole === 'parent') {
        return (
            <aside className={styles.leftSidebar}>
                <div className={styles.sidebarContent}>
                    <div className={styles.counselorSidebar}>
                        <div className={styles.sidebarHeader} style={{ padding: '0 1rem 1rem' }}>
                            <h3 style={{ fontSize: '0.875rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
                                {userRole === 'parent' ? 'Linked Students' : 'My Students'}
                            </h3>
                            {/* Overview Button */}
                            <button
                                onClick={() => setSelectedStudentId?.(null)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: 'none',
                                    background: selectedStudentId === null ? '#E9F5F7' : 'transparent',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    marginBottom: '1rem',
                                    textAlign: 'left',
                                    color: selectedStudentId === null ? '#2D3748' : '#4A5568'
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', marginRight: '0.75rem', color: '#437E84' }}>grid_view</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Overview</span>
                            </button>

                            <div className={styles.searchBox} style={{ position: 'relative' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: '#A0AEC0' }}>search</span>
                                <input
                                    type="text"
                                    placeholder={userRole === 'parent' ? "Search students..." : "Search students..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery?.(e.target.value)}
                                    style={{ width: '100%', padding: '8px 8px 8px 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.875rem' }}
                                />
                            </div>
                        </div>

                        <div className={styles.studentList} style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
                            {linkedStudents
                                .filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((student: any) => (
                                    <button
                                        key={student.uid}
                                        onClick={() => setSelectedStudentId?.(student.uid)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: 'none',
                                            background: selectedStudentId === student.uid ? '#E9F5F7' : 'transparent',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            marginBottom: '0.25rem',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            background: '#437E84',
                                            color: 'white',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.875rem',
                                            fontWeight: 'bold',
                                            marginRight: '0.75rem'
                                        }}>
                                            {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#2D3748' }}>{student.firstName} {student.lastName}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#718096' }}>Grade {student.gradeLevel}</div>
                                        </div>
                                    </button>
                                ))}

                            <button
                                onClick={() => {
                                    setSelectedStudentId?.(null);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px dashed #CBD5E0',
                                    background: 'transparent',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    marginTop: '1rem',
                                    color: '#718096'
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px', marginRight: '0.5rem' }}>add</span>
                                <span style={{ fontSize: '0.875rem' }}>
                                    {userRole === 'parent' ? 'Link Student' : 'Add Student'}
                                </span>
                            </button>
                        </div>
                        <div className={styles.sidebarFooter}>
                            <button className={styles.sidebarItem} onClick={onSignOut}>
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        );
    }

    return (
        <aside className={styles.leftSidebar}>
            <div className={styles.sidebarContent}>
                <button
                    className={`${styles.sidebarItem} ${currentPath === '/dashboard' ? styles.sidebarItemActive : ''}`}
                    onClick={() => {
                        if (currentPath === '/dashboard' && setActiveTab) {
                            setActiveTab('dashboard');
                        } else {
                            onNavigate('/dashboard');
                        }
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>dashboard</span>
                    Dashboard
                </button>

                <button
                    className={`${styles.sidebarItem} ${currentPath === '/calendar' ? styles.sidebarItemActive : ''}`}
                    onClick={() => onNavigate('/calendar')}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>calendar_month</span>
                    Calendar
                </button>

                <div className={styles.sidebarSection}>
                    <div className={styles.sectionLabel}>MANAGE</div>
                    <button
                        className={`${styles.sidebarItem} ${currentPath === '/activities' ? styles.sidebarItemActive : ''}`}
                        onClick={() => onNavigate('/activities')}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit_note</span>
                        Activities
                        <span className={styles.badge}>{counts.activities}</span>
                    </button>
                    <button
                        className={`${styles.sidebarItem} ${currentPath === '/essays' ? styles.sidebarItemActive : ''}`}
                        onClick={() => onNavigate('/essays')}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>article</span>
                        Essays
                        <span className={styles.badge}>{counts.essays}</span>
                    </button>
                    <button
                        className={`${styles.sidebarItem} ${currentPath === '/honors' ? styles.sidebarItemActive : ''}`}
                        onClick={() => onNavigate('/honors')}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>emoji_events</span>
                        Honors & Awards
                        <span className={styles.badge}>{counts.honors}</span>
                    </button>
                    <button
                        className={`${styles.sidebarItem} ${currentPath === '/tests' ? styles.sidebarItemActive : ''}`}
                        onClick={() => onNavigate('/tests')}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>quiz</span>
                        Test Scores
                        <span className={styles.badge}>{counts.tests}</span>
                    </button>
                    <button
                        className={`${styles.sidebarItem} ${currentPath === '/colleges' ? styles.sidebarItemActive : ''}`}
                        onClick={() => onNavigate('/colleges')}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>account_balance</span>
                        My Colleges
                        <span className={styles.badge}>{counts.colleges}</span>
                    </button>
                </div>

                <div className={styles.sidebarFooter}>
                    <button className={styles.sidebarItem} onClick={onSignOut}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
                        Sign out
                    </button>
                </div>
            </div>
        </aside>
    );
}

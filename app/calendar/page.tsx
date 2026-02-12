'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, Timestamp, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Calendar, { CalendarEvent } from '@/components/Calendar';
import styles from './calendar.module.css';
import dashboardStyles from '../dashboard/dashboard.module.css';
import Sidebar from '@/components/Sidebar';
import { signOut } from 'firebase/auth';

interface UserData {
    firstName: string;
    role?: 'student' | 'consultant' | 'admin';
    lastName: string;
    gradeLevel: string;
    email: string;
    lastGradeUpdate?: any;
}

export default function CalendarPage() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({
        activities: 0,
        essays: 0,
        honors: 0,
        tests: 0,
        colleges: 0
    });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [numPeriods, setNumPeriods] = useState(12);
    const [eventColors, setEventColors] = useState<Record<string, string>>({
        assignment: '#3b82f6',
        study: '#8b5cf6',
        test: '#ef4444',
        'application-due': '#f59e0b',
        'application-response': '#10b981',
        other: '#6b7280'
    });
    const [newEvent, setNewEvent] = useState<Omit<CalendarEvent, 'id' | 'completed' | 'createdAt' | 'date'> & { date: string, time: string }>({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '12:00',
        type: 'assignment',
        period: undefined,
        description: ''
    });
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    const fetchEvents = async (uid: string) => {
        try {
            const eventsRef = collection(db, 'users', uid, 'events');
            const q = query(eventsRef);
            const querySnapshot = await getDocs(q);

            const fetchedEvents: CalendarEvent[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                fetchedEvents.push({
                    id: doc.id,
                    title: data.title,
                    date: data.date.toDate(),
                    type: data.type,
                    description: data.description,
                    completed: data.completed,
                    period: data.period
                });
            });
            setEvents(fetchedEvents);
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                await fetchEvents(currentUser.uid);

                try {
                    // Fetch user data and settings
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setUserData(data as UserData);

                        // Load saved settings
                        if (data.settings?.calendar) {
                            if (data.settings.calendar.eventColors) {
                                setEventColors(data.settings.calendar.eventColors);
                            }
                        }
                    }

                    // Fetch counts
                    const [activitiesSnap, essaysSnap, honorsSnap, testsSnap, collegesSnap] = await Promise.all([
                        getDocs(collection(db, 'users', currentUser.uid, 'activities')),
                        getDocs(collection(db, 'users', currentUser.uid, 'essays')),
                        getDocs(collection(db, 'users', currentUser.uid, 'honors')),
                        getDocs(collection(db, 'users', currentUser.uid, 'tests')),
                        getDocs(collection(db, 'users', currentUser.uid, 'colleges'))
                    ]);

                    setCounts({
                        activities: activitiesSnap.size,
                        essays: essaysSnap.size,
                        honors: honorsSnap.size,
                        tests: testsSnap.size,
                        colleges: collegesSnap.size
                    });
                } catch (error) {
                    console.error('Error fetching dashboard data:', error);
                }
            } else {
                router.push('/');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleColorChange = async (type: string, color: string) => {
        const newColors = { ...eventColors, [type]: color };
        setEventColors(newColors);

        if (user) {
            try {
                await setDoc(doc(db, 'users', user.uid, 'settings', 'calendar'), {
                    eventColors: newColors
                }, { merge: true });
            } catch (error) {
                console.error('Error saving color settings:', error);
            }
        }
    };

    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        try {
            // Create date object explicitly from parts to ensure local timezone is used
            // Format is YYYY-MM-DD
            const [year, month, day] = newEvent.date.split('-').map(Number);

            // Parse time if available, otherwise default to noon
            let hours = 12, minutes = 0;
            if (newEvent.time) {
                [hours, minutes] = newEvent.time.split(':').map(Number);
            }

            const eventDate = new Date(year, month - 1, day, hours, minutes);

            if (selectedEvent) {
                // Update existing event
                await updateDoc(doc(db, 'users', user.uid, 'events', selectedEvent.id), {
                    title: newEvent.title,
                    date: Timestamp.fromDate(eventDate),
                    type: newEvent.type,
                    description: newEvent.description,
                    period: newEvent.period || null
                });
            } else {
                // Create new event
                await addDoc(collection(db, 'users', user.uid, 'events'), {
                    title: newEvent.title,
                    date: Timestamp.fromDate(eventDate),
                    type: newEvent.type,
                    description: newEvent.description,
                    completed: false,
                    period: newEvent.period || null,
                    createdAt: Timestamp.now()
                });
            }

            await fetchEvents(user.uid);
            closeModal();
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Failed to save event. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!user || !selectedEvent) return;

        if (!window.confirm('Are you sure you want to delete this event?')) return;

        setSaving(true);
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'events', selectedEvent.id));
            await fetchEvents(user.uid);
            closeModal();
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Failed to delete event. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setSelectedEvent(null);
        setNewEvent({
            title: '',
            date: new Date().toISOString().split('T')[0],
            time: '12:00',
            period: undefined,
            type: 'assignment',
            description: ''
        });
    };

    const handleEventClick = (event: CalendarEvent) => {
        setSelectedEvent(event);
        // Format time properly HH:mm
        const hours = event.date.getHours().toString().padStart(2, '0');
        const minutes = event.date.getMinutes().toString().padStart(2, '0');

        setNewEvent({
            title: event.title,
            date: event.date.toISOString().split('T')[0],
            time: `${hours}:${minutes}`,
            period: event.period,
            type: event.type,
            description: event.description || ''
        });
        setIsAddModalOpen(true);
    };

    const handleDateClick = (date: Date) => {
        setNewEvent({
            title: '',
            date: date.toISOString().split('T')[0],
            time: '12:00',
            period: undefined,
            type: 'assignment',
            description: ''
        });
        setIsAddModalOpen(true);
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingImage}>
                    <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                </div>
                <div className={styles.loading}>Loading calendar...</div>
            </div>
        );
    }

    return (
        <div className={dashboardStyles.container}>
            <nav className={dashboardStyles.topNav}>
                <div className={dashboardStyles.navContent}>
                    <img src="/assets/elongatedNeil.png" alt="AppApp" className={dashboardStyles.logoImage} />
                    <div className={dashboardStyles.topUserCard} onClick={() => router.push('/profile')}>
                        <div className={dashboardStyles.topUserAvatar}>
                            {userData?.firstName?.charAt(0)}{userData?.lastName?.charAt(0)}
                        </div>
                        <div className={styles.topUserDetails}>
                            <div className={dashboardStyles.topUserName}>{userData?.firstName} {userData?.lastName}</div>
                            <div className={dashboardStyles.topUserEmail}>{userData?.email}</div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className={dashboardStyles.mainLayoutTwoCol}>
                <Sidebar
                    userRole={userData?.role as any}
                    counts={counts}
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/calendar"
                />

                <main className={dashboardStyles.centerContent}>
                    <div className={styles.header}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h1 className={styles.title}>Calendar</h1>
                                <p className={styles.subtitle}>Manage your academic schedule!</p>
                            </div>
                        </div>
                    </div>
                    <div className={styles.calendarWrapper}>
                        <Calendar
                            events={events}
                            onEventClick={handleEventClick}
                            onDateClick={handleDateClick}
                            onAddEvent={() => {
                                setSelectedEvent(null);
                                setNewEvent({
                                    title: '',
                                    date: new Date().toISOString().split('T')[0],
                                    time: '12:00',
                                    type: 'assignment',
                                    period: undefined,
                                    description: ''
                                });
                                setIsAddModalOpen(true);
                            }}
                            eventColors={eventColors}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr)', gap: '24px', marginTop: '24px' }}>
                        <div className={styles.colorPickerSection} style={{ marginTop: 0 }}>
                            <h3 className={styles.sectionTitle}>Colors</h3>
                            <div className={styles.colorGrid}>
                                {Object.entries(eventColors).map(([type, color]) => (
                                    <div key={type} className={styles.colorItem}>
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => handleColorChange(type, e.target.value)}
                                            className={styles.colorInput}
                                        />
                                        <span className={styles.colorLabel}>
                                            {type === 'application-due' ? 'App Due' :
                                                type === 'application-response' ? 'Decision' :
                                                    type.charAt(0).toUpperCase() + type.slice(1)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
                {isAddModalOpen && (
                    <div className={styles.modalOverlay} onClick={closeModal}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 className={styles.modalTitle}>{selectedEvent ? 'Edit Event' : 'Add New Event'}</h2>
                                {selectedEvent && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteEvent}
                                        className={styles.deleteButton}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}
                                        title="Delete Event"
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                )}
                            </div>
                            <form onSubmit={handleSaveEvent}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Event Title</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={newEvent.title}
                                        onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                        placeholder="e.g., Math Homework, Stanford Application"
                                        required
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div className={styles.formGroup} style={{ flex: 1 }}>
                                        <label className={styles.label}>Date</label>
                                        <input
                                            type="date"
                                            className={styles.input}
                                            value={newEvent.date}
                                            onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className={styles.formGroup} style={{ flex: 1 }}>
                                        <label className={styles.label}>Time</label>
                                        <input
                                            type="time"
                                            className={styles.input}
                                            value={newEvent.time}
                                            onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                                            required
                                        />
                                    </div>
                                    {numPeriods > 0 && (
                                        <div className={styles.formGroup} style={{ flex: 1 }}>
                                            <label className={styles.label}>Period</label>
                                            <select
                                                className={styles.select}
                                                value={newEvent.period || ''}
                                                onChange={e => setNewEvent({ ...newEvent, period: e.target.value ? parseInt(e.target.value) : undefined })}
                                            >
                                                <option value="">None</option>
                                                {Array.from({ length: numPeriods }, (_, i) => i + 1).map(p => (
                                                    <option key={p} value={p}>Period {p}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Type</label>
                                    <select
                                        className={styles.select}
                                        value={newEvent.type}
                                        onChange={e => setNewEvent({ ...newEvent, type: e.target.value as CalendarEvent['type'] })}
                                    >
                                        <option value="assignment">Assignment</option>
                                        <option value="test">Test</option>
                                        <option value="application-due">Application Due</option>
                                        <option value="application-response">Decision Date</option>
                                        <option value="study">Study Session</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Description (Optional)</label>
                                    <textarea
                                        className={styles.textarea}
                                        value={newEvent.description}
                                        onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                        placeholder="Add details..."
                                    />
                                </div>
                                <div className={styles.buttonGroup}>
                                    <button
                                        type="button"
                                        className={styles.cancelButton}
                                        onClick={closeModal}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className={styles.saveButton}
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving...' : (selectedEvent ? 'Update Event' : 'Save Event')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import styles from './Calendar.module.css';

export interface CalendarEvent {
    id: string;
    title: string;
    date: Date;
    type: 'study' | 'deadline' | 'assignment' | 'application-due' | 'application-response' | 'test' | 'other';
    description?: string;
    completed?: boolean;
    period?: number;
}

interface CalendarProps {
    events: CalendarEvent[];
    onEventClick?: (event: CalendarEvent) => void;
    onDateClick?: (date: Date) => void;
    onAddEvent?: () => void;
    eventColors?: { [key: string]: string };
}

export default function Calendar({ events, onEventClick, onDateClick, onAddEvent, eventColors }: CalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week'>('month');

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        return { days, firstDay };
    };

    // ... navigation handlers remain same ...
    const handlePrevMonth = () => {
        if (view === 'month') {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        } else {
            const newDate = new Date(currentDate);
            newDate.setDate(newDate.getDate() - 7);
            setCurrentDate(newDate);
        }
    };

    const handleNextMonth = () => {
        if (view === 'month') {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        } else {
            const newDate = new Date(currentDate);
            newDate.setDate(newDate.getDate() + 7);
            setCurrentDate(newDate);
        }
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const getEventStyle = (type: string) => {
        if (eventColors && eventColors[type]) {
            const color = eventColors[type];
            return {
                backgroundColor: `${color}1A`, // 10% opacity hex
                color: color,
                borderLeft: `3px solid ${color}`
            };
        }
        return {}; // Fallback to CSS classes
    };

    const renderMonthView = () => {
        const { days, firstDay } = getDaysInMonth(currentDate);
        const daysArray = [];

        // Previous month padding
        const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i);
            daysArray.push({ date, isCurrentMonth: false });
        }

        // Current month days
        for (let i = 1; i <= days; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
            daysArray.push({ date, isCurrentMonth: true });
        }

        // Next month padding
        const remainingCells = 42 - daysArray.length; // 6 rows * 7 cols
        for (let i = 1; i <= remainingCells; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
            daysArray.push({ date, isCurrentMonth: false });
        }

        return (
            <div className={styles.grid}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className={styles.weekDay}>{day}</div>
                ))}
                {daysArray.map(({ date, isCurrentMonth }, index) => {
                    const dayEvents = events.filter(e => isSameDay(new Date(e.date), date));
                    const isToday = isSameDay(date, new Date());
                    const visibleEvents = dayEvents.slice(0, 2);
                    const hiddenCount = dayEvents.length - 2;

                    return (
                        <div
                            key={index}
                            className={`${styles.dayCell} ${!isCurrentMonth ? styles.differentMonth : ''} ${isToday ? styles.today : ''}`}
                            onClick={() => onDateClick?.(date)}
                        >
                            <div className={styles.dayNumber}>{date.getDate()}</div>
                            {visibleEvents.map(event => (
                                <div
                                    key={event.id}
                                    className={`${styles.event} ${styles[event.type]}`}
                                    style={getEventStyle(event.type)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEventClick?.(event);
                                    }}
                                >
                                    {event.title}
                                </div>
                            ))}
                            {hiddenCount > 0 && (
                                <div className={styles.moreEvents}>
                                    + {hiddenCount} more...
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const getWeekDays = (date: Date) => {
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day; // Adjust when day is Sunday
        startOfWeek.setDate(diff);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const renderWeekView = () => {
        const weekDays = getWeekDays(currentDate);

        return (
            <div className={styles.weekGrid}>
                {weekDays.map((date, index) => {
                    const dayEvents = events.filter(e => isSameDay(new Date(e.date), date));
                    const isToday = isSameDay(date, new Date());

                    return (
                        <div
                            key={index}
                            className={`${styles.weekDayColumn} ${isToday ? styles.today : ''}`}
                            onClick={() => onDateClick?.(date)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={styles.weekDayHeader}>
                                <div className={styles.weekDayName}>
                                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                </div>
                                <div className={styles.weekDate}>
                                    {date.getDate()}
                                </div>
                            </div>
                            {dayEvents.map(event => (
                                <div
                                    key={event.id}
                                    className={`${styles.event} ${styles[event.type]}`}
                                    style={{
                                        ...getEventStyle(event.type),
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px',
                                        padding: '8px'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEventClick?.(event);
                                    }}
                                >
                                    <div style={{ fontSize: '0.8em', opacity: 0.8 }}>
                                        {event.period ? (
                                            <span style={{ fontWeight: 600 }}>Period {event.period}</span>
                                        ) : (
                                            <span>{event.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                        )}
                                    </div>
                                    <div style={{ fontWeight: 600 }}>{event.title}</div>
                                    {event.description && (
                                        <div style={{ fontSize: '0.85em', marginTop: '4px', opacity: 0.9, whiteSpace: 'normal', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                            {event.description}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={styles.calendarContainer}>
            <div className={styles.header}>
                <div className={styles.monthNavigation}>
                    <button className={styles.navButton} onClick={handlePrevMonth}>
                        <ChevronLeft size={20} />
                    </button>
                    <div className={styles.monthTitle}>
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                    <button className={styles.navButton} onClick={handleNextMonth}>
                        <ChevronRight size={20} />
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onAddEvent && (
                        <button
                            onClick={onAddEvent}
                            className={styles.viewButton}
                            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Add Event"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                    <div className={styles.viewSelector}>
                        <button
                            className={`${styles.viewButton} ${view === 'month' ? styles.active : ''}`}
                            onClick={() => setView('month')}
                        >
                            Month
                        </button>
                        <button
                            className={`${styles.viewButton} ${view === 'week' ? styles.active : ''}`}
                            onClick={() => setView('week')}
                        >
                            Week
                        </button>
                    </div>
                </div>
            </div>
            {view === 'month' && renderMonthView()}
            {view === 'week' && renderWeekView()}
        </div>
    );
}

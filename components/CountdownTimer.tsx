'use client';

import { useState, useEffect } from 'react';
import styles from './CountdownTimer.module.css';

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export default function CountdownTimer() {
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const difference = nextMonth.getTime() - now.getTime();

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            setTimeLeft({ days, hours, minutes, seconds });
        };

        // Calculate immediately
        calculateTimeLeft();

        // Update every second
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className={styles.countdownContainer}>
            <div className={styles.countdownTitle}>Next AppApp Day Incoming:</div>

            <div className={styles.timeGrid}>
                <div className={styles.timeItem}>
                    <div className={styles.timeValue}>{timeLeft.days}</div>
                    <div className={styles.timeLabel}>Days</div>
                </div>
                <div className={styles.timeItem}>
                    <div className={styles.timeValue}>{timeLeft.hours}</div>
                    <div className={styles.timeLabel}>Hours</div>
                </div>
                <div className={styles.timeItem}>
                    <div className={styles.timeValue}>{timeLeft.minutes}</div>
                    <div className={styles.timeLabel}>Minutes</div>
                </div>
                <div className={styles.timeItem}>
                    <div className={styles.timeValue}>{timeLeft.seconds}</div>
                    <div className={styles.timeLabel}>Seconds</div>
                </div>
            </div>

            <div className={styles.countdownSubtitle}>Check Back Soon!</div>
        </div>
    );
}

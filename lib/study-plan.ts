import { Timestamp } from 'firebase/firestore';

export interface StudyPlanInput {
    testDate: Date;
    dailyMinutes: number;
    studyDays: number[]; // 0-6 (Sun-Sat)
    focusAreas: string[];
}

export interface StudySession {
    title: string;
    date: Date;
    type: 'study';
    description: string;
    completed: boolean;
}

export function generateStudyPlan(input: StudyPlanInput): StudySession[] {
    const { testDate, dailyMinutes, studyDays, focusAreas } = input;
    const sessions: StudySession[] = [];
    const today = new Date();

    // Calculate total days until test
    const timeDiff = testDate.getTime() - today.getTime();
    const daysUntilTest = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysUntilTest <= 0) return [];

    let currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + 1); // Start tomorrow

    while (currentDate < testDate) {
        if (studyDays.includes(currentDate.getDay())) {
            // Rotate focus areas
            const focusIndex = sessions.length % focusAreas.length;
            const focus = focusAreas[focusIndex];

            sessions.push({
                title: `${focus} Practice`,
                date: new Date(currentDate),
                type: 'study',
                description: `Focus on ${focus} for ${dailyMinutes} minutes.`,
                completed: false
            });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return sessions;
}

import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

interface Scores {
    awards: number;
    activities: number;
    tests: number;
    colleges: number;
    essays: number;
    breakdowns: {
        awards?: string[];
        activities?: string[];
        tests?: string[];
    };
}

interface CalculationResult {
    totalScore: number;
    scores: Scores;
    insights: string;
}

export async function calculateAndUpdateScores(userId: string): Promise<CalculationResult> {
    console.log('Starting score calculation for user:', userId);

    const scores: Scores = {
        awards: 0,
        activities: 0,
        tests: 0,
        colleges: 0,
        essays: 0,
        breakdowns: {},
    };

    // Get user document reference
    const userDoc = doc(db, 'users', userId);
    console.log('Fetching data for user document:', userDoc.path);

    // Get subcollection references
    const awardsSnap = await getDocs(collection(userDoc, 'honors'));
    const activitiesSnap = await getDocs(collection(userDoc, 'activities'));
    const testsSnap = await getDocs(collection(userDoc, 'tests'));
    const collegesSnap = await getDocs(collection(userDoc, 'colleges'));
    const essaysSnap = await getDocs(collection(userDoc, 'essays'));

    console.log('Collection sizes:', {
        honors: awardsSnap.size,
        activities: activitiesSnap.size,
        tests: testsSnap.size,
        colleges: collegesSnap.size,
        essays: essaysSnap.size,
    });

    // Convert snapshots to data
    const awardsData = awardsSnap.docs.map((doc) => doc.data());
    const activitiesData = activitiesSnap.docs.map((doc) => doc.data());
    const testData = testsSnap.docs.map((doc) => doc.data());

    // Calculate awards score
    console.log('\n=== Awards Calculation ===');
    let [nationalCount, regionalCount, schoolCount] = [0, 0, 0];
    awardsData.forEach((data: any) => {
        console.log('Processing award:', data.honorTitle, 'Type:', data.honorType);
        if (data.honorType === 'international' || data.honorType === 'national')
            nationalCount++;
        else if (data.honorType === 'state') regionalCount++;
        else if (data.honorType === 'school') schoolCount++;
    });

    const awardsPoints = nationalCount * 10 + regionalCount * 7 + schoolCount * 5;
    scores.awards = Math.min(awardsPoints, 50) / 50;
    console.log('Awards breakdown:', {
        national: `${nationalCount} × 10 = ${nationalCount * 10}`,
        regional: `${regionalCount} × 7 = ${regionalCount * 7}`,
        school: `${schoolCount} × 5 = ${schoolCount * 5}`,
        totalPoints: awardsPoints,
        finalScore: scores.awards.toFixed(3),
    });

    scores.breakdowns.awards = [
        `National/International: ${nationalCount} × 10`,
        `Regional: ${regionalCount} × 7`,
        `School/Local: ${schoolCount} × 5`,
        `Total: ${Math.min(awardsPoints, 50)}/50`,
    ];

    // Calculate activities score
    console.log('\n=== Activities Calculation ===');
    let activitiesPoints = 0;
    activitiesData.forEach((data: any) => {
        const years = Array.isArray(data.gradeLevels) ? data.gradeLevels.length : 1;
        const yearPoints = [3, 2.25, 1.5, 0.75];
        const pointsForActivity = yearPoints
            .slice(0, years)
            .reduce((a, b) => a + b, 0);
        console.log('Activity:', data.activityType, {
            position: data.position,
            organization: data.organizationName,
            years,
            points: pointsForActivity,
        });
        activitiesPoints += pointsForActivity;
    });

    scores.activities = Math.min(activitiesPoints, 30) / 30;
    console.log(
        'Activities total points:',
        activitiesPoints,
        'Final score:',
        scores.activities.toFixed(3)
    );
    scores.breakdowns.activities = [
        `Total: ${Math.min(activitiesPoints, 30)}/30`,
    ];

    // Calculate test scores
    console.log('\n=== Test Scores Calculation ===');
    let testPoints = 0;
    const satScore = Math.max(
        ...testData.filter((t: any) => t.type === 'SAT').map((t: any) => t.score),
        0
    );
    const actScore = Math.max(
        ...testData.filter((t: any) => t.type === 'ACT').map((t: any) => t.score),
        0
    );

    console.log('Best scores found:', { SAT: satScore, ACT: actScore });

    let satPoints = 0;
    let actPoints = 0;
    if (satScore) {
        satPoints = Math.min(40, (satScore - 1000) / 10);
        testPoints = Math.max(testPoints, satPoints);
        console.log('SAT points:', satPoints);
    }
    if (actScore) {
        actPoints = Math.min(40, (actScore - 20) * 2.5);
        testPoints = Math.max(testPoints, actPoints);
        console.log('ACT points:', actPoints);
    }

    console.log('AP Tests:');
    const apPoints = testData
        .filter((g: any) => g.type === 'AP' && g.apTest)
        .reduce((sum: number, g: any) => {
            const points = g.score >= 3 ? (g.score - 2) * 2 : 0;
            console.log(`${g.apTest}: score ${g.score} = ${points} points`);
            return sum + points;
        }, 0);

    console.log('AP total points:', apPoints, '(capped at 20)');
    testPoints += Math.min(apPoints, 20);
    scores.tests = Math.min(testPoints, 60) / 60;
    console.log(
        'Final test points:',
        testPoints,
        'Score:',
        scores.tests.toFixed(3)
    );
    scores.breakdowns.tests = [`Total: ${Math.min(testPoints, 60)}/60`];

    // Simple scores for colleges and essays
    console.log('\n=== Colleges and Essays Calculation ===');
    scores.colleges = Math.min(collegesSnap.size * 2, 20) / 20;
    scores.essays = Math.min(essaysSnap.size * 2, 20) / 20;
    console.log({
        collegeCount: collegesSnap.size,
        collegeScore: scores.colleges.toFixed(3),
        essayCount: essaysSnap.size,
        essayScore: scores.essays.toFixed(3),
    });

    // Calculate total score
    const totalScore = Math.round(
        (Object.values(scores)
            .filter((s) => typeof s === 'number')
            .reduce((a, b) => a + b, 0) *
            100) /
        5
    );

    console.log('\n=== Final Scores ===');
    console.log({
        awards: scores.awards.toFixed(3),
        activities: scores.activities.toFixed(3),
        tests: scores.tests.toFixed(3),
        colleges: scores.colleges.toFixed(3),
        essays: scores.essays.toFixed(3),
        totalScore,
    });

    // Get user data
    const userSnapshot = await getDoc(userDoc);
    const userData = userSnapshot.data();

    // Generate AI insights
    try {
        console.log('\nGenerating AI insights...');
        const response = await fetch(
            'https://us-central1-appappi.cloudfunctions.net/generateInsights',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scores,
                    totalScore,
                    aiData: {
                        activities: activitiesData,
                        awards: awardsData,
                        tests: testData,
                        userData: {
                            gradeLevel: userData?.gradeLevel || 11,
                            uid: userId,
                        },
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error('Failed to generate insights');
        }

        const insightsText = await response.text();
        console.log('AI insights generated successfully');

        // Save to analytics subcollection
        await setDoc(doc(userDoc, 'analytics', 'monthlyScores'), {
            lastUpdated: Timestamp.now(),
            currentScore: totalScore,
            scores,
            breakdowns: scores.breakdowns,
            insights: insightsText,
        });
        console.log('Scores and insights saved to Firestore');

        return {
            totalScore,
            scores,
            insights: insightsText,
        };
    } catch (error) {
        console.error('Error generating insights:', error);
        // Save scores even if insights fail
        await setDoc(doc(userDoc, 'analytics', 'monthlyScores'), {
            lastUpdated: Timestamp.now(),
            currentScore: totalScore,
            scores,
            breakdowns: scores.breakdowns,
        });
        console.log('Scores saved to Firestore (without insights due to error)');

        return {
            totalScore,
            scores,
            insights: '',
        };
    }
}

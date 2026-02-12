export async function POST(request: Request) {
    try {
        const body = await request.json();

        console.log('Proxying request to Cloud Function:', body);

        const response = await fetch(
            'https://us-central1-appappi.cloudfunctions.net/generateCollegeRecommendations',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Cloud Function error:', errorData);
            return Response.json(
                { error: `Cloud Function error: ${errorData}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log('Cloud Function response:', data);

        return Response.json(data);
    } catch (error: any) {
        console.error('API route error:', error);
        return Response.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

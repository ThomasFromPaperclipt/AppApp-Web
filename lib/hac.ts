import puppeteer from 'puppeteer';

export class HACClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    async loginAndFetchData(username: string, password: string): Promise<{ averages: any, transcript: any } | null> {
        let browser;
        try {
            console.log('HAC Client: Launching browser...');
            browser = await puppeteer.launch({
                headless: true, // Set to false for debugging if needed
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            // Set a real user agent
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // 1. Navigate to Login Page
            // Determine login path based on base URL
            const loginPath = this.baseUrl.includes('HomeAccess') 
                ? '/Account/LogOn' 
                : '/HomeAccess/Account/LogOn';
            
            const loginUrl = `${this.baseUrl}${loginPath}`;
            console.log('HAC Client: Navigating to login page:', loginUrl);
            
            await page.goto(loginUrl, { waitUntil: 'networkidle0' });

            // 2. Fill Login Form
            console.log('HAC Client: Filling login form...');
            await page.type('input[name="LogOnDetails.UserName"]', username);
            await page.type('input[name="LogOnDetails.Password"]', password);

            // 3. Submit Form
            console.log('HAC Client: Submitting form...');
            
            // Try to find the submit button
            const submitButton = await page.$('button[type="submit"]') || await page.$('input[type="submit"]');
            if (submitButton) {
                console.log('HAC Client: Found submit button, clicking...');
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle0' }),
                    submitButton.click()
                ]);
            } else {
                console.log('HAC Client: No submit button found, trying Enter key...');
                await page.keyboard.press('Enter');
                await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(e => console.log('Navigation timeout or no navigation:', e.message));
            }

            // Check if login was successful
            const currentUrl = page.url();
            console.log('HAC Client: Post-login URL:', currentUrl);
            
            if (currentUrl.includes('LogOn')) {
                console.error('HAC Client: Login failed (still on login page)');
                
                // Check for validation errors
                const validationError = await page.evaluate(() => {
                    return document.querySelector('.validation-summary-errors')?.textContent?.trim() || 
                           document.querySelector('.field-validation-error')?.textContent?.trim();
                });
                
                if (validationError) {
                    console.error('HAC Client: Validation Error:', validationError);
                } else {
                    console.log('HAC Client: No validation error found on page.');
                }
                
                return null;
            }

            // 4. Fetch Averages
            console.log('HAC Client: Fetching averages...');
            await page.goto(`${this.baseUrl}/HomeAccess/Content/Student/Assignments.aspx`, { waitUntil: 'networkidle0' });
            
            const averages = await page.evaluate(() => {
                const data: { [key: string]: string } = {};
                const headers = document.querySelectorAll('.sg-header');
                headers.forEach(el => {
                    const courseName = el.querySelector('.sg-header-heading')?.textContent?.trim();
                    const averageText = el.querySelector('.sg-header-heading')?.nextSibling?.textContent?.trim();
                    
                    if (courseName && averageText) {
                        const match = averageText.match(/(\d+(\.\d+)?)/);
                        if (match) {
                            data[courseName] = match[1];
                        }
                    }
                });
                return data;
            });

            // 5. Fetch Transcript
            console.log('HAC Client: Fetching transcript...');
            await page.goto(`${this.baseUrl}/HomeAccess/Content/Student/Transcript.aspx`, { waitUntil: 'networkidle0' });
            
            const transcript = await page.evaluate(() => {
                const data: any = {};
                // Basic parsing logic - adjust selectors as needed
                const gpaElement = document.querySelector('.sg-transcript-gpa-value');
                if (gpaElement) {
                    data['Weighted GPA*'] = gpaElement.textContent?.trim();
                }
                return data;
            });

            console.log('HAC Client: Data fetch complete');
            return { averages, transcript };

        } catch (error) {
            console.error('HAC Client Error:', error);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

# AppApp Web

A Next.js web application for AppApp - your college application journey, organized.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Navigate to the web app directory:**
   ```bash
   cd /Users/thomasaldous/Desktop/AppApp-main/AppApp-web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
AppApp-web/
├── app/                      # Next.js App Router
│   ├── auth/                # Authentication pages
│   │   ├── signin/          # Sign in page
│   │   └── signup/          # Sign up page
│   ├── dashboard/           # Main dashboard
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing page
│   └── globals.css          # Global styles
├── lib/                     # Utilities and configurations
│   └── firebase.ts          # Firebase configuration
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
└── next.config.js           # Next.js configuration
```

## 🔥 Firebase Integration

This web app uses the **same Firebase project** as the mobile app, which means:

- ✅ Users can sign in with the same email/password on both platforms
- ✅ All data is automatically synced between web and mobile
- ✅ Changes made on mobile appear on web and vice versa

### Shared Data Structure

The app reads from these Firestore collections:
- `users/{userId}` - User profile data
- `users/{userId}/activities` - Extracurricular activities
- `users/{userId}/honors` - Honors and awards
- `users/{userId}/tests` - Test scores
- `users/{userId}/grades` - Academic grades
- `users/{userId}/essays` - Essay ideas
- `users/{userId}/colleges` - College list

## 🎨 Features

### Current Features (v1.0)
- ✅ User authentication (sign in/sign up)
- ✅ Dashboard with data overview
- ✅ View counts for all data types
- ✅ Responsive design for desktop and tablet

### Coming Soon
- 📝 Add, edit, and delete activities
- ✍️ Manage essays and college lists
- 📊 Detailed views for all data types
- 📄 PDF resume generation
- 🔍 Search and filtering
- 📱 Mobile-responsive improvements

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Building for Production

```bash
npm run build
npm start
```

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Vercel will automatically detect Next.js and deploy

### Environment Variables (Optional)

For production, you may want to move Firebase config to environment variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 📦 Moving to Separate Directory

When you're ready to work on the web app separately:

```bash
# From your Desktop
mv /Users/thomasaldous/Desktop/AppApp-main/AppApp-web /Users/thomasaldous/Desktop/AppApp-web

# Navigate to new location
cd /Users/thomasaldous/Desktop/AppApp-web

# Install dependencies (if needed)
npm install

# Start development
npm run dev
```

The web app is completely self-contained and will work independently!

## 🔐 Security Notes

- Firebase configuration is currently hardcoded in `lib/firebase.ts`
- For production, consider using environment variables
- Firebase security rules should be configured to protect user data
- The web app uses the same security rules as the mobile app

## 📝 License

© 2025 Paperclipt LLC. All rights reserved.

## 🤝 Support

For issues or questions, visit [goappapp.com](https://goappapp.com)

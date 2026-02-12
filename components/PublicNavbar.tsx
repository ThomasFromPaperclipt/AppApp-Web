'use client';

import { useRouter } from 'next/navigation';
import styles from '../app/PublicPages.module.css';

export default function PublicNavbar() {
    const router = useRouter();

    return (
        <nav className={styles.navbar}>
            <div className={styles.logoContainer} onClick={() => router.push('/')}>
                <img src="/assets/elongatedNeil.png" alt="AppApp Logo" className={styles.logoImage} />
            </div>
            <button
                className={styles.navLoginButton}
                onClick={() => router.push('/auth/signin')}
            >
                Log In
            </button>
        </nav>
    );
}

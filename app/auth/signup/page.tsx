'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../signin/auth.module.css';

export default function SignUp() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gradeLevel, setGradeLevel] = useState('9');
    const [role, setRole] = useState<'student' | 'parent' | 'counselor'>('student');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const generateShareCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userData: any = {
                email: user.email,
                firstName,
                lastName,
                role,
                createdAt: new Date(),
            };

            if (role === 'student') {
                userData.gradeLevel = gradeLevel;
                userData.shareCode = generateShareCode();
            } else {
                // Parents and Counselors both need linkedStudentIds
                userData.linkedStudentIds = [];
            }

            // Create user document in Firestore
            await setDoc(doc(db, 'users', user.uid), userData);

            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.main}>
            <div className={styles.container}>
                <div className={styles.card}>
                    {/* Logo */}
                    <img src="/assets/hello.gif" alt="Hello" className={styles.logo} />

                    <h1 className={styles.title}>Create Account</h1>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.roleToggle}>
                        <button
                            className={`${styles.roleButton} ${role === 'student' ? styles.roleButtonActive : ''}`}
                            onClick={() => setRole('student')}
                        >
                            I'm a Student
                        </button>
                        <button
                            className={`${styles.roleButton} ${role === 'parent' ? styles.roleButtonActive : ''}`}
                            onClick={() => setRole('parent')}
                        >
                            I'm a Parent
                        </button>
                        <button
                            className={`${styles.roleButton} ${role === 'counselor' ? styles.roleButtonActive : ''}`}
                            onClick={() => setRole('counselor')}
                        >
                            I'm a Counselor
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputRow}>
                            <div className={styles.inputGroup}>
                                <label htmlFor="firstName" className={styles.label}>
                                    First Name
                                </label>
                                <input
                                    id="firstName"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className={styles.input}
                                    required
                                    placeholder={role === 'student' ? "Neil" : role === 'parent' ? "Parent Name" : "Counselor Name"}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label htmlFor="lastName" className={styles.label}>
                                    Last Name
                                </label>
                                <input
                                    id="lastName"
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className={styles.input}
                                    required
                                    placeholder="Appstrong"
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.label}>
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                required
                                placeholder="name@example.com"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password" className={styles.label}>
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                                required
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>

                        {role === 'student' && (
                            <div className={styles.inputGroup}>
                                <label htmlFor="gradeLevel" className={styles.label}>
                                    Grade Level
                                </label>
                                <select
                                    id="gradeLevel"
                                    value={gradeLevel}
                                    onChange={(e) => setGradeLevel(e.target.value)}
                                    className={styles.input}
                                    required
                                >
                                    <option value="9">Freshman (9th)</option>
                                    <option value="10">Sophomore (10th)</option>
                                    <option value="11">Junior (11th)</option>
                                    <option value="12">Senior (12th)</option>
                                </select>
                            </div>
                        )}

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'creating account...' : 'create account'}
                        </button>
                    </form>

                    <div className={styles.footer}>
                        <p>
                            Already have an account?{' '}
                            <button
                                onClick={() => router.push('/auth/signin')}
                                className={styles.link}
                            >
                                Log in
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}

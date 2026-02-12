'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import styles from '../dashboard/dashboard.module.css';
import profileStyles from './profile.module.css';
import Sidebar from '@/components/Sidebar';

interface UserData {
    firstName: string;
    lastName: string;
    gradeLevel: string;
    email: string;
    lastGradeUpdate?: any;
}

export default function Profile() {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [originalUserData, setOriginalUserData] = useState<UserData | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/');
                return;
            }

            setUser(user);

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data() as UserData;
                    setUserData(data);
                    setOriginalUserData(data);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleSignOut = async () => {
        if (window.confirm('Are you sure you want to log out?')) {
            try {
                await signOut(auth);
                router.push('/');
            } catch (error) {
                console.error('Error signing out:', error);
            }
        }
    };

    const handleSave = async () => {
        if (!user || !userData) return;

        try {
            await updateDoc(doc(db, 'users', user.uid), {
                firstName: userData.firstName,
                lastName: userData.lastName,
                gradeLevel: userData.gradeLevel,
                lastGradeUpdate: new Date(), // Update timestamp on manual change
            });
            setOriginalUserData(userData);
            setIsEditing(false);
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
        }
    };

    const handleCancel = () => {
        setUserData(originalUserData);
        setIsEditing(false);
    };

    const handleResetPassword = async () => {
        if (!userData?.email) return;

        if (window.confirm(`Send password reset email to ${userData.email}?`)) {
            try {
                await sendPasswordResetEmail(auth, userData.email);
                alert(`Password reset email sent to ${userData.email}`);
            } catch (error) {
                console.error('Error sending password reset:', error);
                alert('Failed to send password reset email');
            }
        }
    };

    return (
        <div className={styles.container}>
            <nav className={styles.topNav}>
                <div className={styles.navContent}>
                    <img src="/assets/elongatedNeil.png" alt="AppApp" className={styles.logoImage} />
                    <div className={styles.topUserCard}>
                        <div className={styles.topUserAvatar}>
                            {userData?.firstName?.charAt(0)}{userData?.lastName?.charAt(0)}
                        </div>
                        <div className={styles.topUserDetails}>
                            <div className={styles.topUserName}>{userData?.firstName} {userData?.lastName}</div>
                            <div className={styles.topUserEmail}>{userData?.email}</div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className={styles.mainLayoutTwoCol}>
                <Sidebar
                    onNavigate={(path) => router.push(path)}
                    onSignOut={handleSignOut}
                    currentPath="/profile"
                />

                <main className={styles.centerContent}>
                    <h1 className={styles.pageTitle}>Profile</h1>

                    {loading ? (
                        <div className={styles.loadingContainer}>
                            <div className={styles.loadingImage}>
                                <img src="/assets/dancing.gif" alt="Loading" width={80} height={80} />
                            </div>
                            <div className={styles.loading}>Loading your profile...</div>
                        </div>
                    ) : (
                        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                            {/* User Information Card */}
                            <div className={profileStyles.profileCard}>
                                <div className={profileStyles.profileCardHeader}>
                                    <h2 className={profileStyles.profileCardTitle}>Your Information</h2>
                                    {!isEditing && (
                                        <button onClick={() => setIsEditing(true)} className={profileStyles.editButton}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                                            Edit
                                        </button>
                                    )}
                                </div>

                                <div className={profileStyles.profileInfoGrid}>
                                    <div className={profileStyles.profileInfoRow}>
                                        <label className={profileStyles.profileLabel}>Email</label>
                                        <div className={profileStyles.profileValue}>{userData?.email}</div>
                                    </div>

                                    <div className={profileStyles.profileInfoRow}>
                                        <label className={profileStyles.profileLabel}>First Name</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={userData?.firstName || ''}
                                                onChange={(e) => setUserData({ ...userData!, firstName: e.target.value })}
                                                className={profileStyles.profileInput}
                                            />
                                        ) : (
                                            <div className={profileStyles.profileValue}>{userData?.firstName}</div>
                                        )}
                                    </div>

                                    <div className={profileStyles.profileInfoRow}>
                                        <label className={profileStyles.profileLabel}>Last Name</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={userData?.lastName || ''}
                                                onChange={(e) => setUserData({ ...userData!, lastName: e.target.value })}
                                                className={profileStyles.profileInput}
                                            />
                                        ) : (
                                            <div className={profileStyles.profileValue}>{userData?.lastName}</div>
                                        )}
                                    </div>

                                    <div className={profileStyles.profileInfoRow}>
                                        <label className={profileStyles.profileLabel}>Grade Level</label>
                                        {isEditing ? (
                                            <select
                                                value={userData?.gradeLevel || ''}
                                                onChange={(e) => setUserData({ ...userData!, gradeLevel: e.target.value })}
                                                className={profileStyles.profileInput}
                                            >
                                                <option value="9">Freshman (9)</option>
                                                <option value="10">Sophomore (10)</option>
                                                <option value="11">Junior (11)</option>
                                                <option value="12">Senior (12)</option>
                                            </select>
                                        ) : (
                                            <div className={profileStyles.profileValue}>{userData?.gradeLevel}</div>
                                        )}
                                    </div>
                                </div>

                                {isEditing && (
                                    <div className={profileStyles.profileEditActions}>
                                        <button onClick={handleCancel} className={profileStyles.profileCancelButton}>
                                            Cancel
                                        </button>
                                        <button onClick={handleSave} className={profileStyles.profileSaveButton}>
                                            Save Changes
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Settings & Support Card */}
                            <div className={profileStyles.profileCard}>
                                <div className={profileStyles.profileCardHeader} style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '0.5rem' }}>
                                    <h2 className={profileStyles.profileCardTitle}>Settings & Support</h2>
                                </div>
                                <div className={profileStyles.profileActionsList}>
                                    <button onClick={handleResetPassword} className={profileStyles.profileActionRow}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#718096' }}>lock_reset</span>
                                            <span>Change Password</span>
                                        </div>
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#CBD5E0' }}>chevron_right</span>
                                    </button>
                                    <button onClick={() => window.open('https://goappapp.com/help', '_blank')} className={profileStyles.profileActionRow}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#718096' }}>help</span>
                                            <span>Help & Feedback</span>
                                        </div>
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#CBD5E0' }}>chevron_right</span>
                                    </button>
                                    <button onClick={() => router.push('/legal')} className={profileStyles.profileActionRow} style={{ borderBottom: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#718096' }}>gavel</span>
                                            <span>Legal</span>
                                        </div>
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#CBD5E0' }}>chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            {/* Account Actions */}
                            <div className={profileStyles.profileBottomActions}>
                                <button onClick={handleSignOut} className={profileStyles.profileLogoutButton}>
                                    <span className="material-symbols-outlined">logout</span>
                                    Log Out
                                </button>
                            </div>

                            <div className={profileStyles.profileVersion}>
                                AppApp Web V. 1.0.0<br />
                                © Copyright 2025 Paperclipt LLC. All rights reserved.<br /><br />
                                When you created an account you agreed to the Privacy Policy and Terms of Use linked above. It is recommended you check each periodically for updates.<br /><br />
                                AP, SAT, PSAT are registered trademarks of College Board, which is not affiliated with and does not endorse this software. PSAT/NMSQT is a registered trademark of College Board and The National Merit Scholarship Corporation, which are not affiliated with and do not endorse this software. ACT is a registered trademark of ACT, Inc., which is not affiliated with and does not endorse this software.<br /><br />
                                This software was created by Paperclipt, LLC. If you want to contact us, reach us at hello@paperclipt.com.
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

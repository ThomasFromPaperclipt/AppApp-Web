import React, { useState } from 'react';

interface WalkthroughModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WalkthroughModal({ isOpen, onClose }: WalkthroughModalProps) {
    const [step, setStep] = useState(1);

    if (!isOpen) return null;

    const totalSteps = 4;

    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            onClose();
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '32px',
                width: '600px',
                maxWidth: '90%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9CA3AF'
                    }}
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {/* Progress Indicators */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} style={{
                            width: '40px',
                            height: '4px',
                            borderRadius: '2px',
                            background: s === step ? '#437E84' : '#E5E7EB',
                            transition: 'background 0.3s'
                        }} />
                    ))}
                </div>

                <div style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    {step === 1 && (
                        <>
                            <div style={{
                                marginBottom: '24px',
                                display: 'flex',
                                justifyContent: 'center'
                            }}>
                                <img
                                    src="/assets/flyingAI.png"
                                    alt="Flying AI"
                                    style={{ height: '120px', width: 'auto' }}
                                />
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
                                Introducing Neil's Method
                            </h2>
                            <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#4B5563', maxWidth: '480px' }}>
                                We developed Neil's method to reduce the total number of essays you have to write, help you stay organized, and make sure every college gets a full understanding of YOU!
                            </p>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: '#F0FDFA',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '24px',
                                color: '#437E84'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>diamond</span>
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
                                Step 1: Define Your Values
                            </h2>
                            <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#4B5563', maxWidth: '480px' }}>
                                You want to make sure you present your whole self to every college! By listing the values that you want every college to see about you (leadership, perseverance, etc.), you will be able to make sure you always put your best foot forward.
                            </p>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: '#F0FDFA',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '24px',
                                color: '#437E84'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>account_balance</span>
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
                                Step 2: Build Your College List
                            </h2>
                            <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#4B5563', maxWidth: '480px' }}>
                                Add every college that you want to apply to and their essay prompts. Once you have them all in the system, we can start organizing ideas so you don't have to write nearly as much!
                            </p>
                        </>
                    )}

                    {step === 4 && (
                        <>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: '#F0FDFA',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '24px',
                                color: '#437E84'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>lightbulb</span>
                            </div>
                            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '16px' }}>
                                Step 3: Add Essay Ideas
                            </h2>
                            <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#4B5563', maxWidth: '480px' }}>
                                Add your essay ideas to each prompt, making sure to
                            </p>
                        </>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                    <button
                        onClick={handleBack}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            background: 'white',
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: step === 1 ? 'default' : 'pointer',
                            opacity: step === 1 ? 0 : 1,
                            pointerEvents: step === 1 ? 'none' : 'auto'
                        }}
                    >
                        Back
                    </button>
                    <button
                        onClick={handleNext}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#437E84',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {step === totalSteps ? 'Get Started' : 'Next'}
                        {step !== totalSteps && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>}
                    </button>
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState } from 'react';
import { Comment } from '../types/comment';

interface CommentCardProps {
    comment: Comment;
    replies: Comment[];
    onReply: (commentId: string, replyText: string) => Promise<void>;
    onToggleResolve: (commentId: string, currentStatus: boolean) => Promise<void>;
}

export default function CommentCard({ comment, replies, onReply, onToggleResolve }: CommentCardProps) {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState('');

    const handlePostReply = async () => {
        await onReply(comment.id, replyText);
        setReplyText('');
        setShowReplyInput(false);
    };

    return (
        <div
            style={{
                padding: '10px',
                borderRadius: '6px',
                border: `1px solid ${comment.isResolved ? '#D1FAE5' : '#FEE2E2'}`,
                background: comment.isResolved ? '#F0FDF4' : '#FEF2F2',
            }}
        >
            {/* Comment header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>
                    {comment.authorName}
                    <span style={{
                        marginLeft: '6px',
                        fontSize: '10px',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        backgroundColor: comment.authorRole === 'parent' ? '#DBEAFE' : '#E0E7FF',
                        color: comment.authorRole === 'parent' ? '#1E40AF' : '#4338CA'
                    }}>
                        {comment.authorRole}
                    </span>
                </div>
                {comment.isResolved && (
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#10B981' }}>
                        check_circle
                    </span>
                )}
            </div>

            {/* Selected text */}
            {comment.anchor.selectedText && (
                <div style={{
                    fontSize: '11px',
                    fontStyle: 'italic',
                    color: '#6B7280',
                    backgroundColor: '#FEF3C7',
                    padding: '4px 6px',
                    borderRadius: '3px',
                    marginBottom: '6px',
                    maxHeight: '40px',
                    overflow: 'hidden',
                    borderLeft: '2px solid #FDE047'
                }}>
                    &quot;{comment.anchor.selectedText.length > 50
                        ? comment.anchor.selectedText.substring(0, 50) + '...'
                        : comment.anchor.selectedText}&quot;
                </div>
            )}

            {/* Comment content */}
            <div style={{ fontSize: '12px', color: '#374151', marginBottom: '6px', lineHeight: '1.4' }}>
                {comment.content}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                <button
                    onClick={() => setShowReplyInput(!showReplyInput)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#437E84',
                        cursor: 'pointer',
                        padding: '2px 0',
                        fontWeight: '500'
                    }}
                >
                    Reply ({replies.length})
                </button>
                <button
                    onClick={() => onToggleResolve(comment.id, comment.isResolved)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: comment.isResolved ? '#6B7280' : '#10B981',
                        cursor: 'pointer',
                        padding: '2px 0',
                        fontWeight: '500'
                    }}
                >
                    {comment.isResolved ? 'Unresolve' : 'Resolve'}
                </button>
            </div>

            {/* Replies */}
            {replies.length > 0 && (
                <div style={{ marginTop: '8px', marginLeft: '12px', paddingLeft: '8px', borderLeft: '2px solid #E5E7EB' }}>
                    {replies.map(reply => (
                        <div key={reply.id} style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '600', color: '#6B7280', marginBottom: '2px' }}>
                                {reply.authorName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#4B5563' }}>
                                {reply.content}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reply input */}
            {showReplyInput && (
                <div style={{ marginTop: '8px' }}>
                    <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        style={{
                            width: '100%',
                            padding: '6px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            minHeight: '50px'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button
                            onClick={handlePostReply}
                            disabled={!replyText.trim()}
                            style={{
                                padding: '4px 10px',
                                backgroundColor: replyText.trim() ? '#437E84' : '#D1D5DB',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500',
                                cursor: replyText.trim() ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Post
                        </button>
                        <button
                            onClick={() => {
                                setShowReplyInput(false);
                                setReplyText('');
                            }}
                            style={{
                                padding: '4px 10px',
                                backgroundColor: 'transparent',
                                color: '#6B7280',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '500',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

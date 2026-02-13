'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Comment } from '../types/comment';

interface CommentSidebarProps {
  studentId: string;
  essayId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'student' | 'parent' | 'counselor';
  canComment: boolean;
  selectedCommentId?: string | null;
  onCommentClick?: (commentId: string) => void;
  wordCount?: number;
  wordLimit?: number;
}

export default function CommentSidebar({
  studentId,
  essayId,
  currentUserId,
  currentUserName,
  currentUserRole,
  canComment,
  selectedCommentId,
  onCommentClick,
  wordCount,
  wordLimit,
}: CommentSidebarProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const selectedCommentRef = useRef<HTMLDivElement>(null);

  // Real-time comment sync
  useEffect(() => {
    if (!studentId || !essayId) return;

    const commentsRef = collection(db, 'users', studentId, 'essays', essayId, 'comments');
    const commentsQuery = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      setComments(commentsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentId, essayId]);

  // Scroll to selected comment
  useEffect(() => {
    if (selectedCommentId && selectedCommentRef.current) {
      selectedCommentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedCommentId]);

  // Filter comments
  const filteredComments = comments.filter((comment) => {
    // Only show top-level comments (not replies)
    if (comment.parentCommentId) return false;

    if (filter === 'unresolved') return !comment.isResolved;
    if (filter === 'resolved') return comment.isResolved;
    return true;
  });

  // Get replies for a comment
  const getReplies = (commentId: string): Comment[] => {
    return comments.filter((c) => c.parentCommentId === commentId);
  };

  // Handle reply submission
  const handleReply = async (parentCommentId: string) => {
    if (!replyContent.trim()) return;

    try {
      const commentsRef = collection(db, 'users', studentId, 'essays', essayId, 'comments');
      const parentComment = comments.find((c) => c.id === parentCommentId);

      await addDoc(commentsRef, {
        essayId,
        authorId: currentUserId,
        authorName: currentUserName,
        authorRole: currentUserRole,
        content: replyContent.trim(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        anchor: parentComment?.anchor || { startOffset: 0, endOffset: 0, selectedText: '' },
        parentCommentId,
        isResolved: false,
        isEdited: false,
      });

      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  // Toggle resolution status
  const toggleResolve = async (comment: Comment) => {
    try {
      const commentRef = doc(db, 'users', studentId, 'essays', essayId, 'comments', comment.id);
      await updateDoc(commentRef, {
        isResolved: !comment.isResolved,
        resolvedAt: !comment.isResolved ? Timestamp.now() : null,
        resolvedBy: !comment.isResolved ? currentUserId : null,
      });
    } catch (error) {
      console.error('Error toggling resolve:', error);
    }
  };

  // Delete comment
  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const commentRef = doc(db, 'users', studentId, 'essays', essayId, 'comments', commentId);
      await deleteDoc(commentRef);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render a single comment card
  const renderComment = (comment: Comment, isReply = false) => {
    const replies = getReplies(comment.id);
    const isAuthor = comment.authorId === currentUserId;
    const isSelected = comment.id === selectedCommentId;

    return (
      <div
        key={comment.id}
        ref={isSelected ? selectedCommentRef : null}
        style={{
          marginLeft: isReply ? '20px' : '0',
          marginBottom: '12px',
        }}
      >
        <div
          onClick={() => onCommentClick && onCommentClick(comment.id)}
          style={{
            padding: '12px',
            backgroundColor: isSelected ? '#E0F2FE' : '#F9FAFB',
            borderLeft: isSelected ? '3px solid #437E84' : '3px solid #E5E7EB',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {/* Author and timestamp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>
                {comment.authorName}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: comment.authorRole === 'parent' ? '#DBEAFE' : comment.authorRole === 'counselor' ? '#E0E7FF' : '#F3F4F6',
                  color: comment.authorRole === 'parent' ? '#1E40AF' : comment.authorRole === 'counselor' ? '#4338CA' : '#6B7280',
                  fontWeight: 500,
                }}
              >
                {comment.authorRole}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              {formatTimestamp(comment.createdAt)}
            </span>
          </div>

          {/* Selected text snippet (only for top-level comments) */}
          {!isReply && comment.anchor.selectedText && (
            <div
              style={{
                fontSize: '12px',
                fontStyle: 'italic',
                color: '#6B7280',
                backgroundColor: '#FEF3C7',
                padding: '6px 8px',
                borderRadius: '4px',
                marginBottom: '8px',
                borderLeft: '2px solid #FDE047',
              }}
            >
              &quot;{comment.anchor.selectedText.length > 100
                ? comment.anchor.selectedText.substring(0, 100) + '...'
                : comment.anchor.selectedText}&quot;
            </div>
          )}

          {/* Comment content */}
          <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5', marginBottom: '8px' }}>
            {comment.content}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                setReplyContent('');
              }}
              style={{
                color: '#437E84',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                fontWeight: 500,
              }}
            >
              Reply
            </button>

            {!isReply && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleResolve(comment);
                }}
                style={{
                  color: comment.isResolved ? '#059669' : '#6B7280',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontWeight: 500,
                }}
              >
                {comment.isResolved ? 'Unresolve' : 'Resolve'}
              </button>
            )}

            {isAuthor && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(comment.id);
                }}
                style={{
                  color: '#DC2626',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
            )}
          </div>

          {/* Reply input */}
          {replyingTo === comment.id && (
            <div style={{ marginTop: '12px' }}>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '60px',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleReply(comment.id);
                  }
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={() => handleReply(comment.id)}
                  disabled={!replyContent.trim()}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: replyContent.trim() ? '#437E84' : '#D1D5DB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: replyContent.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Post
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: '#6B7280',
                    border: '1px solid #D1D5DB',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Render replies */}
        {replies.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            {replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div style={{ width: '48px', height: '100%', backgroundColor: '#F9FAFB', borderLeft: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', padding: '12px' }}>
        <button
          onClick={() => setIsCollapsed(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: '#437E84',
          }}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '350px',
        height: '100%',
        backgroundColor: '#F9FAFB',
        borderLeft: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: '#437E84', fontSize: '20px' }}>
            comment
          </span>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
            Comments ({filteredComments.length})
          </h3>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#6B7280',
          }}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Word Count (shown when provided) */}
      {wordCount !== undefined && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
        }}>
          <span style={{
            fontSize: '24px',
            fontWeight: 700,
            color: wordLimit
              ? (wordCount > wordLimit ? '#EF4444' : wordCount > wordLimit * 0.9 ? '#F59E0B' : '#10B981')
              : '#437E84',
            lineHeight: 1,
          }}>
            {wordCount}
          </span>
          {wordLimit ? (
            <span style={{ fontSize: '14px', color: '#6B7280' }}>
              / {wordLimit} words
              <span style={{
                marginLeft: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: wordCount > wordLimit ? '#EF4444' : wordCount > wordLimit * 0.9 ? '#F59E0B' : '#10B981',
              }}>
                {wordCount > wordLimit
                  ? `${wordCount - wordLimit} over`
                  : `${wordLimit - wordCount} remaining`}
              </span>
            </span>
          ) : (
            <span style={{ fontSize: '14px', color: '#6B7280' }}>words</span>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', padding: '8px 16px', gap: '8px', backgroundColor: 'white', borderBottom: '1px solid #E5E7EB' }}>
        {(['all', 'unresolved', 'resolved'] as const).map((filterOption) => (
          <button
            key={filterOption}
            onClick={() => setFilter(filterOption)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: filter === filterOption ? '#437E84' : 'transparent',
              color: filter === filterOption ? 'white' : '#6B7280',
              textTransform: 'capitalize',
            }}
          >
            {filterOption}
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <img src="/assets/dancing.gif" alt="Loading" style={{ width: '80px', height: '80px' }} />
          </div>
        ) : filteredComments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '12px' }}>
              speaker_notes_off
            </span>
            <p style={{ margin: 0, fontSize: '14px' }}>
              {filter === 'unresolved' ? 'No unresolved comments' : filter === 'resolved' ? 'No resolved comments' : 'No comments yet'}
            </p>
            {canComment && filter === 'all' && (
              <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                Select text to add feedback
              </p>
            )}
          </div>
        ) : (
          filteredComments.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
}

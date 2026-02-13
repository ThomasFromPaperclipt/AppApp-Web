'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Editor } from '@tiptap/react';

interface CommentPopoverProps {
  editor: Editor | null;
  studentId: string;
  essayId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: 'parent' | 'counselor' | 'student';
  canComment: boolean;
}

interface TextSelection {
  from: number;
  to: number;
  text: string;
  top: number;
  left: number;
}

export default function CommentPopover({
  editor,
  studentId,
  essayId,
  currentUserId,
  currentUserName,
  currentUserRole,
  canComment,
}: CommentPopoverProps) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isCommentBoxOpen, setIsCommentBoxOpen] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track text selection
  useEffect(() => {
    if (!editor || !canComment) return;

    const handleSelectionUpdate = () => {
      const { state } = editor;
      const { from, to } = state.selection;

      // Only show popover if text is selected and comment box is not open
      if (from !== to && !isCommentBoxOpen) {
        const text = state.doc.textBetween(from, to);

        // Get the coordinates of the selection
        const { view } = editor;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);

        setSelection({
          from,
          to,
          text,
          top: start.top,
          left: (start.left + end.left) / 2,
        });
      } else if (!isCommentBoxOpen) {
        setSelection(null);
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('update', handleSelectionUpdate);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('update', handleSelectionUpdate);
    };
  }, [editor, canComment, isCommentBoxOpen]);

  // Auto-focus textarea when comment box opens
  useEffect(() => {
    if (isCommentBoxOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isCommentBoxOpen]);

  // Close comment box on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        closeCommentBox();
      }
    };

    if (isCommentBoxOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCommentBoxOpen]);

  const openCommentBox = () => {
    setIsCommentBoxOpen(true);
  };

  const closeCommentBox = () => {
    setIsCommentBoxOpen(false);
    setCommentContent('');
    setSelection(null);
  };

  const handleSubmitComment = async () => {
    if (!commentContent.trim() || !selection || !editor) return;

    setIsSubmitting(true);

    try {
      const commentsRef = collection(db, 'users', studentId, 'essays', essayId, 'comments');

      await addDoc(commentsRef, {
        essayId,
        authorId: currentUserId,
        authorName: currentUserName,
        authorRole: currentUserRole,
        content: commentContent.trim(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        anchor: {
          startOffset: selection.from,
          endOffset: selection.to,
          selectedText: selection.text,
        },
        isResolved: false,
        isEdited: false,
      });

      // Clear selection and close
      closeCommentBox();
      editor.commands.setTextSelection(selection.from); // Move cursor to start
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canComment || (!selection && !isCommentBoxOpen)) {
    return null;
  }

  // Calculate popover position
  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${selection ? selection.top - 50 : 0}px`,
    left: `${selection ? selection.left : 0}px`,
    transform: 'translateX(-50%)',
    zIndex: 1000,
  };

  if (!isCommentBoxOpen) {
    // Show "Add Comment" button
    return (
      <div style={popoverStyle}>
        <button
          onClick={openCommentBox}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            backgroundColor: '#437E84',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            comment
          </span>
          Add Comment
        </button>
      </div>
    );
  }

  // Show comment input box
  return (
    <div ref={popoverRef} style={{ ...popoverStyle, top: `${selection ? selection.top - 180 : 0}px` }}>
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #D1D5DB',
          borderRadius: '8px',
          boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
          padding: '12px',
          width: '300px',
        }}
      >
        {/* Selected text snippet */}
        <div
          style={{
            fontSize: '12px',
            fontStyle: 'italic',
            color: '#6B7280',
            backgroundColor: '#FEF3C7',
            padding: '6px 8px',
            borderRadius: '4px',
            marginBottom: '8px',
            maxHeight: '40px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          &quot;{selection && selection.text.length > 60 ? selection.text.substring(0, 60) + '...' : selection?.text}&quot;
        </div>

        {/* Comment textarea */}
        <textarea
          ref={textareaRef}
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="Add your comment..."
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #D1D5DB',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '80px',
            marginBottom: '8px',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmitComment();
            }
            if (e.key === 'Escape') {
              closeCommentBox();
            }
          }}
        />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={closeCommentBox}
            disabled={isSubmitting}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              color: '#6B7280',
              border: '1px solid #D1D5DB',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitComment}
            disabled={!commentContent.trim() || isSubmitting}
            style={{
              padding: '6px 12px',
              backgroundColor: commentContent.trim() && !isSubmitting ? '#437E84' : '#D1D5DB',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: commentContent.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
            }}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>

        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', textAlign: 'right' }}>
          Cmd+Enter to post • Esc to cancel
        </div>
      </div>
    </div>
  );
}

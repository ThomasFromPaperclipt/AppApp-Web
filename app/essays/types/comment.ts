import { Timestamp } from 'firebase/firestore';

export interface CommentAnchor {
  startOffset: number;
  endOffset: number;
  selectedText: string;
}

export interface Comment {
  id: string;
  essayId: string;
  authorId: string;
  authorName: string;
  authorRole: 'parent' | 'counselor' | 'student';
  content: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Text anchoring
  anchor: CommentAnchor;

  // Threading
  parentCommentId?: string;
  replies?: string[];

  // Resolution
  isResolved: boolean;
  resolvedAt?: Timestamp;
  resolvedBy?: string;

  isEdited: boolean;
}

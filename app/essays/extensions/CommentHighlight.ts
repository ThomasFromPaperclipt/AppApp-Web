import { Mark, mergeAttributes } from '@tiptap/core';
import { Comment } from '../types/comment';

export interface CommentHighlightOptions {
  comments: Comment[];
  onCommentClick?: (commentId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentHighlight: {
      setCommentHighlight: (commentId: string) => ReturnType;
      unsetCommentHighlight: (commentId: string) => ReturnType;
    };
  }
}

export const CommentHighlight = Mark.create<CommentHighlightOptions>({
  name: 'commentHighlight',

  addOptions() {
    return {
      comments: [],
      onCommentClick: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            'data-comment-id': attributes.commentId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'comment-highlight',
        style: 'background-color: #FEF3C7; cursor: pointer; padding: 2px 0; border-radius: 2px;',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCommentHighlight:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId });
        },
      unsetCommentHighlight:
        (commentId: string) =>
        ({ commands, editor }) => {
          // Find and remove marks with this commentId
          const { state } = editor;
          const { tr } = state;
          let modified = false;

          state.doc.descendants((node, pos) => {
            if (node.isText) {
              node.marks.forEach((mark) => {
                if (mark.type.name === this.name && mark.attrs.commentId === commentId) {
                  tr.removeMark(pos, pos + node.nodeSize, mark.type);
                  modified = true;
                }
              });
            }
          });

          if (modified) {
            editor.view.dispatch(tr);
            return true;
          }
          return false;
        },
    };
  },

  // Add click handler for highlights
  onSelectionUpdate() {
    const { editor } = this;
    const { state } = editor;
    const { $from } = state.selection;

    // Check if cursor is on a comment highlight
    const marks = $from.marks();
    const commentMark = marks.find((mark) => mark.type.name === this.name);

    if (commentMark && this.options.onCommentClick) {
      const commentId = commentMark.attrs.commentId;
      if (commentId) {
        this.options.onCommentClick(commentId);
      }
    }
  },
});

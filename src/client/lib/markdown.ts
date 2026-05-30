import DOMPurify from "dompurify";
import { marked } from "marked";

/** Render trusted lesson markdown to sanitized HTML for dangerouslySetInnerHTML. */
export function sanitizeMarkdown(markdown: string): string {
  return DOMPurify.sanitize(String(marked.parse(markdown)));
}

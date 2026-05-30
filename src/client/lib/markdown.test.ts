// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeMarkdown } from "./markdown";

describe("sanitizeMarkdown", () => {
  it("renders markdown to HTML", () => {
    const html = sanitizeMarkdown("# Title\n\nHello **world**");
    expect(html).toContain("<h1");
    expect(html).toContain("Title");
    expect(html).toContain("<strong>world</strong>");
  });

  it("strips <script> tags (XSS boundary feeding dangerouslySetInnerHTML)", () => {
    const html = sanitizeMarkdown("Safe text<script>alert('xss')</script>");
    expect(html).toContain("Safe text");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
  });

  it("strips javascript: links and inline event handlers", () => {
    const html = sanitizeMarkdown('<a href="javascript:alert(1)">x</a><img src=x onerror="alert(1)">');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onerror");
  });

  it("preserves safe links", () => {
    const html = sanitizeMarkdown("[lesson](/learn/estimated-taxes)");
    expect(html).toContain('href="/learn/estimated-taxes"');
  });
});

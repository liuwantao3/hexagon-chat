---
name: pdf-editor
description: Edit, extract, and manipulate PDF files. Read text, merge PDFs, split pages, rotate, and extract metadata using JavaScript.
icon: 📄
category: custom
language: javascript
source: local
---

# PDF Editor

A skill for working with PDF files. Use these tools to read, manipulate, and extract information from PDF documents.

## Tools Available

This skill provides the following tools:
- **pdf_read**: Extract text content from a PDF file
- **pdf_info**: Get PDF metadata (pages, title, author, etc.)
- **pdf_merge**: Combine multiple PDFs into one
- **pdf_split**: Extract pages from a PDF

## When to Use

Use this skill when:
- User asks to read or extract text from a PDF
- User wants to merge multiple PDFs
- User needs to split or extract specific pages
- User asks for PDF metadata or document info

## Implementation Note

This skill uses JavaScript libraries (`pdf-lib`, `pdfjs-dist`). For production use:
- Install dependencies: `npm install pdf-lib pdfjs-dist`
- Configure file paths appropriately
- Handle large PDFs with streaming if needed

## Examples

- "Read the content of this PDF file"
- "Extract pages 1-5 from the document"
- "Merge these two PDFs together"
- "How many pages does this PDF have?"
- "Get the metadata of this PDF"

## Limitations

- Large PDFs may require streaming for memory efficiency
- Some PDFs with images instead of text need OCR (not included)
- Password-protected PDFs require additional handling

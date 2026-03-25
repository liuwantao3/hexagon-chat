/**
 * PDF Editor Tools
 * 
 * Tools for reading, manipulating, and extracting information from PDF files.
 * Uses pdf-lib for PDF manipulation.
 * 
 * Requirements:
 *   npm install pdf-lib
 * 
 * Note: These tools work in Node.js environment.
 */

export const pdfReadTool = {
  name: 'pdf_read',
  description: 'Read and extract text content from a PDF file. Returns the text content of all pages.',
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path to the PDF file'
      },
      maxPages: {
        type: 'number',
        description: 'Maximum number of pages to extract (default: 10)',
        default: 10
      }
    },
    required: ['path']
  },
  
  async execute({ path, maxPages = 10 }) {
    try {
      const fs = await import('fs')
      const pdfParse = (await import('pdf-parse')).default
      
      if (!fs.existsSync(path)) {
        return JSON.stringify({ error: `File not found: ${path}` })
      }
      
      const pdfBytes = fs.readFileSync(path)
      const data = await pdfParse(pdfBytes, { max: maxPages })
      
      return JSON.stringify({
        path,
        totalPages: data.numpages,
        pagesExtracted: Math.min(data.numpages, maxPages),
        text: data.text,
        metadata: data.info,
      }, null, 2)
    } catch (error) {
      return JSON.stringify({ error: `Failed to read PDF: ${error.message}` })
    }
  }
}

export const pdfInfoTool = {
  name: 'pdf_info',
  description: 'Get information about a PDF file including page count, metadata, and file size.',
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path to the PDF file'
      }
    },
    required: ['path']
  },
  
  async execute({ path }) {
    try {
      const fs = await import('fs')
      const { PDFDocument } = await import('pdf-lib')
      
      if (!fs.existsSync(path)) {
        return JSON.stringify({ error: `File not found: ${path}` })
      }
      
      const stats = fs.statSync(path)
      const pdfBytes = fs.readFileSync(path)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      
      const metadata = pdfDoc.getMetadata()
      
      return JSON.stringify({
        path,
        fileSize: `${(stats.size / 1024).toFixed(2)} KB`,
        pageCount: pdfDoc.getPageCount(),
        metadata: {
          title: metadata.title || 'Not set',
          author: metadata.author || 'Not set',
          subject: metadata.subject || 'Not set',
          creator: metadata.creator || 'Not set',
          producer: metadata.producer || 'Not set',
          creationDate: metadata.creationDate ? metadata.creationDate.toISOString() : 'Not set',
          modificationDate: metadata.modificationDate ? metadata.modificationDate.toISOString() : 'Not set',
        }
      }, null, 2)
    } catch (error) {
      return JSON.stringify({ error: `Failed to get PDF info: ${error.message}` })
    }
  }
}

export const pdfMergeTool = {
  name: 'pdf_merge',
  description: 'Merge multiple PDF files into a single PDF. Takes an array of input file paths and an output path.',
  schema: {
    type: 'object',
    properties: {
      inputPaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of file paths to PDF files to merge (in order)'
      },
      outputPath: {
        type: 'string',
        description: 'The output path for the merged PDF file'
      }
    },
    required: ['inputPaths', 'outputPath']
  },
  
  async execute({ inputPaths, outputPath }) {
    try {
      const fs = await import('fs')
      const { PDFDocument } = await import('pdf-lib')
      
      // Check all input files exist
      for (const p of inputPaths) {
        if (!fs.existsSync(p)) {
          return JSON.stringify({ error: `File not found: ${p}` })
        }
      }
      
      const mergedPdf = await PDFDocument.create()
      
      for (const inputPath of inputPaths) {
        const pdfBytes = fs.readFileSync(inputPath)
        const pdfDoc = await PDFDocument.load(pdfBytes)
        const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
        pages.forEach(page => mergedPdf.addPage(page))
      }
      
      const mergedPdfBytes = await mergedPdf.save()
      fs.writeFileSync(outputPath, mergedPdfBytes)
      
      return JSON.stringify({
        success: true,
        outputPath,
        pagesAdded: inputPaths.length,
        message: `Successfully merged ${inputPaths.length} PDF files into ${outputPath}`
      })
    } catch (error) {
      return JSON.stringify({ error: `Failed to merge PDFs: ${error.message}` })
    }
  }
}

export const pdfSplitTool = {
  name: 'pdf_split',
  description: 'Extract specific pages from a PDF file and save them to a new PDF.',
  schema: {
    type: 'object',
    properties: {
      inputPath: {
        type: 'string',
        description: 'The input PDF file path'
      },
      outputPath: {
        type: 'string',
        description: 'The output path for the extracted pages'
      },
      startPage: {
        type: 'number',
        description: 'Start page number (1-indexed)',
        minimum: 1
      },
      endPage: {
        type: 'number',
        description: 'End page number (inclusive, 1-indexed)'
      }
    },
    required: ['inputPath', 'outputPath', 'startPage', 'endPage']
  },
  
  async execute({ inputPath, outputPath, startPage, endPage }) {
    try {
      const fs = await import('fs')
      const { PDFDocument } = await import('pdf-lib')
      
      if (!fs.existsSync(inputPath)) {
        return JSON.stringify({ error: `File not found: ${inputPath}` })
      }
      
      const pdfBytes = fs.readFileSync(inputPath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const totalPages = pdfDoc.getPageCount()
      
      // Convert to 0-indexed
      const start = Math.max(1, startPage) - 1
      const end = Math.min(totalPages, endPage)
      
      if (start >= end) {
        return JSON.stringify({ error: 'Invalid page range' })
      }
      
      const newPdf = await PDFDocument.create()
      const pageIndices = []
      for (let i = start; i < end; i++) {
        pageIndices.push(i)
      }
      
      const pages = await newPdf.copyPages(pdfDoc, pageIndices)
      pages.forEach(page => newPdf.addPage(page))
      
      const newPdfBytes = await newPdf.save()
      fs.writeFileSync(outputPath, newPdfBytes)
      
      return JSON.stringify({
        success: true,
        inputPath,
        outputPath,
        pagesExtracted: end - start,
        range: `${startPage}-${endPage}`,
        message: `Extracted pages ${startPage}-${endPage} to ${outputPath}`
      })
    } catch (error) {
      return JSON.stringify({ error: `Failed to split PDF: ${error.message}` })
    }
  }
}

export default [pdfReadTool, pdfInfoTool, pdfMergeTool, pdfSplitTool]

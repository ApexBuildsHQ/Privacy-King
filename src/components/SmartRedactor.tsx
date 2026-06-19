/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { checkLocalLimits } from '../limits';
import { getPlanById } from '../plans';
import { PlanTier } from '../types';

// PDF.js & Office Library Imports
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as XLSX from 'xlsx';
// PDF-Lib Import
import { PDFDocument } from 'pdf-lib';

import { 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  Download, 
  ArrowRight,
  Lock,
  ArrowLeft,
  Eraser,
  RefreshCw,
  Sparkle,
  FileText,
  RotateCcw,
  BookOpen
} from 'lucide-react';

interface SmartRedactorProps {
  theme: 'light' | 'dark';
  userTier: PlanTier;
  dailyCount: number;
  incrementCount: () => boolean;
  lang: string;
  viewType?: 'card' | 'tool';
}

interface RedactionBox {
  x: number; // raw coordinate relative to original image canvas
  y: number; // raw coordinate relative to original image canvas
  w: number; 
  h: number; 
}

interface DocumentPage {
  index: number;
  name: string;
  imageBlobUrl: string; // PNG Data URL representing this page
  originalWidth: number;
  originalHeight: number;
  boxes: RedactionBox[];
}

export default function SmartRedactor({
  theme,
  userTier,
  dailyCount,
  incrementCount,
  lang,
  viewType = 'tool'
}: SmartRedactorProps) {
  const { t } = useTranslation();
  const plan = getPlanById(userTier);
  const navigate = useNavigate();

  // Document pages and selection states
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [activeImage, setActiveImage] = useState<HTMLImageElement | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loaded' | 'ad' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [adCountdown, setAdCountdown] = useState(3);
  const [errorMessage, setErrorMessage] = useState('');

  // Drawing interactions state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read raw Word document content using mammoth and segment into clean visual pages
  const processWordDoc = async (arrayBuffer: ArrayBuffer, fileName: string) => {
    // @ts-ignore
    const result = await mammoth.extractRawText({ arrayBuffer });
    const rawText = result.value || 'Empty Word Document';
    
    // Split text into paragraphs and wrap lines to standard page margin widths
    const paragraphs = rawText.split('\n');
    const lines: string[] = [];
    
    const maxCharsPerLine = 65;
    paragraphs.forEach(p => {
      const trimmed = p.trim();
      if (!trimmed) {
        lines.push(''); // blank row
        return;
      }
      
      const words = trimmed.split(' ');
      let currentLine = '';
      words.forEach(word => {
        if ((currentLine + ' ' + word).length > maxCharsPerLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      });
      if (currentLine) {
        lines.push(currentLine);
      }
    });

    const linesPerPage = 32;
    const pageCount = Math.max(1, Math.ceil(lines.length / linesPerPage));
    const newPages: DocumentPage[] = [];

    // Standards dimensions targeting letter format
    const pageW = 850;
    const pageH = 1100;

    for (let pIdx = 0; pIdx < pageCount; pIdx++) {
      const pageLines = lines.slice(pIdx * linesPerPage, (pIdx + 1) * linesPerPage);
      
      const offCanvas = document.createElement('canvas');
      offCanvas.width = pageW;
      offCanvas.height = pageH;
      const ctx = offCanvas.getContext('2d');
      if (ctx) {
        // High Contrast clean document sheet format
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);

        // Safe margin guide
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(45, 45, pageW - 90, pageH - 90);

        // Professional Running header
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`CONFIDENTIAL LOCAL SANDBOX • ${fileName.toUpperCase()}`, 50, 75);
        ctx.fillText(`PAGE ${pIdx + 1} OF ${pageCount}`, pageW - 160, 75);

        // Header horizontal separator bar
        ctx.beginPath();
        ctx.moveTo(45, 90);
        ctx.lineTo(pageW - 45, 90);
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();

        // Footer watermarks
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText('ENCODED FLATTENED RASTER • SECURED MEMORY LOCK • PRIVACY KING', 50, pageH - 55);

        // Paragraph lines printing
        ctx.fillStyle = '#0f172a';
        ctx.font = '14px serif';
        let yOffset = 130;
        
        pageLines.forEach(line => {
          ctx.fillText(line, 50, yOffset);
          yOffset += 28; // standard line spacing height
        });
      }

      newPages.push({
        index: pIdx,
        name: `Page ${pIdx + 1}`,
        imageBlobUrl: offCanvas.toDataURL('image/png'),
        originalWidth: pageW,
        originalHeight: pageH,
        boxes: []
      });
    }

    return newPages;
  };

  // Render raw Excel sheets into beautiful secure graphical worksheets
  const processExcelDoc = async (arrayBuffer: ArrayBuffer, fileName: string) => {
    // @ts-ignore
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetNames = workbook.SheetNames || ['Sheet1'];
    const newPages: DocumentPage[] = [];

    const pageW = 1000;
    const pageH = 750;

    // We restrict preview rendering to first 6 sheet tabs to prevent canvas frame memory issues
    const sheetsLimit = sheetNames.slice(0, 6);

    sheetsLimit.forEach((sheetName, sIdx) => {
      // @ts-ignore
      const worksheet = workbook.Sheets[sheetName];
      // @ts-ignore
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      const rowsCount = Math.max(25, Math.min(60, rawRows.length));
      const colsCount = 12; // Columns A to L representing landscape data columns

      const offCanvas = document.createElement('canvas');
      offCanvas.width = pageW;
      offCanvas.height = pageH;
      const ctx = offCanvas.getContext('2d');
      if (ctx) {
        // Light grey blueprint spreadsheet grid base
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, pageW, pageH);

        // Column and Row indices headers
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(45, 45, pageW - 90, 25); // Top Cols banner
        ctx.fillRect(45, 45, 25, pageH - 90); // Left Rows banner

        // Sheet title banner
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, pageW, 45);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(0, 42, pageW, 3);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(`📊 EXCEL SPREADSHEET TAB: [${sheetName.toUpperCase()}] • ${fileName}`, 20, 27);

        // Spreadsheet grid coordinates
        const colWidth = (pageW - 90 - 25) / colsCount;
        const rowHeight = (pageH - 90 - 25) / rowsCount;

        // Draw alphabetical sheet labels (A, B, C...)
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 11px Inter, sans-serif';
        for (let col = 0; col < colsCount; col++) {
          const letter = String.fromCharCode(65 + col);
          const x = 45 + 25 + (col * colWidth);
          
          ctx.beginPath();
          ctx.moveTo(x, 45);
          ctx.lineTo(x, pageH - 45);
          ctx.strokeStyle = '#cbd5e1';
          ctx.stroke();

          ctx.fillText(letter, x + (colWidth / 2) - 4, 62);
        }

        // Draw numerical row indicators
        for (let r = 0; r < rowsCount; r++) {
          const y = 45 + 25 + (r * rowHeight);
          
          ctx.beginPath();
          ctx.moveTo(45, y);
          ctx.lineTo(pageW - 45, y);
          ctx.strokeStyle = '#cbd5e1';
          ctx.stroke();

          ctx.fillStyle = '#64748b';
          ctx.fillText(String(r + 1), 52, y + (rowHeight / 2) + 4);
        }

        // Load spreadsheet cellular values to grid
        ctx.font = '10px Inter, monospace';
        ctx.textAlign = 'left';

        for (let r = 0; r < rowsCount; r++) {
          const rowData = rawRows[r] || [];
          for (let c = 0; c < colsCount; c++) {
            const rawVal = rowData[c];
            const x = 45 + 25 + (c * colWidth) + 6;
            const y = 45 + 25 + (r * rowHeight) + (rowHeight / 2) + 4;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(45 + 25 + (c * colWidth) + 1, 45 + 25 + (r * rowHeight) + 1, colWidth - 2, rowHeight - 2);

            if (rawVal !== undefined && rawVal !== null) {
              const strVal = String(rawVal);
              ctx.fillStyle = '#0f172a';
              const maxChars = Math.floor(colWidth / 7.5);
              const displayVal = strVal.length > maxChars ? strVal.slice(0, maxChars) + '..' : strVal;
              ctx.fillText(displayVal, x, y);
            }
          }
        }

        // Workspace boundaries
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(45, 45, pageW - 90, pageH - 90);

        // Sidebar representation footer meta
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, pageH - 45, pageW, 45);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`ACTIVE WORKSHEET: ${sheetName}`, 20, pageH - 20);

        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(`Secure localized spreadsheet view. Original records are isolated and redacted strictly client-side.`, 180, pageH - 20);
      }

      newPages.push({
        index: sIdx,
        name: `${sheetName}`,
        imageBlobUrl: offCanvas.toDataURL('image/png'),
        originalWidth: pageW,
        originalHeight: pageH,
        boxes: []
      });
    });

    return newPages;
  };

  // Unified routing routine for and loaded document parsing
  const processSelectedFile = async (selectedFile: File) => {
    setErrorMessage('');
    setStatus('idle');
    setProgress(0);
    setPages([]);
    setCurrentPageIndex(0);

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    
    // Validate size via our limits configuration
    const validation = checkLocalLimits(selectedFile.size, dailyCount, userTier, lang);
    if (!validation.allowed) {
      setErrorMessage(validation.reason || 'File exceeds your plan size limit.');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setProgress(15);

    try {
      if (fileExtension === 'pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            // Configure CDN PDFJS worker dynamically to ensure full compilation support
            // @ts-ignore
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.0.379'}/build/pdf.worker.min.mjs`;

            // @ts-ignore
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            const numPages = pdf.numPages;
            const loadedPages: DocumentPage[] = [];

            for (let i = 1; i <= numPages; i++) {
              setProgress(15 + Math.round((i / numPages) * 75));
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 3.0 }); // High resolution canvas conversion scale (crisp rendering)
              
              const pCanvas = document.createElement('canvas');
              pCanvas.width = viewport.width;
              pCanvas.height = viewport.height;
              const ctx = pCanvas.getContext('2d');
              if (ctx) {
                await page.render({ canvasContext: ctx, viewport } as any).promise;
              }
              
              loadedPages.push({
                index: i - 1,
                name: `Page ${i}`,
                imageBlobUrl: pCanvas.toDataURL('image/png'),
                originalWidth: viewport.width,
                originalHeight: viewport.height,
                boxes: []
              });
            }

            if (loadedPages.length === 0) {
              throw new Error("Empty PDF pages contents.");
            }

            setPages(loadedPages);
            setFile(selectedFile);
            setStatus('loaded');
          } catch (pdfErr: any) {
            console.error(pdfErr);
            setErrorMessage(`Failed to decode PDF document features: ${pdfErr?.message || pdfErr}`);
            setStatus('error');
          }
        };
        reader.readAsArrayBuffer(selectedFile);

      } else if (fileExtension === 'docx') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const loadedPages = await processWordDoc(arrayBuffer, selectedFile.name);
            setPages(loadedPages);
            setFile(selectedFile);
            setStatus('loaded');
          } catch (wordErr: any) {
            console.error(wordErr);
            setErrorMessage(`Word parser crash: ${wordErr?.message || wordErr}`);
            setStatus('error');
          }
        };
        reader.readAsArrayBuffer(selectedFile);

      } else if (fileExtension === 'xlsx' || fileExtension === 'xls' || fileExtension === 'csv') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const loadedPages = await processExcelDoc(arrayBuffer, selectedFile.name);
            setPages(loadedPages);
            setFile(selectedFile);
            setStatus('loaded');
          } catch (excelErr: any) {
            console.error(excelErr);
            setErrorMessage(`Excel worksheet reading failure: ${excelErr?.message || excelErr}`);
            setStatus('error');
          }
        };
        reader.readAsArrayBuffer(selectedFile);

      } else if (['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension || '')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            setPages([{
              index: 0,
              name: selectedFile.name,
              imageBlobUrl: e.target?.result as string,
              originalWidth: img.naturalWidth,
              originalHeight: img.naturalHeight,
              boxes: []
            }]);
            setFile(selectedFile);
            setStatus('loaded');
          };
          img.onerror = () => {
            setErrorMessage('Unable to rasterize photographic pixel parameters.');
            setStatus('error');
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(selectedFile);

      } else {
        setErrorMessage(t('redaction.unsupported_type'));
        setStatus('error');
      }

    } catch (glErr: any) {
      console.error(glErr);
      setErrorMessage(`Loading process crashed: ${glErr.message || glErr}`);
      setStatus('error');
    }
  };

  // Asynchronously load selected page image locally to render over standard display canvas without drawing latency
  useEffect(() => {
    if (pages.length === 0) {
      setActiveImage(null);
      return;
    }
    const page = pages[currentPageIndex];
    if (!page) return;

    let activeToken = true;
    const img = new Image();
    img.onload = () => {
      if (activeToken) {
        setActiveImage(img);
      }
    };
    img.src = page.imageBlobUrl;
    
    return () => {
      activeToken = false;
    };
  }, [pages, currentPageIndex]);

  // Handle re-drawing of the canvas layers whenever coordinates or active annotations change
  useEffect(() => {
    drawCanvas();
  }, [activeImage, pages, currentPageIndex, isDrawing, startPos, currentPos]);

  // Redraw resize observer binder for canvas bounds
  useEffect(() => {
    if (!activeImage || !canvasRef.current) return;

    let rId: number;
    const handleResize = () => {
      if (rId) {
        window.cancelAnimationFrame(rId);
      }
      rId = window.requestAnimationFrame(() => {
        drawCanvas();
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      if (rId) {
        window.cancelAnimationFrame(rId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [activeImage, pages, currentPageIndex, isDrawing, startPos, currentPos]);

  // Main drawing pipeline
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const activePage = pages[currentPageIndex];
    if (!activePage) return;

    const containerWidth = container.clientWidth || 650;
    const imgRatio = activeImage.naturalHeight / activeImage.naturalWidth;
    
    // Calculate display dimensions maintaining aspect ratio
    const displayWidth = Math.min(containerWidth, activeImage.naturalWidth);
    const displayHeight = displayWidth * imgRatio;

    const dpr = window.devicePixelRatio || 1;
    // Buffer dimensions optimized for Retina/High-DPI screens
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    // Secure CSS layout dimensions compatibility
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Scale draw actions to match retina physical density
    ctx.scale(dpr, dpr);

    // 1. Draw base high contrast image page
    ctx.drawImage(activeImage, 0, 0, displayWidth, displayHeight);

    // Scaling coordinates mapping
    const scaleFactor = displayWidth / activeImage.naturalWidth;

    // 2. Draw active black redactions boxes
    ctx.fillStyle = '#000000';
    activePage.boxes.forEach(box => {
      ctx.fillRect(
        box.x * scaleFactor,
        box.y * scaleFactor,
        box.w * scaleFactor,
        box.h * scaleFactor
      );
    });

    // 3. Draw active visual cursor outlines for current dragging rectangle
    if (isDrawing && startPos && currentPos) {
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const w = Math.abs(startPos.x - currentPos.x);
      const h = Math.abs(startPos.y - currentPos.y);

      ctx.strokeStyle = '#8b5cf6'; // Violet selection border for optimal night/day contrast
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);

      // Shadowed overlay mask preview
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  };

  // Convert canvas pointer events to localized offset positions
  const getPointerCoord = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    const coord = getPointerCoord(e);
    if (!coord) return;

    setIsDrawing(true);
    setStartPos(coord);
    setCurrentPos(coord);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    if (e.cancelable) e.preventDefault();
    
    const coord = getPointerCoord(e);
    if (!coord) return;
    setCurrentPos(coord);
  };

  const handlePointerUp = () => {
    if (!isDrawing || !startPos || !currentPos || !activeImage || !canvasRef.current || pages.length === 0) return;
    setIsDrawing(false);

    const activePage = pages[currentPageIndex];
    if (!activePage) return;

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(startPos.x - currentPos.x);
    const h = Math.abs(startPos.y - currentPos.y);

    // Skip micro clicks or noise
    if (w < 4 || h < 4) {
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    const scaleFactor = canvasRef.current.clientWidth / activePage.originalWidth;
    const newBox: RedactionBox = {
      x: Math.round(x / scaleFactor),
      y: Math.round(y / scaleFactor),
      w: Math.round(w / scaleFactor),
      h: Math.round(h / scaleFactor)
    };

    setPages(prev => {
      const copy = [...prev];
      copy[currentPageIndex] = {
        ...activePage,
        boxes: [...activePage.boxes, newBox]
      };
      return copy;
    });

    setStartPos(null);
    setCurrentPos(null);
  };

  // Drawing undo operation
  const handleUndoBox = () => {
    if (pages.length === 0) return;
    const activePage = pages[currentPageIndex];
    if (!activePage || activePage.boxes.length === 0) return;

    setPages(prev => {
      const copy = [...prev];
      copy[currentPageIndex] = {
        ...activePage,
        boxes: activePage.boxes.slice(0, -1)
      };
      return copy;
    });
  };

  const handleClearAllBoxes = () => {
    if (pages.length === 0) return;
    const activePage = pages[currentPageIndex];
    if (!activePage) return;

    setPages(prev => {
      const copy = [...prev];
      copy[currentPageIndex] = {
        ...activePage,
        boxes: []
      };
      return copy;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPages([]);
    setCurrentPageIndex(0);
    setActiveImage(null);
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
  };

  // Sponsor ad simulated wall loop
  const handleWatchAd = () => {
    if (pages.length === 0 || !file) return;

    const validation = checkLocalLimits(file.size, dailyCount, userTier, lang);
    if (!validation.allowed) {
      setErrorMessage(validation.reason || 'Limit exceeded.');
      setStatus('error');
      return;
    }

    if (plan.hasAds) {
      setStatus('ad');
      setAdCountdown(3);
      setProgress(25);

      const interval = setInterval(() => {
        setAdCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            executeCoreRedaction();
            return 0;
          }
          setProgress((p) => Math.min(95, p + 25));
          return prev - 1;
        });
      }, 1000);
    } else {
      executeCoreRedaction();
    }
  };

  // Compile final clean document using pdf-lib to fully bind blackout blocks safely
  const executeCoreRedaction = async () => {
    if (pages.length === 0 || !file) return;

    setStatus('processing');
    setProgress(40);

    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < pages.length; i++) {
        setProgress(40 + Math.round((i / pages.length) * 50));
        const page = pages[i];

        // Allocate high-res offscreen workspace matrix
        const offCanvas = document.createElement('canvas');
        offCanvas.width = page.originalWidth;
        offCanvas.height = page.originalHeight;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D rendering workspace failed to instantiate.');
        }

        // Load original page graphics safely
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = 'anonymous';
          el.onload = () => resolve(el);
          el.onerror = (e) => reject(e);
          img.src = page.imageBlobUrl;
          el.src = page.imageBlobUrl;
        });

        // Write page graphics and flat overlay redact shapes
        ctx.drawImage(img, 0, 0, page.originalWidth, page.originalHeight);
        ctx.fillStyle = '#000000';
        page.boxes.forEach(box => {
          ctx.fillRect(box.x, box.y, box.w, box.h);
        });

        // Compress compiled page as Jpeg inside PDF
        const dataUrl = offCanvas.toDataURL('image/jpeg', 0.92);
        const embeddedImage = await pdfDoc.embedJpg(dataUrl);

        // Add standard corresponding sizing page
        const pdfPage = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
        pdfPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: embeddedImage.width,
          height: embeddedImage.height,
        });
      }

      setProgress(92);
      const pdfBytes = await pdfDoc.save();
      const finalBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Daily limit validation increment checking
      const limitSuccess = incrementCount();
      if (!limitSuccess) {
        setErrorMessage('Daily limits exceeded during storage generation.');
        setStatus('error');
        return;
      }

      // Generate trigger anchor
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const finalName = `Redacted_${cleanName}.pdf`;
      const downloadUrl = URL.createObjectURL(finalBlob);

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 200);

      setProgress(100);
      setStatus('success');

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error compiling redact canvas grids raster.');
      setStatus('error');
    }
  };

  const getReadableSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // RENDERING 1: FRONT PAGE HUB ENTRY CARD
  if (viewType === 'card') {
    return (
      <Link 
        id="smart-redaction-hub-card"
        to="/tools/smart-redaction"
        className={`p-6 rounded-3xl border text-right cursor-pointer transition-all duration-300 relative overflow-hidden group hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between h-56 block ${
          theme === 'dark' 
            ? 'bg-[#111318] hover:bg-[#15171c] border-[#2d2f36] text-white shadow-black/30' 
            : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-950 shadow-slate-100/50'
        }`}
      >
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 animate-gradient-xy" />
        <div className="absolute top-1 right-1 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-colors pointer-events-none" />

        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] uppercase font-bold tracking-widest rounded-full">
              {t('secured_local_mode')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Eraser className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black tracking-tight group-hover:text-purple-400 transition-colors">
              {t('redaction.title')}
            </h3>
            <p className="text-xs leading-relaxed line-clamp-2 text-gray-600 dark:text-gray-400 font-medium dark:font-normal">
              {t('redaction.description')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-start gap-1 p-1 text-[#8b5cf6] text-xs font-black">
          <span>{t('select_tool')}</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    );
  }

  // RENDERING 2: ADVANCED LOCAL WORKSPACE
  return (
    <div 
      id="redaction-suite-desk"
      className={`w-full mx-auto rounded-3xl border p-6 sm:p-8 space-y-6 transition-all shadow-2xl relative overflow-hidden ${
        theme === 'dark' 
          ? 'bg-[#111318] border-[#2d2f36] text-white' 
          : 'bg-white border-slate-300 text-slate-950 shadow-slate-200/50'
      }`}
    >
      <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-500" />

      {/* Header navigations */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => {
            handleRemoveFile();
            navigate('/');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black border transition-all hover:scale-[1.01] cursor-pointer flex items-center gap-1.5 ${
            theme === 'dark'
              ? 'border-[#2d2f36] bg-[#16181f] text-white hover:bg-[#1c1e26]'
              : 'border-slate-300 bg-white text-slate-950 hover:bg-slate-100 shadow-2xs'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('redaction.back_button')}</span>
        </button>

        <span className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-[10px] font-black uppercase tracking-wider">
          {userTier.toUpperCase()} {t('secured_local_mode')}
        </span>
      </div>

      {/* Title Details */}
      <div className="space-y-1.5 text-right pt-2 border-slate-300 dark:border-[#2d2f36]">
        <h2 className="text-2xl font-black flex items-center justify-end gap-2 text-purple-500">
          <span>{t('redaction.title')}</span>
          <Eraser className="w-6 h-6 shrink-0 text-purple-500" />
        </h2>
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 font-medium dark:font-normal">
          {t('redaction.description')}
        </p>
      </div>

      <hr className="border-slate-200 dark:border-[#2d2f36]" />

      {/* 2A. UPLOAD DROPZONE VIEW LIMITS */}
      {(status === 'idle' || status === 'error') && pages.length === 0 && (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerUploadClick}
          className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 relative overflow-hidden group ${
            isDragOver 
              ? 'border-purple-500 bg-purple-500/5 scale-[0.99]' 
              : theme === 'dark'
              ? 'border-[#2d2f36] bg-[#0c0d10] hover:border-[#8b5cf6]/40'
              : 'border-slate-300 bg-slate-50 hover:border-purple-500 hover:bg-slate-100/50'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg" 
            className="hidden"
          />
          <div className="w-16 h-16 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
            <Upload className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-lg">
            <h4 className="text-base font-black text-gray-900 dark:text-gray-100">{t('redaction.upload_title')}</h4>
            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 font-bold dark:font-normal">
              {t('redaction.upload_subtitle')}
            </p>
          </div>
          <button 
            type="button" 
            className="mt-1 px-6 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-md cursor-pointer transition-all hover:scale-[1.02]"
          >
            {t('redaction.select_button')}
          </button>
        </div>
      )}

      {/* 2B. INTERACTIVE LOCAL REDACT ZONE PAGES SIDEBAR + WORKSPACE CARDS */}
      {file && pages.length > 0 && (status === 'loaded' || status === 'idle') && (
        <div className="space-y-6">
          <div className={`p-4 rounded-2xl border flex items-start gap-2.5 text-right text-xs leading-relaxed font-bold ${
            theme === 'dark' ? 'bg-[#15171c]/50 border-purple-500/20 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-950'
          }`}>
            <Sparkle className="w-5 h-5 shrink-0 text-purple-500 mt-0.5" />
            <p>{t('redaction.instruction_tips')}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            
            {/* PERSISTENT SIDEBAR PREVIEW - HIDDEN ON MOBILE */}
            <div className="hidden md:flex flex-col w-64 shrink-0 border border-slate-300 dark:border-[#2d2f36] rounded-2xl bg-slate-50 dark:bg-[#0c0d10] p-4 max-h-[600px] overflow-y-auto space-y-3">
              <h4 className="text-xs font-black tracking-wider uppercase text-slate-500 text-right flex items-center justify-end gap-1.5 border-b border-slate-200 dark:border-[#22242c] pb-2">
                <span>{t('redaction.pages_sidebar')}</span>
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              </h4>
              
              <div className="space-y-3">
                {pages.map((p, idx) => {
                  const isActive = idx === currentPageIndex;
                  return (
                    <button
                      key={p.index}
                      onClick={() => setCurrentPageIndex(idx)}
                      className={`w-full p-2.5 rounded-xl border text-right transition-all text-xs cursor-pointer block relative ${
                        isActive 
                          ? 'bg-purple-500/15 border-purple-500 text-purple-400 font-black shadow-sm shadow-purple-500/10' 
                          : 'bg-white dark:bg-[#15171c] border-slate-200 dark:border-[#20222a] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c1e26]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 font-bold">
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full font-mono">
                          #{idx + 1}
                        </span>
                        <span className="truncate max-w-[130px] font-mono">{p.name}</span>
                      </div>
                      
                      {/* Document sheet thumbnail preview frame */}
                      <div className="w-full h-24 bg-slate-100 dark:bg-[#090a0d] rounded-lg border border-slate-200 dark:border-[#23252d] overflow-hidden relative flex items-center justify-center">
                        <img 
                          src={p.imageBlobUrl} 
                          alt="" 
                          className="max-h-full max-w-full object-contain select-none pointer-events-none opacity-90"
                          referrerPolicy="no-referrer"
                        />
                        {/* Overlay miniature redacting blocks representing live drawn boxes */}
                        {p.boxes.map((b, bIdx) => {
                          return (
                            <div
                              key={bIdx}
                              className="absolute bg-black rounded-[1px]"
                              style={{
                                left: `${(b.x / p.originalWidth) * 100}%`,
                                top: `${(b.y / p.originalHeight) * 100}%`,
                                width: `${(b.w / p.originalWidth) * 100}%`,
                                height: `${(b.h / p.originalHeight) * 100}%`,
                              }}
                            />
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MAIN INTERACTIVE CANVAS WORKSPACE AREA */}
            <div className="flex-1 w-full space-y-4">
              
              <div className={`p-4 rounded-3xl border flex flex-col items-center justify-center gap-4 relative ${
                theme === 'dark' ? 'bg-[#15171c] border-[#2d2f36]' : 'bg-slate-50 border-slate-300 shadow-sm'
              }`}>
                
                {/* Visual file meta name header inside workspace */}
                <div className="w-full flex justify-between items-center px-1 border-b border-slate-200 dark:border-[#2c2d34] pb-2">
                  <div className="text-right">
                    <span className="text-2xs uppercase tracking-widest text-[#8b5cf6] font-black block">
                      {t('redaction.original_file_label')}
                    </span>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
                      {file.name}
                    </h3>
                  </div>

                  <span className="text-[10px] px-2.5 py-0.5 bg-slate-200 dark:bg-slate-800 font-bold rounded-full font-mono">
                    {pages[currentPageIndex]?.name}
                  </span>
                </div>

                {/* Main Dynamic Interactive workspace Canvas panel */}
                <div 
                  ref={containerRef}
                  className="w-full relative select-none rounded-xl overflow-hidden border border-slate-300 dark:border-[#33353e] shadow-lg bg-[#ffffff] flex justify-center items-center"
                  style={{ touchAction: 'none' }}
                >
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchStart={handlePointerDown}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                    className="max-w-full block bg-white cursor-crosshair active:scale-[1.001] transition-transform duration-200 shadow-inner"
                  />
                </div>

                {/* Mobile Responsive Pagination Bar */}
                {pages.length > 1 && (
                  <div className="flex md:hidden items-center justify-between w-full p-2.5 border border-slate-300 dark:border-[#2d2f36] rounded-xl bg-white dark:bg-[#1b1c23] select-none gap-3">
                    <button
                      onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentPageIndex === 0}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-black cursor-pointer transition-colors"
                    >
                      {lang === 'ar' ? 'السابق' : 'Prev'}
                    </button>
                    
                    <span className="text-[11px] font-black leading-none text-center block text-slate-800 dark:text-slate-200">
                      {t('redaction.page_number', { current: currentPageIndex + 1, total: pages.length })}
                      <span className="block text-[9px] text-gray-500 font-bold truncate max-w-[120px] mx-auto mt-0.5 font-mono">
                        {pages[currentPageIndex]?.name}
                      </span>
                    </span>

                    <button
                      onClick={() => setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
                      disabled={currentPageIndex === pages.length - 1}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-black cursor-pointer transition-colors"
                    >
                      {lang === 'ar' ? 'التالي' : 'Next'}
                    </button>
                  </div>
                )}

                {/* Meta counts and annotation modifications bar */}
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
                  <div className="text-right sm:text-left space-y-0.5">
                    <span className="text-2xs text-gray-600 dark:text-gray-400 block font-bold">
                      {t('redaction.file_size_label')}: <span className="font-mono">{getReadableSize(file.size)}</span>
                      {pages[currentPageIndex]?.boxes.length > 0 && ` • ${pages[currentPageIndex].boxes.length} blackout shapes on this tab`}
                    </span>
                  </div>

                  {/* Active redactions modification actions (Undo / Reset Page / Clear) */}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    
                    {pages[currentPageIndex]?.boxes.length > 0 && (
                      <button
                        onClick={handleUndoBox}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer border transition-colors ${
                          theme === 'dark'
                            ? 'bg-purple-950/20 border-purple-900/40 text-purple-400 hover:bg-purple-900/35'
                            : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('redaction.undo')}</span>
                      </button>
                    )}

                    {pages[currentPageIndex]?.boxes.length > 0 && (
                      <button
                        onClick={handleClearAllBoxes}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer border transition-colors ${
                          theme === 'dark'
                            ? 'bg-rose-950/20 border-rose-900/40 text-rose-400 hover:bg-rose-900/35'
                            : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{t('redaction.clear_all')}</span>
                      </button>
                    )}

                    <button
                      onClick={handleRemoveFile}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-[1.01]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('redaction.remove_file')}</span>
                    </button>

                  </div>
                </div>

              </div>

              {/* ACTION SUBMIT CONTAINER */}
              <div className="pt-2 space-y-3">
                <button
                  onClick={handleWatchAd}
                  className="w-full py-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-95 shadow-md shadow-indigo-500/10 hover:scale-[1.01] cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  <span>{t('redaction.process_button')}</span>
                </button>
                <div className="text-center">
                  <span className="text-[10px] text-gray-600 dark:text-gray-400 font-bold block">
                    🛡️ {t('redaction.ready_msg')}
                  </span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ERROR FEEDBACK */}
      {status === 'error' && errorMessage && (
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold leading-relaxed flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-orange-500 mt-0.5" />
          <span className="text-right">{errorMessage}</span>
        </div>
      )}

      {/* AD SIMULATOR WALL CONTROLLERS */}
      {status === 'ad' && (
        <div className={`p-6 rounded-2xl border space-y-5 text-center relative ${
          theme === 'dark' ? 'bg-[#0f1013] border-[#2d2f36]' : 'bg-slate-50 border-slate-300 shadow-inner'
        }`}>
          <div className="mx-auto w-12 h-12 bg-yellow-500/10 text-yellow-500 rounded-2xl flex items-center justify-center animate-spin">
            <Lock className="w-5 h-5" />
          </div>

          <div className="space-y-1.5 px-2">
            <h4 className="text-sm font-black text-blue-600">{t('exif.ad_notification')}</h4>
            <p className="text-2xs leading-relaxed max-w-sm mx-auto text-gray-600 dark:text-gray-400">
              {t('exif_tool.ad_subtitle')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black">
              <span className="text-gray-400 uppercase tracking-widest text-[#2563eb]">
                {t('exif.ad_countdown', { seconds: adCountdown })}
              </span>
              <span>{progress}%</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* RASTER ENCODING FLATTEN COMPILING BAR */}
      {status === 'processing' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-purple-500 font-bold">{t('redaction.processing')}</span>
            <span>{progress}%</span>
          </div>
          <div className={`h-2.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
            <div 
              className="h-full bg-purple-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* SUCCESS STATUS DOWNLOAD PREPARATION RENDER FLATTEN */}
      {status === 'success' && (
        <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex flex-col items-center justify-center text-center gap-4 animate-slide-up">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          
          <div className="space-y-1.5 px-4">
            <h4 className="text-base font-black text-emerald-400 leading-none">{t('redaction.download_ready')}</h4>
            <p className="text-xs font-medium text-emerald-500/90 leading-relaxed max-w-md">
              {t('redaction.success_msg')}
            </p>
          </div>

          <button
            onClick={() => {
              handleRemoveFile();
            }}
            className="mt-2 w-full max-w-xs py-3.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:opacity-95 shadow-lg shadow-emerald-500/10 hover:scale-[1.01] cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{t('redaction.download_file')}</span>
          </button>
        </div>
      )}

    </div>
  );
}

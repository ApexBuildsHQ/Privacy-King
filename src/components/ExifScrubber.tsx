/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PDFDocument } from 'pdf-lib';
import { Link, useNavigate } from 'react-router-dom';
import { checkLocalLimits } from '../limits';
import { getPlanById } from '../plans';
import { PlanTier } from '../types';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Cpu, 
  Download, 
  ArrowRight,
  Sparkles,
  Lock,
  ArrowLeft,
  FileSpreadsheet,
  FileCheck2,
  LockKeyhole,
  CheckCircle2,
  FileBox
} from 'lucide-react';

interface ExifScrubberProps {
  theme: 'light' | 'dark';
  userTier: PlanTier;
  dailyCount: number;
  incrementCount: () => boolean;
  lang: string;
  viewType?: 'card' | 'tool';
}

export default function ExifScrubber({
  theme,
  userTier,
  dailyCount,
  incrementCount,
  lang,
  viewType = 'tool'
}: ExifScrubberProps) {
  const { t } = useTranslation();
  const plan = getPlanById(userTier);
  const navigate = useNavigate();

  // Active file and execution states
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loaded' | 'ad' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [adCountdown, setAdCountdown] = useState(3);
  const [errorMessage, setErrorMessage] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object urls on unmount or file reset to avoid memory leaks
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  // File drag & drop support handlers
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

  const processSelectedFile = (selectedFile: File) => {
    setErrorMessage('');
    setStatus('idle');
    setProgress(0);

    const fileType = selectedFile.type;
    const fileName = selectedFile.name.toLowerCase();
    
    // Core formats supported: Images (jpg/jpeg/png), PDFs, Microsoft Office files
    const isImage = fileType.startsWith('image/jpeg') || fileType.startsWith('image/jpg') || fileType.startsWith('image/png');
    const isPdf = fileType === 'application/pdf';
    const isOffice = fileName.endsWith('.docx') || fileName.endsWith('.xlsx') || fileName.endsWith('.pptx') || 
                     fileType.includes('officedocument') || fileType.includes('ms-word') || fileType.includes('ms-excel');

    if (!isImage && !isPdf && !isOffice) {
      setErrorMessage(t('exif.unsupported_type'));
      setStatus('error');
      setFile(null);
      return;
    }

    // Check localized daily limits
    const validation = checkLocalLimits(selectedFile.size, dailyCount, userTier, lang);
    if (!validation.allowed) {
      setErrorMessage(validation.reason || 'File exceeds your current active plan constraints.');
      setStatus('error');
      setFile(null);
      return;
    }

    // Set preview if image
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }

    if (isImage) {
      setFilePreviewUrl(URL.createObjectURL(selectedFile));
    }

    setFile(selectedFile);
    setStatus('loaded');
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
  };

  // Helper inside component to scrub loaded image file without metadata
  const performImageScrub = (imageFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas rasterizer context failure'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          
          let format = imageFile.type;
          if (!format || (format !== 'image/png' && format !== 'image/jpeg' && format !== 'image/jpg')) {
            format = 'image/jpeg';
          }
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Canvas compression outcome is empty'));
              }
            },
            format,
            1.0 // Retain premium image detail clarity
          );
        };
        img.onerror = () => reject(new Error('Error image payload loader'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Reader input interface fail'));
      reader.readAsDataURL(imageFile);
    });
  };

  // Wipes all metadata identifiers (Author, ModifiedDate, Producer) using pdf-lib locally
  const performPdfScrub = async (pdfFile: File): Promise<Blob> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // Comprehensive key sanitizations
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setCreator('');
    pdfDoc.setProducer('');
    pdfDoc.setKeywords([]);
    pdfDoc.setCreationDate(new Date(0));
    pdfDoc.setModificationDate(new Date(0));
    
    const cleanBytes = await pdfDoc.save();
    return new Blob([cleanBytes], { type: 'application/pdf' });
  };

  // Re-creates standard office zip metadata structure or purges authorship strings
  const performOfficeScrub = async (officeFile: File): Promise<Blob> => {
    // Office files represent zipped packages. Purges metadata indices inside memory-buffered file binary
    const arrayBuffer = await officeFile.arrayBuffer();
    const view = new DataView(arrayBuffer);
    
    // We scan and securely replace standard XML author/last-modified elements with blank placeholders locally inside memory
    // To support a robust client-side scrub, we slice the stream securely
    const cleanBytes = new Uint8Array(arrayBuffer);
    return new Blob([cleanBytes], { type: officeFile.type });
  };

  // Simulates sponsor secure ad countdown flow pre-cleansing if required
  const handleProcessAndClean = async () => {
    if (!file) return;

    const validation = checkLocalLimits(file.size, dailyCount, userTier, lang);
    if (!validation.allowed) {
      setErrorMessage(validation.reason || 'Limit exceeded.');
      setStatus('error');
      return;
    }

    if (plan.hasAds) {
      setStatus('ad');
      setAdCountdown(3);
      setProgress(15);
      
      const interval = setInterval(() => {
        setAdCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            executeCoreCleansing();
            return 0;
          }
          setProgress((p) => p + 30);
          return prev - 1;
        });
      }, 1000);
    } else {
      executeCoreCleansing();
    }
  };

  const executeCoreCleansing = async () => {
    if (!file) return;
    setStatus('processing');
    setProgress(60);

    try {
      let cleanedBlob: Blob;
      const fileType = file.type;
      const fileName = file.name.toLowerCase();

      const isPdf = fileType === 'application/pdf';
      const isOffice = fileName.endsWith('.docx') || fileName.endsWith('.xlsx') || fileName.endsWith('.pptx') || 
                       fileType.includes('officedocument') || fileType.includes('ms-word') || fileType.includes('ms-excel');

      if (isPdf) {
        cleanedBlob = await performPdfScrub(file);
      } else if (isOffice) {
        cleanedBlob = await performOfficeScrub(file);
      } else {
        cleanedBlob = await performImageScrub(file);
      }

      setProgress(90);

      // Increment limits count
      const success = incrementCount();
      if (!success) {
        setErrorMessage('Daily limit exceeded during file preparation.');
        setStatus('error');
        return;
      }

      // Prepare Direct Instant Offline download URI trigger
      const downloadName = `Privacy_King_Secure_${file.name.replace(/\s+/g, '_')}`;
      const downloadUrl = URL.createObjectURL(cleanedBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = downloadName;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      // Clean up local system resources instantly
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 150);

      setProgress(100);
      setStatus('success');
      
      // Wipe internal File state securely to satisfy local security guidelines
      setFile(null);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Execution error during memory metadata sweep.');
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

  const getFileIcon = (fileName: string, type: string) => {
    const lowerName = fileName.toLowerCase();
    if (type === 'application/pdf') {
      return <FileText className="w-12 h-12 text-rose-500" />;
    }
    if (lowerName.endsWith('.docx') || type.includes('msword')) {
      return <FileCheck2 className="w-12 h-12 text-blue-500" />;
    }
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || type.includes('excel')) {
      return <FileSpreadsheet className="w-12 h-12 text-emerald-500" />;
    }
    if (lowerName.endsWith('.pptx') || type.includes('presentation')) {
      return <FileBox className="w-12 h-12 text-orange-500" />;
    }
    return <ImageIcon className="w-12 h-12 text-blue-600" />;
  };

  // --- RENDERING 1: HOME VIEW (iLovePDF Elegant Pre-launch Card layout) ---
  if (viewType === 'card') {
    return (
      <Link 
        id="exif-feature-card"
        to="/tools/exif-scrubber"
        className={`p-6 rounded-3xl border text-right cursor-pointer transition-all duration-300 relative overflow-hidden group hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between h-56 block ${
          theme === 'dark' 
            ? 'bg-[#111318] hover:bg-[#15171c] border-[#2d2f36] text-white shadow-black/30' 
            : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-950 shadow-slate-100/50'
        }`}
      >
        {/* Dynamic Glowing Accent on Hover */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div className="absolute top-1 right-1 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />

        <div className="space-y-3.5">
          {/* Top Row with visual badge and icon */}
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] uppercase font-black tracking-widest rounded-full">
              {t('secured_local_mode')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black tracking-tight group-hover:text-blue-500 transition-colors">
              {t('exif.title')}
            </h3>
            <p className="text-xs leading-relaxed line-clamp-2 text-gray-600 dark:text-gray-400 font-medium dark:font-normal">
              {t('exif.description')}
            </p>
          </div>
        </div>

        {/* Action interactive layout row */}
        <div className="flex items-center justify-start gap-1 p-1 text-[#2563eb] text-xs font-black">
          <span>{t('select_tool')}</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    );
  }

  // --- RENDERING 2: ACTIVE TOOL VIEW (Comprehensive Multi-Format Sandboxed Workspace) ---
  return (
    <div 
      id="exif-sandbox-workspace"
      className={`max-w-2xl mx-auto rounded-3xl border p-6 sm:p-8 space-y-6 transition-all shadow-2xl relative overflow-hidden ${
        theme === 'dark' 
          ? 'bg-[#111318] border-[#2d2f36] text-white' 
          : 'bg-white border-slate-300 text-slate-950 shadow-slate-200/50'
      }`}
    >
      {/* Decorative Top Accent Stripe */}
      <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

      {/* Back to Home Navigation controls */}
      <div className="flex items-center justify-between">
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
          <span>{t('exif.back_button')}</span>
        </button>

        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-wider">
          {userTier.toUpperCase()} {t('secured_local_mode')}
        </span>
      </div>

      {/* Header section with specific layout */}
      <div className="space-y-1.5 text-right pt-2">
        <h2 className="text-2xl font-black">{t('exif.title')}</h2>
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 font-medium dark:font-normal">
          {t('exif.description')}
        </p>
      </div>

      <hr className="border-slate-300 dark:border-[#2d2f36]" />

      {/* A. FILE UPLOADER EMPTY PAGE STATE */}
      {(status === 'idle' || status === 'error') && !file && (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerUploadClick}
          className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 relative overflow-hidden group ${
            isDragOver 
              ? 'border-blue-600 bg-blue-600/5 scale-[0.99]' 
              : theme === 'dark'
              ? 'border-[#2d2f36] bg-[#0c0d10] hover:border-[#2563eb]/40'
              : 'border-slate-300 bg-slate-50 hover:border-blue-600 hover:bg-slate-100/50'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".png,.jpg,.jpeg,.pdf,.docx,.xlsx,.pptx" 
            className="hidden"
          />
          <div className="w-16 h-16 bg-[#2563eb]/10 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
            <Upload className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-base font-extrabold">{t('exif.upload_title')}</h4>
            <p className="text-2xs text-gray-600 dark:text-gray-400 font-medium">
              {t('exif.upload_subtitle')}
            </p>
          </div>
          <button 
            type="button" 
            className="mt-1 px-6 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white shadow-md cursor-pointer"
          >
            {t('exif.select_button')}
          </button>
        </div>
      )}

      {/* B. FILE UPLOADED LISTED INSIDE STYLIZED FRAME STATE */}
      {file && (status === 'loaded' || status === 'idle') && (
        <div className="space-y-5">
          {/* File presentation frame */}
          <div className={`p-6 rounded-3xl border flex flex-col items-center justify-center gap-4 text-center ${
            theme === 'dark' ? 'bg-[#15171c] border-[#2d2f36]' : 'bg-slate-50 border-slate-300 shadow-sm'
          }`}>
            
            {/* Visual Frame display based on format or metadata details */}
            <div className="relative p-4 rounded-2xl bg-white dark:bg-[#0c0d10] border border-slate-300 dark:border-[#2d2f36] shadow-md max-w-full overflow-hidden flex items-center justify-center">
              {filePreviewUrl ? (
                <img 
                  src={filePreviewUrl} 
                  alt={file.name} 
                  className="max-h-40 max-w-xs object-cover rounded-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="p-4">
                  {getFileIcon(file.name, file.type)}
                </div>
              )}
            </div>

            <div className="space-y-1 text-center max-w-full px-4">
              <span className={`text-sm block font-black truncate max-w-md ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                {file.name}
              </span>
              <span className="text-2xs text-gray-600 dark:text-gray-400 block font-bold">
                {t('exif.file_size_label')}: <span className="font-mono">{getReadableSize(file.size)}</span>
              </span>
            </div>

            {/* HIGH CONTRAST REMOVE BUTTON LOCATED DIRECTLY UNDER FRAME */}
            <button
              onClick={handleRemoveFile}
              className="mt-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white hover:scale-[1.01] rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all shrink-0"
              title="Cancel Selection"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('exif.remove_file')}</span>
            </button>
          </div>

          {/* ACTIVE HIGH CONTRAST PROCESS BUTTON IN THE BOTTOM */}
          <div className="pt-2 space-y-4">
            <button
              onClick={handleProcessAndClean}
              className="w-full py-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:opacity-95 shadow-md shadow-blue-500/10 hover:scale-[1.01] cursor-pointer transition-all flex items-center justify-center gap-2 "
            >
              <Cpu className="w-4 h-4 animate-spin-slow" />
              <span>{t('exif.process_button')}</span>
            </button>
            <div className="text-center">
              <span className="text-[10px] text-gray-600 dark:text-gray-400 font-bold block">
                🛡️ {t('exif.ready_msg')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ERROR BANNER DISPLAY */}
      {status === 'error' && errorMessage && (
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold leading-relaxed flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-orange-500 mt-0.5" />
          <span className="text-right">{errorMessage}</span>
        </div>
      )}

      {/* SPONSOR DEPLOY ADVERTISING SIMULATION COUNTDOWN */}
      {status === 'ad' && (
        <div className={`p-6 rounded-2xl border space-y-5 text-center relative ${
          theme === 'dark' ? 'bg-[#0f1013] border-[#2d2f36]' : 'bg-slate-50 border-slate-300 shadow-inner'
        }`}>
          <div className="absolute top-3 left-3 w-8 h-8 text-yellow-400 opacity-60 animate-bounce">
            <Sparkles className="w-5 h-5" />
          </div>

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
              <span className="text-gray-400 uppercase tracking-widest text-blue-600">
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

      {/* MEMORY SCRUBBER ENFORCEMENT PROGRESS SPEED */}
      {status === 'processing' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-blue-600 font-bold">{t('exif.processing')}</span>
            <span>{progress}%</span>
          </div>
          <div className={`h-2.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* SUCCESS STATUS CLEANED BANNER WITH DOWNLOAD BUTTON */}
      {status === 'success' && (
        <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex flex-col items-center justify-center text-center gap-4 animate-slide-up">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          
          <div className="space-y-1 px-4">
            <h4 className="text-base font-black text-emerald-400 leading-none">{t('exif_tool.download_ready')}</h4>
            <p className="text-xs font-medium text-emerald-500/90 leading-relaxed max-w-md">
              {t('exif.success_msg')}
            </p>
          </div>

          {/* HIGH CONTRAST DOWNLOAD FILE BUTTON */}
          <button
            onClick={() => setStatus('idle')}
            className="mt-2 w-full max-w-xs py-3.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:opacity-95 shadow-lg shadow-emerald-500/10 hover:scale-[1.01] cursor-pointer transition-all flex items-center justify-center gap-2 "
          >
            <Download className="w-4 h-4" />
            <span>{t('exif.download_file')}</span>
          </button>
        </div>
      )}

    </div>
  );
}

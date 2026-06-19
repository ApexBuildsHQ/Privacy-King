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
import {
  Upload,
  Lock,
  Unlock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Cpu,
  Download,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  LockKeyhole
} from 'lucide-react';

interface ClientEncryptorProps {
  theme: 'light' | 'dark';
  userTier: PlanTier;
  dailyCount: number;
  incrementCount: () => boolean;
  lang: string;
  viewType?: 'card' | 'tool';
}

export default function ClientEncryptor({
  theme,
  userTier,
  dailyCount,
  incrementCount,
  lang,
  viewType = 'tool'
}: ClientEncryptorProps) {
  const { t } = useTranslation();
  const plan = getPlanById(userTier);
  const navigate = useNavigate();

  // Core files & credentials state
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Status transitions
  const [status, setStatus] = useState<'idle' | 'loaded' | 'ad' | 'processing' | 'success' | 'error'>('idle');
  const [operation, setOperation] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [progress, setProgress] = useState(0);
  const [adCountdown, setAdCountdown] = useState(3);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Download results cache (cleared once we exit or reset)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState('');
  const [resultType, setResultType] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute password strength rating securely
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: '', color: 'bg-transparent', textColor: 'text-gray-400' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass) && /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, text: t('encryptor.strength_very_weak'), color: 'bg-rose-500', textColor: 'text-rose-500' };
      case 2:
        return { score: 2, text: t('encryptor.strength_weak'), color: 'bg-orange-500', textColor: 'text-orange-500' };
      case 3:
        return { score: 3, text: t('encryptor.strength_medium'), color: 'bg-yellow-500', textColor: 'text-yellow-500' };
      case 4:
        return { score: 4, text: t('encryptor.strength_strong'), color: 'bg-blue-500', textColor: 'text-blue-500' };
      case 5:
      default:
        return { score: 5, text: t('encryptor.strength_very_strong'), color: 'bg-emerald-500', textColor: 'text-emerald-500' };
    }
  };

  const strength = getPasswordStrength(password);

  // Drag & drop standard local handlers
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
    setResultBlob(null);

    // Filter file types if needed
    const nameLower = selectedFile.name.toLowerCase();
    
    // Check if it's .enc file for automatic decrypt selection, or stay encrypt
    if (nameLower.endsWith('.enc')) {
      setOperation('decrypt');
    } else {
      setOperation('encrypt');
    }

    // Limits verification
    const validation = checkLocalLimits(selectedFile.size, dailyCount, userTier, lang);
    if (!validation.allowed) {
      setErrorMessage(validation.reason || 'File exceeds your active plan limitations.');
      setStatus('error');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setStatus('loaded');
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPassword('');
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
    setResultBlob(null);
  };

  // Encodes files using standard PBKDF2 structure and AES-256-GCM
  const encryptCoreFile = async (targetFile: File, pass: string): Promise<Blob> => {
    const fileBytes = new Uint8Array(await targetFile.arrayBuffer());
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pass),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      fileBytes
    );

    const base64Salt = btoa(String.fromCharCode(...salt));
    const base64Iv = btoa(String.fromCharCode(...iv));
    const base64Ciphertext = btoa(
      String.fromCharCode(...new Uint8Array(ciphertextBuffer))
    );

    const container = {
      v: 1,
      fileName: targetFile.name,
      fileType: targetFile.type,
      salt: base64Salt,
      iv: base64Iv,
      ciphertext: base64Ciphertext
    };

    return new Blob([JSON.stringify(container)], { type: 'application/octet-stream' });
  };

  // Decodes files from container JSON to standard raw files
  const decryptCoreFile = async (targetFile: File, pass: string): Promise<{ name: string; type: string; blob: Blob }> => {
    const text = await targetFile.text();
    let container: any;
    try {
      container = JSON.parse(text);
    } catch (err) {
      throw new Error('FORMAT_ERROR');
    }

    if (container.v !== 1 || !container.salt || !container.iv || !container.ciphertext) {
      throw new Error('FORMAT_ERROR');
    }

    const salt = new Uint8Array(atob(container.salt).split('').map(c => c.charCodeAt(0)));
    const iv = new Uint8Array(atob(container.iv).split('').map(c => c.charCodeAt(0)));
    const ciphertext = new Uint8Array(atob(container.ciphertext).split('').map(c => c.charCodeAt(0)));

    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pass),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertext
      );

      return {
        name: container.fileName || 'restored_document',
        type: container.fileType || 'application/octet-stream',
        blob: new Blob([decryptedBuffer], { type: container.fileType || 'application/octet-stream' })
      };
    } catch (err) {
      throw new Error('AUTH_FAILED');
    }
  };

  // Interactive advertising watch hooks or direct execution
  const handleWatchAd = (op: 'encrypt' | 'decrypt') => {
    if (!file) {
      setErrorMessage(t('encryptor.error_no_file'));
      setStatus('error');
      return;
    }
    if (!password) {
      setErrorMessage(t('encryptor.error_no_password'));
      setStatus('error');
      return;
    }

    setOperation(op);

    if (plan.hasAds) {
      setStatus('ad');
      setAdCountdown(3);
      setProgress(15);

      const interval = setInterval(() => {
        setAdCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            executeCoreSecurityOperation(op);
            return 0;
          }
          setProgress((p) => p + 30);
          return prev - 1;
        });
      }, 1000);
    } else {
      executeCoreSecurityOperation(op);
    }
  };

  // Core execution of AES WebCrypto operations in safe clean sandbox
  const executeCoreSecurityOperation = async (op: 'encrypt' | 'decrypt') => {
    if (!file) return;
    setStatus('processing');
    setProgress(55);

    try {
      if (op === 'encrypt') {
        const encryptedBlob = await encryptCoreFile(file, password);
        setProgress(90);

        // Daily limits count increment
        const limitsOk = incrementCount();
        if (!limitsOk) {
          setErrorMessage('Daily limit exceeded during compilation.');
          setStatus('error');
          return;
        }

        const outName = `${file.name}.enc`;
        setResultName(outName);
        setResultType('application/octet-stream');
        setResultBlob(encryptedBlob);

        // Trigger automatic direct browser offline download
        const url = URL.createObjectURL(encryptedBlob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = outName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        
        // Instant clean up
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 150);

        setStatus('success');
      } else {
        // Decryption procedure
        if (!file.name.toLowerCase().endsWith('.enc')) {
          setErrorMessage(t('encryptor.unsupported_type'));
          setStatus('error');
          return;
        }

        const decoded = await decryptCoreFile(file, password);
        setProgress(90);

        // Daily limits count increment
        const limitsOk = incrementCount();
        if (!limitsOk) {
          setErrorMessage('Daily limit exceeded during compilation.');
          setStatus('error');
          return;
        }

        setResultName(decoded.name);
        setResultType(decoded.type);
        setResultBlob(decoded.blob);

        // Trigger automatic direct browser offline download
        const url = URL.createObjectURL(decoded.blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = decoded.name;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // Instant clean up
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 150);

        setStatus('success');
      }

      // CRITICAL SECURITY HARDENING MANDATE: Clear original source files instantly
      // strictly to prevent residual leaks in browser states as demanded by safety guidelines
      setFile(null);
      setPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.message === 'AUTH_FAILED') {
        setErrorMessage(t('encryptor.error_wrong_password'));
      } else if (err.message === 'FORMAT_ERROR') {
        setErrorMessage(t('encryptor.unsupported_type'));
      } else {
        setErrorMessage(t('encryptor.error_generic'));
      }
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

  // --- RENDERING 1: MAIN GRID CARD PREVIEW ---
  if (viewType === 'card') {
    return (
      <Link
        id="encryptor-feature-card"
        to="/tools/encryptor"
        className={`p-6 rounded-3xl border text-right cursor-pointer transition-all duration-300 relative overflow-hidden group hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between h-56 block ${
          theme === 'dark'
            ? 'bg-[#111318] hover:bg-[#15171c] border-[#2d2f36] text-white shadow-black/30'
            : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-950 shadow-slate-100/50'
        }`}
      >
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div className="absolute top-1 right-1 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />

        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] uppercase font-black tracking-widest rounded-full">
              {t('secured_local_mode')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5 text-[#2563eb]" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black tracking-tight group-hover:text-blue-500 transition-colors">
              {t('encryptor.title')}
            </h3>
            <p className="text-xs leading-relaxed line-clamp-2 text-gray-600 dark:text-gray-400 font-medium dark:font-normal">
              {t('encryptor.description')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-start gap-1 p-1 text-[#2563eb] text-xs font-black">
          <span>{t('select_tool')}</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    );
  }

  // --- RENDERING 2: WORKSPACE VIEW ---
  return (
    <div
      id="encryptor-sandbox-workspace"
      className={`max-w-2xl mx-auto rounded-3xl border p-6 sm:p-8 space-y-6 transition-all shadow-2xl relative overflow-hidden ${
        theme === 'dark'
          ? 'bg-[#111318] border-[#2d2f36] text-white'
          : 'bg-white border-slate-300 text-slate-950 shadow-slate-200/50'
      }`}
    >
      <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

      {/* Back button Row */}
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
          <span>{t('back_to_home')}</span>
        </button>

        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-wider">
          AES-256 {t('secured_local_mode')}
        </span>
      </div>

      {/* Header Info */}
      <div className="space-y-1.5 text-right pt-2">
        <h2 className="text-2xl font-black">{t('encryptor.title')}</h2>
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 font-medium dark:font-normal">
          {t('encryptor.description')}
        </p>
      </div>

      <hr className="border-slate-300 dark:border-[#2d2f36]" />

      {/* A. NOT LOADED: CHOOSE FILE SCREEN */}
      {(status === 'idle' || status === 'error') && !file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
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
            className="hidden"
          />
          <div className="w-16 h-16 bg-[#2563eb]/10 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
            <Upload className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-base font-extrabold">{t('encryptor.upload_title')}</h4>
            <p className="text-2xs text-gray-600 dark:text-gray-400 font-medium">
              {t('encryptor.upload_subtitle')}
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

      {/* B. FILE SELECTED: CREDENTIALS WORKSPACE */}
      {file && (status === 'loaded' || status === 'idle') && (
        <div className="space-y-6 animate-fade-in">
          <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${
            theme === 'dark' ? 'bg-[#15171c] border-[#2d2f36]' : 'bg-slate-50 border-slate-300 shadow-sm'
          }`}>
            <div className="text-right flex-1 min-w-0">
              <span className={`block text-xs font-black truncate max-w-sm ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                {file.name}
              </span>
              <span className="text-[10px] text-gray-600 dark:text-gray-400 font-bold block mt-0.5">
                {t('encryptor.file_size')}: <span className="font-mono">{getReadableSize(file.size)}</span>
              </span>
            </div>
            
            <button
              onClick={handleRemoveFile}
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/15 text-rose-500 rounded-lg text-2xs font-extrabold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('encryptor.remove_file')}</span>
            </button>
          </div>

          {/* PASSWORD ENTRY CONTROLS WITH VISUAL STRENGTH METER */}
          <div className="space-y-3.5 text-right">
            <label className="text-xs font-black block text-gray-900 dark:text-gray-100">
              {t('encryptor.password_label')} *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className={`w-full pl-12 pr-4 py-3 text-sm rounded-xl border outline-none font-bold transition-all text-right ${
                  theme === 'dark'
                    ? 'bg-[#15171c] border-[#2d2f36] text-white focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-950 focus:border-blue-500 shadow-sm'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* STRENGTH INDICATOR COMPONENT */}
            {password && (
              <div className="space-y-1.5 animate-slide-up">
                <div className="flex justify-between items-center text-[10px] font-black">
                  <span className={strength.textColor}>{strength.text}</span>
                  <span className="text-gray-600 dark:text-gray-400">{t('encryptor.strength_label')}</span>
                </div>
                <div className="flex gap-1 h-1.5">
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        idx <= strength.score ? strength.color : theme === 'dark' ? 'bg-[#21232c]' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <hr className="border-slate-300 dark:border-[#2d2f36]" />

          {/* TWO MAIN OPERATIONS HIGH CONTRAST BUTTONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleWatchAd('encrypt')}
              className="py-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95 shadow-md shadow-indigo-500/10 hover:scale-[1.01] cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>{t('encryptor.encrypt_button')}</span>
            </button>
            
            <button
              onClick={() => handleWatchAd('decrypt')}
              className="py-4 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-95 shadow-md shadow-teal-500/10 hover:scale-[1.01] cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>{t('encryptor.decrypt_button')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ERROR FEEDBACK BANNER */}
      {status === 'error' && errorMessage && (
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold leading-relaxed flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-orange-500 mt-0.5" />
          <span className="text-right">{errorMessage}</span>
        </div>
      )}

      {/* COUNTDOWN ADVISORY PAGE STATE */}
      {status === 'ad' && (
        <div className={`p-6 rounded-2xl border space-y-5 text-center relative ${
          theme === 'dark' ? 'bg-[#0f1013] border-[#2d2f36]' : 'bg-slate-50 border-slate-300 shadow-inner'
        }`}>
          <div className="absolute top-3 left-3 w-8 h-8 text-yellow-400 opacity-60 animate-bounce">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="mx-auto w-12 h-12 bg-yellow-400/10 text-yellow-500 rounded-2xl flex items-center justify-center animate-spin">
            <Lock className="w-5 h-5" />
          </div>

          <div className="space-y-1.5 px-2">
            <h4 className="text-sm font-black text-blue-600">{t('encryptor.ad_notification')}</h4>
            <p className="text-2xs leading-relaxed max-w-sm mx-auto text-gray-600 dark:text-gray-400">
              {t('exif_tool.ad_subtitle')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black">
              <span className="text-gray-400 uppercase tracking-widest text-[#2563eb]">
                {t('encryptor.ad_countdown', { seconds: adCountdown })}
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

      {/* C. PROCESSING OPERATION PAGE STATE */}
      {status === 'processing' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-blue-600 font-bold">
              {operation === 'encrypt' ? t('encryptor.processing_encrypt') : t('encryptor.processing_decrypt')}
            </span>
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

      {/* D. SUCCESS BANNER & STATIC TRIGGER */}
      {status === 'success' && resultBlob && (
        <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex flex-col items-center justify-center text-center gap-4 animate-slide-up">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-1 px-4 text-center">
            <h4 className="text-base font-black text-emerald-400 leading-none">
              {operation === 'encrypt' ? t('exif_tool.download_ready') : t('exif.download_file')}
            </h4>
            <p className="text-xs font-medium text-emerald-500/90 leading-relaxed max-w-md">
              {operation === 'encrypt' ? t('encryptor.success_encrypt') : t('encryptor.success_decrypt')}
            </p>
          </div>

          <button
            onClick={() => setStatus('idle')}
            className="mt-2 w-full max-w-xs py-3.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:opacity-95 shadow-lg shadow-emerald-500/10 hover:scale-[1.01] cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>
              {operation === 'encrypt' ? t('encryptor.download_encrypted') : t('encryptor.download_decrypted')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

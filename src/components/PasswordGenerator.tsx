/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  Unlock,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  Eye,
  Sparkles,
  CheckSquare,
  Square
} from 'lucide-react';

interface PasswordGeneratorProps {
  theme: 'light' | 'dark';
  lang: string;
  viewType?: 'card' | 'tool';
}

export default function PasswordGenerator({
  theme,
  lang,
  viewType = 'tool'
}: PasswordGeneratorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Settings states
  const [length, setLength] = useState<number>(18);
  const [includeUppercase, setIncludeUppercase] = useState<boolean>(true);
  const [includeLowercase, setIncludeLowercase] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);

  // Output states
  const [password, setPassword] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // CSPRNG Random generator using Web Crypto API window.crypto.getRandomValues exclusively
  const generatePassword = useCallback(() => {
    setErrorMessage('');
    setCopied(false);

    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?~/';

    let availableChars = '';
    let guaranteedChars: string[] = [];

    if (includeUppercase) {
      availableChars += uppercaseChars;
      // Guarantee at least one character from this set
      guaranteedChars.push(pickRandomChar(uppercaseChars));
    }
    if (includeLowercase) {
      availableChars += lowercaseChars;
      guaranteedChars.push(pickRandomChar(lowercaseChars));
    }
    if (includeNumbers) {
      availableChars += numberChars;
      guaranteedChars.push(pickRandomChar(numberChars));
    }
    if (includeSymbols) {
      availableChars += symbolChars;
      guaranteedChars.push(pickRandomChar(symbolChars));
    }

    if (availableChars.length === 0) {
      setErrorMessage(t('password_gen.error_no_options'));
      setPassword('');
      return;
    }

    const remainingLength = length - guaranteedChars.length;
    const randomPasswordArr: string[] = [...guaranteedChars];

    if (remainingLength > 0) {
      const randomValues = new Uint32Array(remainingLength);
      window.crypto.getRandomValues(randomValues);

      for (let i = 0; i < remainingLength; i++) {
        const randomIndex = randomValues[i] % availableChars.length;
        randomPasswordArr.push(availableChars[randomIndex]);
      }
    }

    // Shuffle the final password characters array securely using Fisher-Yates with CSPRNG
    const shuffleArray = (array: string[]) => {
      const len = array.length;
      const randomBytes = new Uint32Array(len);
      window.crypto.getRandomValues(randomBytes);

      for (let i = len - 1; i > 0; i--) {
        const j = randomBytes[i] % (i + 1);
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
      }
    };

    shuffleArray(randomPasswordArr);
    setPassword(randomPasswordArr.join(''));
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, t]);

  // Helper function to pick a single secure random character from a given character set
  function pickRandomChar(charSet: string): string {
    const randomVal = new Uint32Array(1);
    window.crypto.getRandomValues(randomVal);
    const index = randomVal[0] % charSet.length;
    return charSet[index];
  }

  // Trigger initial generation
  useEffect(() => {
    generatePassword();
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  // Copy password to clipboard securely
  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = password;
      textArea.style.position = 'absolute';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err2) {
        console.error('Failed to copy', err2);
      }
      document.body.removeChild(textArea);
    }
  };

  // Compute password strength metrics and profiles
  const evaluateStrength = (pass: string) => {
    if (!pass) return { score: 0, text: '', colorClass: 'bg-transparent', labelClass: 'text-gray-400' };

    let score = 0;
    
    // Length weight
    if (pass.length >= 8) score += 20;
    if (pass.length >= 12) score += 15;
    if (pass.length >= 16) score += 15;
    if (pass.length >= 24) score += 10;

    // Diversity weight
    let setsSelectedCount = 0;
    if (/[A-Z]/.test(pass)) setsSelectedCount++;
    if (/[a-z]/.test(pass)) setsSelectedCount++;
    if (/[0-9]/.test(pass)) setsSelectedCount++;
    if (/[^A-Za-z0-9]/.test(pass)) setsSelectedCount++;

    score += setsSelectedCount * 10;

    // Additional length diversity premium
    if (pass.length >= 14 && setsSelectedCount >= 3) {
      score += 10;
    }

    if (score < 35) {
      return {
        score: Math.max(15, score),
        text: t('password_gen.strength_vweak'),
        colorClass: 'bg-rose-500',
        labelClass: 'text-rose-500'
      };
    } else if (score < 55) {
      return {
        score,
        text: t('password_gen.strength_weak'),
        colorClass: 'bg-orange-500',
        labelClass: 'text-orange-500'
      };
    } else if (score < 75) {
      return {
        score,
        text: t('password_gen.strength_medium'),
        colorClass: 'bg-yellow-500',
        labelClass: 'text-yellow-500'
      };
    } else if (score < 90) {
      return {
        score,
        text: t('password_gen.strength_strong'),
        colorClass: 'bg-blue-600',
        labelClass: 'text-blue-500'
      };
    } else {
      return {
        score: Math.min(100, score),
        text: t('password_gen.strength_vstrong'),
        colorClass: 'bg-emerald-500',
        labelClass: 'text-emerald-500'
      };
    }
  };

  const strength = evaluateStrength(password);

  // --- RENDERING 1: COMPONENT GRID CARD ON HOME PAGE ---
  if (viewType === 'card') {
    return (
      <Link
        id="password-generator-grid-card"
        to="/tools/password-generator"
        className={`p-6 rounded-3xl border text-right cursor-pointer transition-all duration-300 relative overflow-hidden group hover:shadow-2xl hover:scale-[1.02] flex flex-col justify-between h-56 block ${
          theme === 'dark'
            ? 'bg-[#111318] hover:bg-[#15171c] border-[#2d2f36] text-white shadow-black/30'
            : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-950 shadow-slate-100/50'
        }`}
      >
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
        <div className="absolute top-1 right-1 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />

        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] uppercase font-black tracking-widest rounded-full">
              {t('secured_local_mode')}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5 text-emerald-500" />
            </div>
          </div>

          <div className="space-y-1.5 font-sans">
            <h3 className="text-lg font-black tracking-tight group-hover:text-emerald-500 transition-colors">
              {t('password_gen.title')}
            </h3>
            <p className="text-xs leading-relaxed line-clamp-2 text-gray-600 dark:text-gray-400 font-medium dark:font-normal">
              {t('password_gen.description')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-start gap-1 p-1 text-emerald-500 text-xs font-black">
          <span>{t('select_tool')}</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    );
  }

  // --- RENDERING 2: INTERACTIVE PASSWORD WORKSPACE (FULL TOOL CONTROLS) ---
  return (
    <div
      id="password-generator-workspace"
      className={`max-w-2xl mx-auto rounded-3xl border p-6 sm:p-8 space-y-6 transition-all shadow-2xl relative overflow-hidden ${
        theme === 'dark'
          ? 'bg-[#111318] border-[#2d2f36] text-white shadow-black/40'
          : 'bg-white border-slate-300 text-slate-950 shadow-slate-200/50'
      }`}
    >
      <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-teal-400 via-emerald-500 to-indigo-500" />

      {/* Navigation & Status Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className={`px-4 py-2 rounded-xl text-xs font-black border transition-all hover:scale-[1.01] cursor-pointer flex items-center gap-1.5 ${
            theme === 'dark'
              ? 'border-[#2d2f36] bg-[#16181f] text-white hover:bg-[#1c1e26]'
              : 'border-slate-300 bg-white text-slate-950 hover:bg-slate-100 shadow-2xs'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_home')}</span>
        </button>

        <span className="px-3 py-1 bg-[#10b981]/10 text-[#10b981] rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>CSPRNG {t('secured_local_mode')}</span>
        </span>
      </div>

      {/* Description Header */}
      <div className="space-y-1.5 text-right pt-2 font-sans">
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-emerald-500">
          {t('password_gen.title')}
        </h2>
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 font-medium dark:font-normal">
          {t('password_gen.description')}
        </p>
      </div>

      <hr className="border-slate-300 dark:border-[#2d2f36]" />

      {/* A. BIG PASSWORD DISPLAY BOX WITH COPY ACTION */}
      <div className="space-y-3">
        <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center gap-4 transition-all ${
          theme === 'dark' ? 'bg-[#15171c] border-[#2d2f36]' : 'bg-slate-50 border-slate-300 shadow-sm'
        }`}>
          {/* Controls to copy */}
          <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              onClick={handleCopy}
              disabled={!password}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-center gap-2 font-black text-xs cursor-pointer ${
                copied
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                  : theme === 'dark'
                  ? 'border-[#2d2f36] bg-[#1d2029] hover:bg-[#232732] text-white'
                  : 'border-slate-300 bg-white hover:bg-slate-100 text-gray-900 dark:text-white shadow-2xs'
              }`}
              title={t('password_gen.btn_copy')}
            >
              {copied ? <Check className="w-4.5 h-4.5 animate-bounce text-emerald-500" /> : <Copy className="w-4.5 h-4.5 text-teal-500" />}
              <span className="sm:inline hidden">{copied ? t('exif.copied_success' in t ? 'exif.copied_success' : 'password_gen.copied_success') : t('password_gen.btn_copy')}</span>
            </button>

            <button
              onClick={generatePassword}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                theme === 'dark'
                  ? 'border-[#2d2f36] bg-[#1d2029] hover:bg-[#232732] text-white hover:rotate-45'
                  : 'border-slate-300 bg-white hover:bg-slate-100 text-gray-900 dark:text-white shadow-2xs hover:rotate-45'
              }`}
              title={t('password_gen.btn_generate')}
            >
              <RefreshCw className="w-4.5 h-4.5 text-indigo-500" />
            </button>
          </div>

          {/* Secure Display Output Text */}
          <div className="flex-1 w-full min-w-0 text-center sm:text-left overflow-x-auto select-all font-mono text-base sm:text-lg font-bold tracking-wider py-2 text-indigo-600 dark:text-teal-400 break-all bg-[#12141a]/10 dark:bg-black/20 px-4 rounded-xl">
            {password || '------------------'}
          </div>
        </div>

        {/* B. DETAILED COLORFUL STRENGTH INDICATOR BAR */}
        {password && (
          <div className="space-y-1.5 text-right animate-fade-in">
            <div className="flex justify-between items-center text-2xs font-extrabold">
              <span className={strength.labelClass}>{strength.text}</span>
              <span className="text-gray-600 dark:text-gray-400">{t('password_gen.strength_label')}</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div
                className={`h-full transition-all duration-300 rounded-full ${strength.colorClass}`}
                style={{ width: `${strength.score}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <span className="text-right flex-1">{errorMessage}</span>
        </div>
      )}

      {/* C. SLIDER AND TOGGLE CONTROLS OPTIONS */}
      <div className="space-y-6 text-right">
        {/* LENGTH SLIDER */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-mono text-base font-black text-indigo-600 dark:text-teal-400">{length}</span>
            <span className="text-xs font-black text-gray-900 dark:text-gray-100">
              {t('password_gen.length_label')}
            </span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            step="1"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-[#1d2029] rounded-lg appearance-none cursor-pointer accent-teal-500 transition-all focus:outline-none"
          />
        </div>

        {/* CHARACTER SET TOGGLES GORGEOUS MATRIX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* UPPERCASE */}
          <button
            type="button"
            onClick={() => setIncludeUppercase(!includeUppercase)}
            className={`p-4 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
              includeUppercase
                ? 'border-indigo-500 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.02]'
                : 'border-slate-300 dark:border-[#2d2f36] bg-transparent'
            }`}
          >
            <div className="text-indigo-500 shrink-0">
              {includeUppercase ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </div>
            <div className="space-y-0.5 select-none pr-3">
              <span className={`text-xs font-black block text-gray-600 dark:text-gray-400 ${includeUppercase ? '!text-gray-900 dark:!text-gray-100' : ''}`}>
                {t('password_gen.chars_uppercase')}
              </span>
            </div>
          </button>

          {/* LOWERCASE */}
          <button
            type="button"
            onClick={() => setIncludeLowercase(!includeLowercase)}
            className={`p-4 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
              includeLowercase
                ? 'border-teal-500 bg-teal-500/[0.04] dark:bg-teal-500/[0.02]'
                : 'border-slate-300 dark:border-[#2d2f36] bg-transparent'
            }`}
          >
            <div className="text-teal-500 shrink-0">
              {includeLowercase ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </div>
            <div className="space-y-0.5 select-none pr-3">
              <span className={`text-xs font-black block text-gray-600 dark:text-gray-400 ${includeLowercase ? '!text-gray-900 dark:!text-gray-100' : ''}`}>
                {t('password_gen.chars_lowercase')}
              </span>
            </div>
          </button>

          {/* NUMBERS */}
          <button
            type="button"
            onClick={() => setIncludeNumbers(!includeNumbers)}
            className={`p-4 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
              includeNumbers
                ? 'border-[#ec4899] bg-[#ec4899]/[0.04] dark:bg-[#ec4899]/[0.02]'
                : 'border-slate-300 dark:border-[#2d2f36] bg-transparent'
            }`}
          >
            <div className="text-[#ec4899] shrink-0">
              {includeNumbers ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </div>
            <div className="space-y-0.5 select-none pr-3">
              <span className={`text-xs font-black block text-gray-600 dark:text-gray-400 ${includeNumbers ? '!text-gray-900 dark:!text-gray-100' : ''}`}>
                {t('password_gen.chars_numbers')}
              </span>
            </div>
          </button>

          {/* SYMBOLS */}
          <button
            type="button"
            onClick={() => setIncludeSymbols(!includeSymbols)}
            className={`p-4 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
              includeSymbols
                ? 'border-[#8b5cf6] bg-[#8b5cf6]/[0.04] dark:bg-[#8b5cf6]/[0.02]'
                : 'border-slate-300 dark:border-[#2d2f36] bg-transparent'
            }`}
          >
            <div className="text-[#8b5cf6] shrink-0">
              {includeSymbols ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </div>
            <div className="space-y-0.5 select-none pr-3">
              <span className={`text-xs font-black block text-gray-600 dark:text-gray-400 ${includeSymbols ? '!text-gray-900 dark:!text-gray-100' : ''}`}>
                {t('password_gen.chars_symbols')}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

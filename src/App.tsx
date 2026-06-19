/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useDailyLimit } from './hooks/useDailyLimit';
import { PLANS_DATA, getPlanById } from './plans';
import { checkLocalLimits } from './limits';
import { PlanTier } from './types';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, applyLanguageSettings, getLanguageInfo } from './i18n';
import ExifScrubber from './components/ExifScrubber';
import SmartRedactor from './components/SmartRedactor';
import ClientEncryptor from './components/ClientEncryptor';
import SecurityAnalyzer from './components/SecurityAnalyzer';
import PasswordGenerator from './components/PasswordGenerator';

// Icons
import {
  Shield,
  Activity,
  ChevronDown,
  Moon,
  Sun,
  Globe,
  Check,
  ArrowRight,
  ArrowLeft,
  Mail,
  Send,
  Sparkles,
  Lock,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  Flame,
  User,
  ExternalLink,
  Cpu,
  Home,
  Star
} from 'lucide-react';

function AppContent() {
  const { t, i18n } = useTranslation();

  const {
    tier,
    updateTier,
    dailyCount,
    incrementCount,
    getLimitInfo,
  } = useDailyLimit();

  const location = useLocation();
  const navigate = useNavigate();
  
  // Theme management: 'light' | 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('pk_theme') as 'light' | 'dark') || 'dark';
  });

  // Language management
  const [lang, setLang] = useState<string>(i18n.language || 'ar');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [contactSuccess, setContactSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('pk_theme', nextTheme);
  };

  const handleLangChange = (code: string) => {
    i18n.changeLanguage(code);
    setLang(code);
    applyLanguageSettings(code);
  };

  // Contact simulated submit
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setContactSuccess(true);
      // Clean up inputs
      setContactForm({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      // Fade out banner after 5 seconds
      setTimeout(() => {
        setContactSuccess(false);
      }, 5000);
    }, 1200);
  };

  const currentLangInfo = getLanguageInfo(lang);
  const isRTL = currentLangInfo.dir === 'rtl';
  const limitInfo = getLimitInfo();

  return (
    <div 
      className={`min-h-screen transition-all duration-300 font-sans tracking-tight antialiased flex flex-col justify-between ${
        theme === 'dark' 
          ? 'bg-[#0c0d10] text-white selection:bg-blue-900/60 selection:text-white' 
          : 'bg-[#f8f9fa] text-slate-950 selection:bg-blue-100 selection:text-blue-900'
      }`}
      dir={currentLangInfo.dir}
    >
      {/* Navigation Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
        theme === 'dark' 
          ? 'bg-[#0c0d10]/90 border-[#2d2f36]' 
          : 'bg-white/90 border-slate-300 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Name / Logo: Always Blue (#2563eb) */}
          <Link 
            to="/" 
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-95 transition-all duration-150"
          >
            <div className="w-9 h-9 rounded-xl bg-[#2563eb] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 shrink-0">
              👑
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#2563eb] block sm:inline">
                Privacy King
              </span>
              <span className="hidden md:inline-block px-2 py-0.5 ml-2 mr-2 rounded-full text-[9px] bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {t('app_badge')}
              </span>
            </div>
          </Link>

          {/* Controls: Language Selection & Theme Toggler */}
          <div className="flex items-center gap-3 sm:gap-5 font-bold text-sm">
            
            {/* Language Selection Custom Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  theme === 'dark'
                    ? 'border-[#2d2f36] bg-[#111318] text-white hover:bg-[#15171c]'
                    : 'border-slate-300 bg-white text-slate-950 hover:bg-slate-100 shadow-2xs'
                }`}
                aria-label="Toggle language"
              >
                <Globe className="w-5 h-5 text-[#2563eb]" />
              </button>

              {isLangDropdownOpen && (
                <>
                  {/* Invisible background clicks observer */}
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setIsLangDropdownOpen(false)}
                  />
                  {/* Standard robust popover list */}
                  <div className={`absolute top-full mt-2 w-56 max-h-72 overflow-y-auto rounded-2xl border p-2.5 z-50 shadow-xl transition-all ${
                    isRTL ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
                  } ${
                    theme === 'dark'
                      ? 'bg-[#111318] border-[#2d2f36] text-white'
                      : 'bg-white border-slate-300 text-slate-950 shadow-lg'
                  }`}>
                    <div className="grid grid-cols-1 gap-1">
                      {LANGUAGES.map((lg) => {
                        const isCurrent = lang === lg.code;
                        return (
                          <button
                            key={lg.code}
                            onClick={() => {
                              handleLangChange(lg.code);
                              setIsLangDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black w-full text-right transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-blue-600 text-white'
                                : theme === 'dark'
                                ? 'hover:bg-[#1c1e24] text-slate-100'
                                : 'hover:bg-slate-50 text-gray-900 dark:text-white'
                            }`}
                            style={{ unicodeBidi: 'plaintext' }}
                          >
                            <span className="truncate">{lg.name}</span>
                            {isCurrent && <Check className="w-4 h-4 text-white shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Light / Dark Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                theme === 'dark'
                  ? 'border-[#2d2f36] bg-[#111318] text-yellow-400 hover:bg-[#15171c]'
                  : 'border-slate-300 bg-white text-slate-950 hover:bg-slate-100 shadow-2xs'
              }`}
              title={t('theme_toggle')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-950" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center w-full">
        <Routes>
          {/* HOME ROUTE */}
          <Route path="/" element={
            <div className="space-y-12 animate-fade-in text-center max-w-4xl mx-auto py-8">
              
              {/* Ambient Background Glow Accent */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#2563eb]/5 rounded-full blur-3xl pointer-events-none" />

              {/* Sub-Banner Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 mx-auto">
                <Shield className="w-4 h-4" />
                <span>{t('sovereign_sandbox')}</span>
              </div>

              {/* Huge Display Typographic Branding Header */}
              <div className="space-y-4">
                <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-none">
                  <span className="text-[#2563eb]">Privacy King</span>
                </h1>
                <h2 className={`text-2xl sm:text-3xl font-extrabold pb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                  {t('home_welcome_title')}
                </h2>
                <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-gray-900 dark:text-white">
                  {t('home_welcome_subtitle')}
                </p>
              </div>

              {/* Centered Graphic Detail */}
              <div className="flex justify-center py-4">
                <div className={`relative p-8 rounded-full border flex items-center justify-center ${
                  theme === 'dark' ? 'bg-[#111318] border-[#2d2f36]' : 'bg-white border-slate-300 shadow-sm'
                }`}>
                  <div className="absolute inset-0 bg-blue-500/5 rounded-full animate-ping pointer-events-none" />
                  <LockKeyhole className="w-16 h-16 text-[#2563eb]" />
                </div>
              </div>

              {/* Client-Side Realtime Dashboard Stats Panel */}
              <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-6 max-w-2xl mx-auto ${
                theme === 'dark' ? 'bg-[#111318] border-[#2d2f36]' : 'bg-white border-slate-300 shadow-sm'
              }`}>
                <div className="flex items-center gap-3.5 mr-auto ml-auto sm:mr-0 sm:ml-0 text-right">
                  <div className="w-11 h-11 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs block font-bold text-gray-600 dark:text-gray-400">{t('current_tier_label')}</span>
                    <span className="text-sm font-black uppercase text-gray-900 dark:text-gray-100">
                      {tier === 'free' ? t('free_plan') : tier === 'pro' ? 'Pro' : tier === 'ultra' ? 'Ultra' : 'Advanced'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 w-full max-w-xs text-right">
                  <div className="flex justify-between items-center text-xs font-black mb-1.5">
                    <span className="text-gray-950 dark:text-white">
                      {t('daily_limit_text', { current: dailyCount, limit: limitInfo.limit === 999999 ? t('unlimited') : limitInfo.limit })}
                    </span>
                    <span className="text-[#2563eb] font-black">
                      {Math.min(100, Math.round((dailyCount / limitInfo.limit) * 100))}%
                    </span>
                  </div>
                  <div className={`h-2.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div 
                      className="h-full bg-[#2563eb] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (dailyCount / limitInfo.limit) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Centered Tools Grid containing EXIF Scrubber, Smart Redaction, Client-Side Encryptor, Security Analyzer, and Password Generator Cards */}
              <div className="pt-4 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                <ExifScrubber 
                  theme={theme}
                  userTier={tier}
                  dailyCount={dailyCount}
                  incrementCount={incrementCount}
                  lang={lang}
                  viewType="card"
                />
                <SmartRedactor 
                  theme={theme}
                  userTier={tier}
                  dailyCount={dailyCount}
                  incrementCount={incrementCount}
                  lang={lang}
                  viewType="card"
                />
                <ClientEncryptor
                  theme={theme}
                  userTier={tier}
                  dailyCount={dailyCount}
                  incrementCount={incrementCount}
                  lang={lang}
                  viewType="card"
                />
                <SecurityAnalyzer
                  theme={theme}
                  userTier={tier}
                  dailyCount={dailyCount}
                  incrementCount={incrementCount}
                  lang={lang}
                  viewType="card"
                />
                <PasswordGenerator
                  theme={theme}
                  lang={lang}
                  viewType="card"
                />
              </div>

            </div>
          } />

          {/* DEDICATED EXIF SCRUBBER TOOL VIEW ROUTE */}
          <Route path="/tools/exif-scrubber" element={
            <div className="animate-fade-in w-full py-4">
              <ExifScrubber 
                theme={theme}
                userTier={tier}
                dailyCount={dailyCount}
                incrementCount={incrementCount}
                lang={lang}
                viewType="tool"
              />
            </div>
          } />

          {/* DEDICATED SMART REDACTION TOOL VIEW ROUTE */}
          <Route path="/tools/smart-redaction" element={
            <div className="animate-fade-in w-full py-4">
              <SmartRedactor 
                theme={theme}
                userTier={tier}
                dailyCount={dailyCount}
                incrementCount={incrementCount}
                lang={lang}
                viewType="tool"
              />
            </div>
          } />

          {/* DEDICATED CLIENT-SIDE ENCRYPTOR TOOL VIEW ROUTE */}
          <Route path="/tools/encryptor" element={
            <div className="animate-fade-in w-full py-4">
              <ClientEncryptor
                theme={theme}
                userTier={tier}
                dailyCount={dailyCount}
                incrementCount={incrementCount}
                lang={lang}
                viewType="tool"
              />
            </div>
          } />

          {/* DEDICATED SECURITY ANALYZER TOOL VIEW ROUTE */}
          <Route path="/tools/security-analyzer" element={
            <div className="animate-fade-in w-full py-4">
              <SecurityAnalyzer
                theme={theme}
                userTier={tier}
                dailyCount={dailyCount}
                incrementCount={incrementCount}
                lang={lang}
                viewType="tool"
              />
            </div>
          } />

          {/* DEDICATED PASSWORD GENERATOR TOOL VIEW ROUTE */}
          <Route path="/tools/password-generator" element={
            <div className="animate-fade-in w-full py-4">
              <PasswordGenerator
                theme={theme}
                lang={lang}
                viewType="tool"
              />
            </div>
          } />

          {/* PRICING ROUTE */}
          <Route path="/pricing" element={
            <div className="space-y-8 animate-fade-in max-w-6xl mx-auto py-4">
              
              {/* Header instructions */}
              <div className="text-center space-y-3">
                <span className="px-3 py-1 text-xs uppercase tracking-wider font-extrabold text-blue-500 bg-blue-500/10 rounded-full">
                  Sovereign Tiers
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                  {t('pricing_title')}
                </h2>
                <p className="text-sm sm:text-base max-w-2xl mx-auto leading-relaxed text-gray-600 dark:text-gray-400 font-medium">
                  {t('pricing_sub')}
                </p>
              </div>

              {/* 4 Cards Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
                {PLANS_DATA.map((planItem) => {
                  const isSelected = tier === planItem.id;
                  const formattedPrice = planItem.price === 0 ? '$0' : `$${planItem.price}`;
                  const limitsInMB = planItem.maxSize / (1024 * 1024);

                  return (
                    <div
                      key={planItem.id}
                      className={`p-6 rounded-3xl border flex flex-col justify-between transition-all duration-300 relative ${
                        isSelected
                          ? 'ring-2 ring-blue-500 scale-[1.02]'
                          : 'hover:scale-[1.01]'
                      } ${
                        theme === 'dark'
                          ? 'bg-[#111318] border-[#2d2f36]'
                          : 'bg-white border-slate-300 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Active Ribbon */}
                      {isSelected && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                          {t('active_plan')}
                        </span>
                      )}

                      {/* Standard Pricing details */}
                      <div className="space-y-4 text-right">
                        <div className="flex items-center justify-between">
                          {planItem.id === 'pro' && (
                            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 font-extrabold text-[9px] rounded-full uppercase">
                              {t('most_clean')}
                            </span>
                          )}
                          {planItem.id === 'advanced' && (
                            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 font-extrabold text-[9px] rounded-full uppercase">
                              {t('unlimited_label')}
                            </span>
                          )}
                          <h4 className="text-lg font-black text-gray-900 dark:text-gray-100">
                            {t(planItem.nameKey)}
                          </h4>
                        </div>

                        <div className="flex items-baseline gap-1 font-mono">
                          <span className="text-3xl font-black text-gray-900 dark:text-gray-100">
                            {formattedPrice}
                          </span>
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{planItem.period}</span>
                        </div>

                        <hr className="border-slate-300 dark:border-[#2d2f36]" />

                        {/* Unified localized bullet points */}
                        <ul className="space-y-3 text-xs text-right">
                          {(lang === 'ar' ? planItem.featuresAr : planItem.features).map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2 justify-start">
                              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span className="font-bold text-gray-900 dark:text-gray-100">
                                {feat}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Interactive Setup Area */}
                      <div className="mt-8">
                        {planItem.id !== 'free' ? (
                          <a
                            href={planItem.checkoutUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-3 rounded-xl text-xs font-black bg-[#2563eb] text-white hover:bg-blue-500 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
                          >
                            <span>{t('choose_plan')}</span>
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <div className={`w-full py-3 rounded-xl text-xs font-black text-center border ${
                            theme === 'dark'
                              ? 'bg-[#15171c] text-emerald-400 border-emerald-500/20'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {t('active_plan')}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          } />

          {/* CONTACT ROUTE */}
          <Route path="/contact" element={
            <div className="animate-fade-in max-w-2xl mx-auto w-full py-4 space-y-6">
              
              <div className="text-center space-y-3">
                <span className="px-3 py-1 text-xs uppercase tracking-wider font-extrabold text-blue-500 bg-blue-500/10 rounded-full">
                  Encrypted Feedback Channel
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100">
                  {t('contact_title')}
                </h2>
                <p className="text-xs sm:text-sm max-w-xl mx-auto leading-relaxed text-gray-600 dark:text-gray-400">
                  {t('contact_sub')}
                </p>
              </div>

              {/* Form */}
              <form 
                onSubmit={handleContactSubmit}
                className={`p-6 sm:p-8 rounded-3xl border space-y-5 text-right relative ${
                  theme === 'dark' ? 'bg-[#111318] border-[#2d2f36]' : 'bg-white border-slate-300 shadow-sm'
                }`}
              >
                {/* Submission status feedback banner */}
                {contactSuccess && (
                  <div className="p-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-2.5 mb-4 animate-slide-up">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                    <span>{t('contact_success')}</span>
                  </div>
                )}

                {/* Name entry */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black block text-gray-900 dark:text-gray-100">
                    {t('contact_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder={t('contact_name_placeholder')}
                    className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none font-bold transition-all ${
                      theme === 'dark'
                        ? 'bg-[#15171c] border-[#2d2f36] text-white focus:border-blue-500'
                        : 'bg-white border-slate-300 text-slate-950 focus:border-blue-500 shadow-sm'
                    }`}
                  />
                </div>

                {/* Email entry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-black block text-gray-900 dark:text-gray-100">
                      {t('contact_email')} *
                    </label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="name@domain.com"
                      style={{ unicodeBidi: 'plaintext' }}
                      className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none font-bold transition-all text-left ${
                        theme === 'dark'
                          ? 'bg-[#15171c] border-[#2d2f36] text-white focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-950 focus:border-blue-500 shadow-sm'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-black block text-gray-900 dark:text-gray-100">
                      {t('contact_subject')}
                    </label>
                    <input
                      type="text"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      placeholder={t('contact_subject_placeholder')}
                      className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none font-bold transition-all ${
                        theme === 'dark'
                          ? 'bg-[#15171c] border-[#2d2f36] text-white focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-950 focus:border-blue-500 shadow-sm'
                      }`}
                    />
                  </div>
                </div>

                {/* Message Entry */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black block text-gray-900 dark:text-gray-100">
                    {t('contact_message')} *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="..."
                    className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none font-bold transition-all h-32 ${
                      theme === 'dark'
                        ? 'bg-[#15171c] border-[#2d2f36] text-white focus:border-blue-500'
                        : 'bg-white border-slate-300 text-slate-950 focus:border-blue-500 shadow-sm'
                    }`}
                  />
                </div>

                {/* Button Submit client-side simulated */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl font-extrabold text-sm bg-[#2563eb] hover:bg-blue-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                      <span>{t('contact_send')}</span>
                    </>
                  )}
                </button>

              </form>

              <div className="text-center text-xs font-bold leading-relaxed px-4 text-gray-600 dark:text-gray-400">
                🛡️ <span>{t('contact_warning')}</span>
              </div>

            </div>
          } />
        </Routes>
      </main>

      {/* Footer copyright section with excessive safe padding at the bottom of the screen */}
      <footer className={`py-12 border-t text-center space-y-3 transition-colors shrink-0 pb-28 ${
        theme === 'dark' 
          ? 'bg-[#0c0d10] border-[#2d2f36]' 
          : 'bg-white border-slate-200'
      }`}>
        <p className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
          {t('footer_rights')} © 2026
        </p>
        <p className="text-2xs max-w-2xl mx-auto leading-relaxed px-4 text-gray-600 dark:text-gray-400">
          {t('footer_warning')}
        </p>
      </footer>

      {/* Sticky Bottom Navigation Bar (High contrast & heavily mobile friendly & PERSISTED across all routes) */}
      <nav className={`fixed bottom-0 inset-x-0 z-50 border-t backdrop-blur-md transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-[#0a0b0d]/95 border-[#2d2f36] text-white shadow-[0_-10px_30px_rgba(0,0,0,0.8)]'
          : 'bg-white/95 border-slate-200 text-slate-950 shadow-[0_-10px_30px_rgba(0,0,0,0.06)]'
      }`}>
        <div className="max-w-md mx-auto px-8 h-18 flex items-center justify-around">
          
          {/* Home Button Option */}
          <Link
            to="/"
            onClick={() => setContactSuccess(false)}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all w-20 h-full border-t-2 relative ${
              location.pathname === '/' || location.pathname.startsWith('/tools/')
                ? 'border-[#2563eb] text-[#2563eb] font-black'
                : 'border-transparent text-slate-400 hover:text-slate-800 dark:text-gray-500 dark:hover:text-white'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-wider">{t('home')}</span>
          </Link>

          {/* Pricing Button Option */}
          <Link
            to="/pricing"
            onClick={() => setContactSuccess(false)}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all w-20 h-full border-t-2 relative ${
              location.pathname === '/pricing'
                ? 'border-[#2563eb] text-[#2563eb] font-black'
                : 'border-transparent text-slate-400 hover:text-slate-800 dark:text-gray-500 dark:hover:text-white'
            }`}
          >
            <Star className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-wider">{t('pricing')}</span>
          </Link>

          {/* Contact Button Option */}
          <Link
            to="/contact"
            onClick={() => setContactSuccess(false)}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all w-20 h-full border-t-2 relative ${
              location.pathname === '/contact'
                ? 'border-[#2563eb] text-[#2563eb] font-black'
                : 'border-transparent text-slate-400 hover:text-slate-800 dark:text-gray-500 dark:hover:text-white'
            }`}
          >
            <Mail className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-wider">{t('contact_us')}</span>
          </Link>

        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

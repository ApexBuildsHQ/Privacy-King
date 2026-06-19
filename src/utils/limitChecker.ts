import { PLAN_LIMITS, MAX_FILE_SIZE_LIMITS } from '../config';
import { PlanTier } from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  maxSizeAllowed: number;
}

/**
 * Centrally validates file uploads and daily usage bounds according to the current plan tier
 * as stored in localStorage or passed down.
 */
export function validateLocalLimits(
  fileSize: number,
  currentCount: number,
  tier: PlanTier,
  lang: string = 'ar'
): ValidationResult {
  const dailyLimit = PLAN_LIMITS[tier];
  const maxSizeLimit = MAX_FILE_SIZE_LIMITS[tier];

  // Helper to format bytes cleanly for readable outputs
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = lang === 'ar' 
      ? ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت'] 
      : ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 1. Check daily count limits
  if (currentCount >= dailyLimit) {
    const errorMsg = lang === 'ar'
      ? `لقد تجوزت الحد اليومي الأقصى المسموح لخطة "${tier}" (${currentCount} من أصل ${dailyLimit === 999999 ? 'غير محدود' : dailyLimit}). الرجاء الترقية لفتح آفاق أوسع!`
      : `You have exceeded the daily limit for the "${tier}" plan (${currentCount} of ${dailyLimit === 999999 ? 'unlimited' : dailyLimit}). Please upgrade your plan for more!`;
    
    return {
      valid: false,
      error: errorMsg,
      maxSizeAllowed: maxSizeLimit,
    };
  }

  // 2. Check file size limits
  if (fileSize > maxSizeLimit) {
    const errorMsg = lang === 'ar'
      ? `حجم الملف كبير جداً (${formatBytes(fileSize)}). الحد الأقصى المسموح به لخطة "${tier}" هو ${formatBytes(maxSizeLimit)}.`
      : `File size is too large (${formatBytes(fileSize)}). The maximum size allowed under the "${tier}" plan is ${formatBytes(maxSizeLimit)}.`;
    
    return {
      valid: false,
      error: errorMsg,
      maxSizeAllowed: maxSizeLimit,
    };
  }

  return {
    valid: true,
    maxSizeAllowed: maxSizeLimit,
  };
}

/**
 * Easy helper to retrieve the stored tier from local storage at any time safely in any context.
 */
export function getStoredUserTier(): PlanTier {
  const saved = localStorage.getItem('pk_user_tier');
  return (saved as PlanTier) || 'free';
}

/**
 * Easy helper to retrieve daily count from local storage safely.
 */
export function getStoredDailyCount(): number {
  const saved = localStorage.getItem('pk_upload_count');
  return saved ? parseInt(saved, 10) : 0;
}

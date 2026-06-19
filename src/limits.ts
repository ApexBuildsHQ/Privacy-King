/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlanTier } from './types';
import { PLANS_DATA, getPlanById } from './plans';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  hasAds: boolean;
  hasWatermark: boolean;
  maxSizeAllowed: number;
}

/**
 * Centrally validates whether a file action is permitted under the current plan tier
 * 
 * @param fileSize Size of the file in bytes
 * @param currentDailyCount How many operations have been committed today
 * @param userTier The active subscription plan tier
 * @param lang Translation language code to return proper localized error message
 */
export function checkLocalLimits(
  fileSize: number,
  currentDailyCount: number,
  userTier: PlanTier,
  lang: string = 'ar'
): LimitCheckResult {
  const plan = getPlanById(userTier);

  // Utility to print file sizes nicely
  const prettyBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = lang === 'ar'
      ? ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت']
      : ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 1. Check daily operation count
  if (currentDailyCount >= plan.dailyLimit) {
    const reason = lang === 'ar'
      ? `لقد تجوزت الحد اليومي الأقصى لخطة "${langLabel(plan.id)}" (${currentDailyCount} من أصل ${plan.dailyLimit === 999999 ? 'غير محدود' : plan.dailyLimit} عمليات). الرجاء الترقية لمتابعة العمل بدون عوائق!`
      : `You have reached your daily operations limit on the "${plan.id}" plan (${currentDailyCount} of ${plan.dailyLimit === 999999 ? 'unlimited' : plan.dailyLimit}). Please upgrade your plan in our Pricing page.`;

    return {
      allowed: false,
      reason,
      hasAds: plan.hasAds,
      hasWatermark: plan.hasWatermark,
      maxSizeAllowed: plan.maxSize
    };
  }

  // 2. Check maximum uploading file size
  if (fileSize > plan.maxSize) {
    const reason = lang === 'ar'
      ? `حجم ملفك هو ${prettyBytes(fileSize)}، بينما يبلغ الحد الأقصى المسموح لخطة "${langLabel(plan.id)}" هو ${prettyBytes(plan.maxSize)}.`
      : `Your file size is ${prettyBytes(fileSize)}, but the maximum limit on the "${plan.id}" plan is ${prettyBytes(plan.maxSize)}.`;

    return {
      allowed: false,
      reason,
      hasAds: plan.hasAds,
      hasWatermark: plan.hasWatermark,
      maxSizeAllowed: plan.maxSize
    };
  }

  return {
    allowed: true,
    hasAds: plan.hasAds,
    hasWatermark: plan.hasWatermark,
    maxSizeAllowed: plan.maxSize
  };
}

// Simple internal helper to print labels in Arabic
function langLabel(tier: PlanTier): string {
  switch (tier) {
    case 'free': return 'المجانية';
    case 'pro': return 'Pro';
    case 'ultra': return 'Ultra';
    case 'advanced': return 'Advanced';
    default: return tier;
  }
}

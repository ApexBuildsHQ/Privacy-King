/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PlanTier } from '../types';
import { getPlanById } from '../plans';

export function useDailyLimit() {
  const [tier, setTier] = useState<PlanTier>(() => {
    const saved = localStorage.getItem('pk_user_tier');
    return (saved as PlanTier) || 'free';
  });

  const [dailyCount, setDailyCount] = useState<number>(0);
  const [todayStr, setTodayStr] = useState<string>('');

  useEffect(() => {
    // Generate simple date string (Y-M-D) using current time
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    setTodayStr(dateStr);

    const savedDate = localStorage.getItem('pk_upload_date');
    if (savedDate !== dateStr) {
      localStorage.setItem('pk_upload_date', dateStr);
      localStorage.setItem('pk_upload_count', '0');
      setDailyCount(0);
    } else {
      const savedCount = localStorage.getItem('pk_upload_count');
      setDailyCount(savedCount ? parseInt(savedCount, 10) : 0);
    }
  }, []);

  const updateTier = (newTier: PlanTier) => {
    setTier(newTier);
    localStorage.setItem('pk_user_tier', newTier);
  };

  const incrementCount = (): boolean => {
    const plan = getPlanById(tier);
    if (dailyCount >= plan.dailyLimit) {
      return false;
    }
    const newCount = dailyCount + 1;
    setDailyCount(newCount);
    localStorage.setItem('pk_upload_count', String(newCount));
    return true;
  };

  const getLimitInfo = () => {
    const plan = getPlanById(tier);
    return {
      limit: plan.dailyLimit,
      current: dailyCount,
      remaining: Math.max(0, plan.dailyLimit - dailyCount),
      isExceeded: dailyCount >= plan.dailyLimit,
      maxSize: plan.maxSize,
      tier,
    };
  };

  return {
    tier,
    updateTier,
    dailyCount,
    setDailyCount,
    incrementCount,
    getLimitInfo,
  };
}

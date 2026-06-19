/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlanTier } from './types';

export interface PlanDetails {
  id: PlanTier;
  nameKey: string;
  price: number;
  period: string;
  maxSize: number; // in bytes
  dailyLimit: number; // number of operations
  hasAds: boolean;
  hasWatermark: boolean;
  checkoutUrl: string;
  features: string[];
  featuresAr: string[];
}

export const PLANS_DATA: PlanDetails[] = [
  {
    id: 'free',
    nameKey: 'free_plan',
    price: 0,
    period: '/mo',
    maxSize: 10 * 1024 * 1024, // 10MB
    dailyLimit: 5,
    hasAds: true,
    hasWatermark: true,
    checkoutUrl: '#',
    features: [
      '10 MB Max File Size',
      '5 Daily Operations',
      'Includes Ads & System Watermark',
      '100% Client-Side Processing'
    ],
    featuresAr: [
      'حجم ملف أقصى 10 ميجابايت',
      '5 عمليات معالجة يومياً',
      'تتضمن إعلانات وعلامة مائية',
      'معالجة محلية 100% داخل المتصفح'
    ]
  },
  {
    id: 'pro',
    nameKey: 'pro_plan',
    price: 3,
    period: '/mo',
    maxSize: 50 * 1024 * 1024, // 50MB
    dailyLimit: 20,
    hasAds: false,
    hasWatermark: false,
    checkoutUrl: 'https://privacyking.lemonsqueezy.com/checkout/buy/pro-subscription-placeholder',
    features: [
      '50 MB Max File Size',
      '20 Daily Operations',
      'No Ads & No Watermarks',
      'High-speed local processing',
      'Priority support'
    ],
    featuresAr: [
      'حجم ملف أقصى 50 ميجابايت',
      '20 عملية معالجة يومياً',
      'خالٍ تماماً من الإعلانات والعلامات المائية',
      'معالجة محلية فائقة السرعة',
      'دعم فني ذو أولوية'
    ]
  },
  {
    id: 'ultra',
    nameKey: 'ultra_plan',
    price: 5,
    period: '/mo',
    maxSize: 250 * 1024 * 1024, // 250MB
    dailyLimit: 50,
    hasAds: false,
    hasWatermark: false,
    checkoutUrl: 'https://privacyking.lemonsqueezy.com/checkout/buy/ultra-subscription-placeholder',
    features: [
      '250 MB Max File Size',
      '50 Daily Operations',
      'No Ads & No Watermarks',
      'Max-speed localized processing',
      'Extended tools access'
    ],
    featuresAr: [
      'حجم ملف أقصى 250 ميجابايت',
      '50 عملية معالجة يومياً',
      'خالٍ تماماً من الإعلانات والعلامات المائية',
      'أقصى سرعة معالجة محلية متاحة',
      'وصول ممتد للأدوات الحساسة'
    ]
  },
  {
    id: 'advanced',
    nameKey: 'advanced_plan',
    price: 8,
    period: '/mo',
    maxSize: 1000 * 1024 * 1024, // 1000MB (1GB)
    dailyLimit: 999999, // Unlimited
    hasAds: false,
    hasWatermark: false,
    checkoutUrl: 'https://privacyking.lemonsqueezy.com/checkout/buy/advanced-subscription-placeholder',
    features: [
      '1000 MB (1 GB) Max File Size',
      'Unlimited operations / day',
      'No Ads & No Watermarks',
      'Unrestricted sandboxed pipeline',
      'Dedicated private channel support'
    ],
    featuresAr: [
      'حجم ملف أقصى 1000 ميجابايت (1 جيجابايت)',
      'عمليات معالجة ورفع غير محدودة',
      'خالٍ تماماً من الإعلانات والعلامات المائية',
      'خط معالجة خاص وغير مقيد بالذاكرة',
      'دعم مخصص عبر قنوات الخصوصية الفورية'
    ]
  }
];

export const getPlanById = (id: PlanTier): PlanDetails => {
  return PLANS_DATA.find(p => p.id === id) || PLANS_DATA[0];
};

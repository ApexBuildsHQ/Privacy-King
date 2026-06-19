/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlanTier } from './types';

export const PLAN_LIMITS: Record<PlanTier, number> = {
  free: 5,       // Max 5 uploads daily
  pro: 20,       // Max 20 uploads daily
  ultra: 50,      // Max 50 uploads daily
  advanced: 999999 // Unlimited uploads
};

export const MAX_FILE_SIZE_LIMITS: Record<PlanTier, number> = {
  free: 10 * 1024 * 1024,       // 10 MB
  pro: 50 * 1024 * 1024,        // 50 MB
  ultra: 250 * 1024 * 1024,     // 250 MB
  advanced: 1000 * 1024 * 1024  // 1000 MB (1 GB)
};

// 4 Sponsor / Redirect Links exactly
export const SPONSOR_LINKS = [
  'https://www.eff.org',           // Link 1: Electronic Frontier Foundation
  'https://www.privacytools.io',   // Link 2: Live privacy guide
  'https://duckduckgo.com',        // Link 3: Privacy search engine
  'https://proton.me'              // Link 4: Encrypted services
];

// Tool ID mapping to Sponsor Links - 4 links, 8 tools, each link gets exactly 2 tools
export const TOOL_REDIRECT_MAPPING: Record<string, string> = {
  'image-watermark': SPONSOR_LINKS[0], // Tool 1 -> Link 1
  'pdf-watermark': SPONSOR_LINKS[0],   // Tool 2 -> Link 1
  'file-crypt': SPONSOR_LINKS[1],      // Tool 3 -> Link 2
  'steganography': SPONSOR_LINKS[1],   // Tool 4 -> Link 2
  'metadata-clean': SPONSOR_LINKS[2],  // Tool 5 -> Link 3
  'password-meter': SPONSOR_LINKS[2],  // Tool 6 -> Link 3
  'text-crypt': SPONSOR_LINKS[3],      // Tool 7 -> Link 4
  'url-analyzer': SPONSOR_LINKS[3]     // Tool 8 -> Link 4
};

// Let's declare this in a cleaner, safer syntax:
export const getRedirectLink = (toolId: string): string => {
  switch (toolId) {
    case 'image-watermark':
    case 'pdf-watermark':
      return SPONSOR_LINKS[0]; // Link 1 handles tools 1 & 2
    case 'file-crypt':
    case 'steganography':
      return SPONSOR_LINKS[1]; // Link 2 handles tools 3 & 4
    case 'metadata-clean':
    case 'password-meter':
      return SPONSOR_LINKS[2]; // Link 3 handles tools 5 & 6
    case 'text-crypt':
    case 'url-analyzer':
      return SPONSOR_LINKS[3]; // Link 4 handles tools 7 & 8
    default:
      return SPONSOR_LINKS[0];
  }
};

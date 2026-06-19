/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PlanTier = 'free' | 'pro' | 'ultra' | 'advanced';

export interface PlanConfig {
  name: string;
  limit: number;
  label: string;
}

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  icon: string; // Type of Lucide icon
  category: 'files' | 'crypto' | 'security';
}

export interface ProcessedLog {
  id: string;
  fileName: string;
  toolId: string;
  timestamp: number;
}

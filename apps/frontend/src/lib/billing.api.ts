import { api } from './api';

export type TargetPlan = 'PRO' | 'ENTERPRISE';

export interface UpgradeRequestPayload {
  targetPlan: TargetPlan;
  reason?: string;
}

export const billingApi = {
  /**
   * Submit a plan upgrade request. Creates a HIGH-priority support case
   * visible to Clarbit SUPER_ADMINs in the admin panel. Server-side only.
   */
  submitUpgradeRequest: async (payload: UpgradeRequestPayload): Promise<void> => {
    await api.post('/auth/upgrade-request', payload);
  },
};

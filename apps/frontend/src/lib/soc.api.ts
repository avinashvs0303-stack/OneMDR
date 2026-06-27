import { api } from './api';

const BASE = '/soc';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SocDocument {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  authorId: string | null;
  authorName: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SocChange {
  id: string;
  tenantId: string;
  changeRef: string;
  title: string;
  description: string;
  changeType: 'STANDARD' | 'NORMAL' | 'EMERGENCY';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'IMPLEMENTING' | 'COMPLETED' | 'REJECTED';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  impact: string;
  rollbackPlan: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  requesterName: string | null;
  approverName: string | null;
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocServiceRequest {
  id: string;
  tenantId: string;
  requestRef: string;
  title: string;
  description: string;
  category: 'ACCESS' | 'TOOL' | 'REPORT' | 'TRAINING' | 'INTEGRATION' | 'OTHER';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'RESOLVED' | 'CANCELLED';
  requesterName: string | null;
  assigneeName: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocRosterShift {
  id: string;
  tenantId: string;
  weekStart: string;
  shiftType: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'GENERAL';
  dayOfWeek: number;
  analystId: string | null;
  analystName: string | null;
  startTime: string;
  endTime: string;
  isOncall: boolean;
  notes: string | null;
  createdAt: string;
}

export interface SocChannel {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  icon: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface SocMessage {
  id: string;
  channelId: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  messageType: 'TEXT' | 'ALERT' | 'SYSTEM' | 'FILE';
  isDeleted: boolean;
  editedAt: string | null;
  createdAt: string;
}

// ── Documents ─────────────────────────────────────────────────────────────────

export const listDocuments = (category?: string): Promise<SocDocument[]> => {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  return api.get(`${BASE}/docs${q}`);
};

export const getDocument = (id: string): Promise<SocDocument> => api.get(`${BASE}/docs/${id}`);

export const createDocument = (data: {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}): Promise<SocDocument> => api.post(`${BASE}/docs`, data);

export const updateDocument = (
  id: string,
  data: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    isPinned?: boolean;
  },
): Promise<SocDocument> => api.patch(`${BASE}/docs/${id}`, data);

export const deleteDocument = (id: string): Promise<void> => api.delete(`${BASE}/docs/${id}`);

// ── Change Management ─────────────────────────────────────────────────────────

export const listChanges = (status?: string): Promise<SocChange[]> => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get(`${BASE}/changes${q}`);
};

export const createChange = (data: {
  title: string;
  description?: string;
  changeType?: string;
  priority?: string;
  riskLevel?: string;
  impact?: string;
  rollbackPlan?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}): Promise<SocChange> => api.post(`${BASE}/changes`, data);

export const updateChangeStatus = (
  id: string,
  data: {
    status: string;
    rejectionNote?: string;
    approverName?: string;
  },
): Promise<SocChange> => api.patch(`${BASE}/changes/${id}/status`, data);

// ── Service Requests ──────────────────────────────────────────────────────────

export const listRequests = (status?: string): Promise<SocServiceRequest[]> => {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get(`${BASE}/requests${q}`);
};

export const createRequest = (data: {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
}): Promise<SocServiceRequest> => api.post(`${BASE}/requests`, data);

export const updateRequestStatus = (
  id: string,
  data: {
    status: string;
    assigneeName?: string;
    resolutionNote?: string;
  },
): Promise<SocServiceRequest> => api.patch(`${BASE}/requests/${id}/status`, data);

// ── Roster ────────────────────────────────────────────────────────────────────

export const getRosterShifts = (weekStart: string): Promise<SocRosterShift[]> =>
  api.get(`${BASE}/roster?weekStart=${encodeURIComponent(weekStart)}`);

export const upsertShift = (data: {
  weekStart: string;
  shiftType: string;
  dayOfWeek: number;
  analystId?: string;
  analystName?: string;
  isOncall?: boolean;
  notes?: string;
}): Promise<SocRosterShift> => api.post(`${BASE}/roster/shift`, data);

export const clearShift = (id: string): Promise<void> => api.delete(`${BASE}/roster/shift/${id}`);

// ── Channels ──────────────────────────────────────────────────────────────────

export const listChannels = (): Promise<SocChannel[]> => api.get(`${BASE}/channels`);

export const createChannel = (data: {
  name: string;
  description?: string;
  isPrivate?: boolean;
}): Promise<SocChannel> => api.post(`${BASE}/channels`, data);

// ── Messages ──────────────────────────────────────────────────────────────────

export const getMessages = (channelId: string, cursor?: string): Promise<SocMessage[]> => {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return api.get(`${BASE}/channels/${channelId}/messages${q}`);
};

export const sendMessage = (
  channelId: string,
  content: string,
  messageType = 'TEXT',
): Promise<SocMessage> =>
  api.post(`${BASE}/channels/${channelId}/messages`, { content, messageType });

export const deleteMessage = (channelId: string, messageId: string): Promise<void> =>
  api.delete(`${BASE}/channels/${channelId}/messages/${messageId}`);

// ── Incidents ─────────────────────────────────────────────────────────────────

export interface SocIncident {
  id: string;
  tenantId: string;
  incidentRef: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  slaBreached: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listIncidents = (status?: string, severity?: string): Promise<SocIncident[]> => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (severity) params.set('severity', severity);
  const q = params.toString();
  return api.get(`${BASE}/incidents${q ? `?${q}` : ''}`);
};

export const createIncident = (data: {
  severity?: string;
  title: string;
  description?: string;
  assigneeName?: string;
}): Promise<SocIncident> => api.post(`${BASE}/incidents`, data);

export const updateIncidentStatus = (
  id: string,
  data: { status: string; assigneeName?: string; slaBreached?: boolean },
): Promise<SocIncident> => api.patch(`${BASE}/incidents/${id}/status`, data);

export const deleteIncident = (id: string): Promise<void> => api.delete(`${BASE}/incidents/${id}`);

// ── Service Request: Delete ───────────────────────────────────────────────────

export const deleteRequest = (id: string): Promise<void> => api.delete(`${BASE}/requests/${id}`);

// ── Permission Groups ─────────────────────────────────────────────────────────

export interface GroupMember {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export interface PermissionGroup {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  color: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  memberships: GroupMember[];
}

export const listGroups = (): Promise<PermissionGroup[]> => api.get(`${BASE}/groups`);

export const createGroup = (data: {
  name: string;
  description?: string;
  color?: string;
  permissions?: string[];
}): Promise<PermissionGroup> => api.post(`${BASE}/groups`, data);

export const updateGroup = (
  id: string,
  data: { name?: string; description?: string; color?: string; permissions?: string[] },
): Promise<PermissionGroup> => api.patch(`${BASE}/groups/${id}`, data);

export const deleteGroup = (id: string): Promise<void> => api.delete(`${BASE}/groups/${id}`);

export const addGroupMember = (groupId: string, userId: string): Promise<void> =>
  api.post(`${BASE}/groups/${groupId}/members`, { userId });

export const removeGroupMember = (groupId: string, userId: string): Promise<void> =>
  api.delete(`${BASE}/groups/${groupId}/members/${userId}`);

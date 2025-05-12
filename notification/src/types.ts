// notification/src/types.ts

// Notification request body structure
export interface NotificationRequest {
  type: string;
  userId: number | string;
  data: Record<string, any>;
}

// Email notification structure
export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

// Database schema for notifications table
export interface NotificationRecord {
  id: number;
  user_id: number | string;
  type: string;
  status: 'pending' | 'sent' | 'failed';
  metadata: string; // JSON string
  created_at: string;
}

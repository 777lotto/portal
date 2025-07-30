// worker/src/handlers/admin/drafts.ts
import { Context as HonoContext } from 'hono';
import { AppEnv as WorkerAppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Job } from '@portal/shared';

interface DraftJob extends Job {
  customerName: string;
}

export const handleGetDrafts = async (c: HonoContext<WorkerAppEnv>) => {
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT j.*, u.name as customerName
             FROM jobs j
             JOIN users u ON j.user_id = u.id
             WHERE j.status IN ('quote_draft', 'invoice_draft')
             ORDER BY j.updatedAt DESC`
        ).all<DraftJob>();

        const drafts = dbResponse?.results || [];
        return successResponse(drafts);
    } catch (e: any) {
        console.error("Failed to retrieve drafts:", e);
        return errorResponse("Failed to retrieve drafts", 500);
    }
};

import app from './server.js';
import { handleScheduled } from './cron/cron.js';

export default {
	fetch: app.fetch,
	scheduled: handleScheduled,
};
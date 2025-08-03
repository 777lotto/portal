import { sqliteTable, AnySQLiteColumn, check, integer, text, numeric, index, foreignKey } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const d1Migrations = sqliteTable("d1_migrations", {
	id: integer().primaryKey({ autoIncrement: true }),
	name: text(),
	appliedAt: numeric("applied_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
},
(table) => [
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const users = sqliteTable("users", {
	id: integer().primaryKey({ autoIncrement: true }),
	email: text(),
	name: text().notNull(),
	passwordHash: text("password_hash"),
	stripeCustomerId: text("stripe_customer_id"),
	phone: text(),
	role: text().default("customer").notNull(),
	address: text(),
	companyName: text("company_name"),
	emailNotificationsEnabled: integer("email_notifications_enabled").default(1).notNull(),
	smsNotificationsEnabled: integer("sms_notifications_enabled").default(1).notNull(),
	preferredContactMethod: text("preferred_contact_method").default("email"),
	calendarRemindersEnabled: integer("calendar_reminders_enabled").default(1).notNull(),
	calendarReminderMinutes: integer("calendar_reminder_minutes").default(60).notNull(),
},
(table) => [
	index("idx_users_phone").on(table.phone),
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const jobs = sqliteTable("jobs", {
	id: text().primaryKey(),
	userId: text("user_id").notNull(),
	title: text().notNull(),
	description: text(),
	status: text().notNull(),
	recurrence: text().notNull(),
	createdAt: text().default("sql`(datetime('now'))`").notNull(),
	updatedAt: text().default("sql`(datetime('now'))`").notNull(),
	stripeInvoiceId: text("stripe_invoice_id"),
	stripeQuoteId: text("stripe_quote_id"),
	totalAmountCents: integer("total_amount_cents"),
	due: text(),
},
(table) => [
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const lineItems = sqliteTable("line_items", {
	id: integer().primaryKey({ autoIncrement: true }),
	jobId: text("job_id").references(() => jobs.id, { onDelete: "cascade" } ),
	description: text(),
	unitTotalAmountCents: integer("unit_total_amount_cents"),
	quantity: integer().default(1).notNull(),
},
(table) => [
	index("idx_line_items_job_id").on(table.jobId),
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const photos = sqliteTable("photos", {
	id: text().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id),
	invoiceId: text("invoice_id"),
	itemId: integer("item_id").references(() => lineItems.id),
	jobId: text("job_id").references(() => jobs.id),
	url: text().notNull(),
	createdAt: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const notifications = sqliteTable("notifications", {
	id: integer().primaryKey({ autoIncrement: true }),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	type: text().notNull(),
	message: text().notNull(),
	link: text(),
	isRead: integer("is_read").default(0).notNull(),
	channels: text(),
	status: text().notNull(),
	metadata: text(),
	pushSubscriptionJson: text("push_subscription_json"),
	createdAt: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	index("idx_notifications_user_id").on(table.userId),
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const jobRecurrenceRequests = sqliteTable("job_recurrence_requests", {
	id: integer().primaryKey({ autoIncrement: true }),
	jobId: text("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" } ),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	frequency: integer().notNull(),
	requestedDay: integer("requested_day"),
	status: text().default("pending").notNull(),
	createdAt: text().default("sql`(datetime('now'))`").notNull(),
	updatedAt: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	index("idx_job_recurrence_requests_status").on(table.status),
	index("idx_job_recurrence_requests_job_id").on(table.jobId),
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
	id: integer().primaryKey({ autoIncrement: true }),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text().notNull(),
	due: text().notNull(),
	createdAt: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const calendarTokens = sqliteTable("calendar_tokens", {
	token: text().primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	index("idx_calendar_tokens_user_id").on(table.userId),
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const notes = sqliteTable("notes", {
	id: integer().primaryKey({ autoIncrement: true }),
	userId: integer("user_id").notNull().references(() => users.id),
	photoId: text("photo_id").references(() => photos.id),
	itemId: integer("item_id").references(() => lineItems.id),
	jobId: text("job_id").references(() => jobs.id),
	content: text().notNull(),
	createdAt: text().default("sql`(datetime('now'))`").notNull(),
	updatedAt: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);

export const calendarEvents = sqliteTable("calendar_events", {
	id: integer().primaryKey({ autoIncrement: true }),
	title: text().notNull(),
	start: text().notNull(),
	end: text().notNull(),
	type: text().notNull(),
	jobId: text("job_id").references(() => jobs.id),
	userId: integer("user_id").references(() => users.id),
	createdAt: text().default("sql`(datetime('now'))`").notNull(),
},
(table) => [
	check("users_check_1", sql`preferred_contact_method IN ('email', 'sms'`),
	check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed'`),
	check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered'`),
	check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal'`),
]);


import { sqliteTable, AnySQLiteColumn, check, integer, text, numeric, index, foreignKey } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const d1Migrations = sqliteTable("d1_migrations", {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name'),
	appliedAt: numeric('applied_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const users = sqliteTable("users", {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email'),
	name: text('name').notNull(),
	passwordHash: text("password_hash"),
	stripeCustomerId: text("stripe_customer_id"),
	phone: text('phone'),
	role: text('role').default("customer").notNull(),
	address: text('address'),
	companyName: text("company_name"),
	emailNotificationsEnabled: integer("email_notifications_enabled").default(1).notNull(),
	smsNotificationsEnabled: integer("sms_notifications_enabled").default(1).notNull(),
	preferredContactMethod: text("preferred_contact_method").default("email"),
	calendarRemindersEnabled: integer("calendar_reminders_enabled").default(1).notNull(),
	calendarReminderMinutes: integer("calendar_reminder_minutes").default(60).notNull(),
},
(table) => ({
	phoneIdx: index("idx_users_phone").on(table.phone),
	roleCheck: check("users_check_1", sql`role IN ('admin', 'customer', 'associate', 'guest')`),
	preferredContactMethodCheck: check("users_check_1", sql`preferred_contact_method IN ('email', 'sms')`),
}));

export const jobs = sqliteTable("jobs", {
	id: text('id').primaryKey(),
	userId: text("user_id").notNull(),
	title: text('title').notNull(),
	description: text('description'),
	status: text('status').notNull(),
	recurrence: text('recurrence').notNull(),
	createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
	updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
	stripeInvoiceId: text("stripe_invoice_id"),
	stripeQuoteId: text("stripe_quote_id"),
	totalAmountCents: integer("total_amount_cents"),
	due: text('due'),
});

export const lineItems = sqliteTable("line_items", {
	id: integer('id').primaryKey({ autoIncrement: true }),
	jobId: text("job_id").references(() => jobs.id, { onDelete: "cascade" } ),
	description: text('description'),
	unitTotalAmountCents: integer("unit_total_amount_cents"),
	quantity: integer('quantity').default(1).notNull(),
},
(table) => ({
	jobIdIdx: index("idx_line_items_job_id").on(table.jobId),
}));

export const photos = sqliteTable("photos", {
	id: text('id').primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id),
	invoiceId: text("invoice_id"),
	itemId: integer("item_id").references(() => lineItems.id),
	jobId: text("job_id").references(() => jobs.id),
	url: text('url').notNull(),
	createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const notifications = sqliteTable("notifications", {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	type: text('type').notNull(),
	message: text('message').notNull(),
	link: text('link'),
	isRead: integer("is_read").default(0).notNull(),
	channels: text('channels'),
	status: text('status').notNull(),
	metadata: text('metadata'),
	pushSubscriptionJson: text("push_subscription_json"),
	createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => ({
	userIdIdx: index("idx_notifications_user_id").on(table.userId),
	statusCheck: check("notifications_check_2", sql`status IN ('pending', 'sent', 'failed')`),
}));

export const jobRecurrenceRequests = sqliteTable("job_recurrence_requests", {
	id: integer('id').primaryKey({ autoIncrement: true }),
	jobId: text("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" } ),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	frequency: integer('frequency').notNull(),
	requestedDay: integer("requested_day"),
	status: text('status').default("pending").notNull(),
	createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
	updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => ({
	statusIdx: index("idx_job_recurrence_requests_status").on(table.status),
	jobIdIdx: index("idx_job_recurrence_requests_job_id").on(table.jobId),
	statusCheck: check("job_recurrence_requests_check_3", sql`status IN ('pending', 'accepted', 'declined', 'countered')`),
}));

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text('token').notNull(),
	due: text('due').notNull(),
	createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export const calendarTokens = sqliteTable("calendar_tokens", {
	token: text('token').primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => ({
	userIdIdx: index("idx_calendar_tokens_user_id").on(table.userId),
}));

export const notes = sqliteTable("notes", {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer("user_id").notNull().references(() => users.id),
	photoId: text("photo_id").references(() => photos.id),
	itemId: integer("item_id").references(() => lineItems.id),
	jobId: text("job_id").references(() => jobs.id),
	content: text('content').notNull(),
	createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
	updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export const calendarEvents = sqliteTable("calendar_events", {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	start: text('start').notNull(),
	end: text('end').notNull(),
	type: text('type').notNull(),
	jobId: text("job_id").references(() => jobs.id),
	userId: integer("user_id").references(() => users.id),
	createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => ({
	typeCheck: check("calendar_events_check_4", sql`type IN ('job', 'blocked', 'personal')`),
}));

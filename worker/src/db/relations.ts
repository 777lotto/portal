
import { relations, type Relation } from "drizzle-orm/relations";
import { jobs, lineItems, photos, users, notifications, jobRecurrenceRequests, passwordResetTokens, calendarTokens, notes, calendarEvents } from "./schema.js";

export const lineItemsRelations = relations(lineItems, ({one, many}) => ({
	job: one(jobs, {
		fields: [lineItems.jobId],
		references: [jobs.id]
	}),
	photos: many(photos),
	notes: many(notes),
}));

export const jobsRelations = relations(jobs, ({one, many}) => ({
	lineItems: many(lineItems),
	photos: many(photos),
	jobRecurrenceRequests: many(jobRecurrenceRequests),
	notes: many(notes),
	calendarEvents: many(calendarEvents),
    user: one(users, {
        fields: [jobs.userId],
        references: [users.id]
    }),
}));

export const photosRelations = relations(photos, ({one, many}) => ({
	job: one(jobs, {
		fields: [photos.jobId],
		references: [jobs.id]
	}),
	lineItem: one(lineItems, {
		fields: [photos.itemId],
		references: [lineItems.id]
	}),
	user: one(users, {
		fields: [photos.userId],
		references: [users.id]
	}),
	notes: many(notes),
}));

export const usersRelations = relations(users, ({many}) => ({
    jobs: many(jobs),
	photos: many(photos),
	notifications: many(notifications),
	jobRecurrenceRequests: many(jobRecurrenceRequests),
	passwordResetTokens: many(passwordResetTokens),
	calendarTokens: many(calendarTokens),
	notes: many(notes),
	calendarEvents: many(calendarEvents),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const jobRecurrenceRequestsRelations = relations(jobRecurrenceRequests, ({one}) => ({
	user: one(users, {
		fields: [jobRecurrenceRequests.userId],
		references: [users.id]
	}),
	job: one(jobs, {
		fields: [jobRecurrenceRequests.jobId],
		references: [jobs.id]
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));

export const calendarTokensRelations = relations(calendarTokens, ({one}) => ({
	user: one(users, {
		fields: [calendarTokens.userId],
		references: [users.id]
	}),
}));

export const notesRelations = relations(notes, ({one}) => ({
	job: one(jobs, {
		fields: [notes.jobId],
		references: [jobs.id]
	}),
	lineItem: one(lineItems, {
		fields: [notes.itemId],
		references: [lineItems.id]
	}),
	photo: one(photos, {
		fields: [notes.photoId],
		references: [photos.id]
	}),
	user: one(users, {
		fields: [notes.userId],
		references: [users.id]
	}),
}));

export const calendarEventsRelations = relations(calendarEvents, ({one}) => ({
	job: one(jobs, {
		fields: [calendarEvents.jobId],
		references: [jobs.id]
	}),
	user: one(users, {
		fields: [calendarEvents.userId],
		references: [users.id]
	}),
}));




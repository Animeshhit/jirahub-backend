import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------------------------- ENUMS ---------------------------- */

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "in_review",
  "done",
]);

/* ---------------------------- USERS ---------------------------- */

export const users = pgTable(
  "users",
  {
    _id: serial("_id").primaryKey(),
    id: uuid("id").defaultRandom().notNull().unique(),
    name: varchar("name", { length: 256 }).notNull(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
  },
  (table) => [
    // speeds up login lookups (unique() above already creates an index,
    // but explicit for clarity if you drop the unique constraint later)
    index("users_email_idx").on(table.email),
  ]
);

/* -------------------------- WORKSPACE --------------------------- */

export const workspace = pgTable(
  "workspace",
  {
    _id: serial("_id").primaryKey(),
    id: uuid("id").defaultRandom().notNull().unique(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdOn: timestamp("created_on").defaultNow().notNull(),
  },
  (table) => [
    index("workspace_created_by_idx").on(table.createdBy),
  ]
);

// join table for workspace.peoples : list[users]  (many-to-many)
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    _id: serial("_id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedOn: timestamp("joined_on").defaultNow().notNull(),
  },
  (table) => [
    index("workspace_members_workspace_id_idx").on(table.workspaceId),
    index("workspace_members_user_id_idx").on(table.userId),
    // prevent duplicate memberships + speeds up "is user X in workspace Y" checks
    uniqueIndex("workspace_members_unique_idx").on(
      table.workspaceId,
      table.userId
    ),
  ]
);

/* ---------------------------- BOARD ------------------------------ */

export const board = pgTable(
  "board",
  {
    _id: serial("_id").primaryKey(),
    id: uuid("id").defaultRandom().notNull().unique(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("board_workspace_id_idx").on(table.workspaceId),
    index("board_created_by_idx").on(table.createdBy),
  ]
);

/* ---------------------------- TASKS ------------------------------ */

export const tasks = pgTable(
  "tasks",
  {
    _id: serial("_id").primaryKey(),
    id: uuid("id").defaultRandom().notNull().unique(),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: taskStatusEnum("status").default("todo").notNull(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("tasks_reporter_id_idx").on(table.reporterId),
    index("tasks_assignee_id_idx").on(table.assigneeId),
    index("tasks_board_id_idx").on(table.boardId),
    index("tasks_workspace_id_idx").on(table.workspaceId),
    index("tasks_status_idx").on(table.status),
    // common query pattern: "all tasks on this board with this status"
    // (e.g. kanban column view)
    index("tasks_board_id_status_idx").on(table.boardId, table.status),
  ]
);

/* --------------------------- INVITES ------------------------------ */

export const invites = pgTable(
  "invites",
  {
    _id: serial("_id").primaryKey(),
    id: uuid("id").defaultRandom().notNull().unique(),
    inviteFrom: uuid("invite_from")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteForWorkspace: uuid("invite_for_workspace")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    inviteTo: uuid("invite_to")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteAccepted: boolean("invite_accepted").default(false).notNull(),
  },
  (table) => [
    index("invites_invite_from_idx").on(table.inviteFrom),
    index("invites_invite_for_workspace_idx").on(table.inviteForWorkspace),
    // most common lookup: "pending invites for this user"
    index("invites_invite_to_idx").on(table.inviteTo),
    index("invites_invite_to_accepted_idx").on(
      table.inviteTo,
      table.inviteAccepted
    ),
  ]
);

/* ---------------------------- RELATIONS ---------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  workspacesCreated: many(workspace),
  workspaceMemberships: many(workspaceMembers),
  boardsCreated: many(board),
  reportedTasks: many(tasks, { relationName: "reporter" }),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  invitesSent: many(invites, { relationName: "inviteFrom" }),
  invitesReceived: many(invites, { relationName: "inviteTo" }),
}));

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
  creator: one(users, {
    fields: [workspace.createdBy],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  boards: many(board),
  tasks: many(tasks),
  invites: many(invites),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [workspaceMembers.workspaceId],
      references: [workspace.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  })
);

export const boardRelations = relations(board, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [board.workspaceId],
    references: [workspace.id],
  }),
  admin: one(users, {
    fields: [board.createdBy],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  board: one(board, {
    fields: [tasks.boardId],
    references: [board.id],
  }),
  workspace: one(workspace, {
    fields: [tasks.workspaceId],
    references: [workspace.id],
  }),
  reporter: one(users, {
    fields: [tasks.reporterId],
    references: [users.id],
    relationName: "reporter",
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  workspace: one(workspace, {
    fields: [invites.inviteForWorkspace],
    references: [workspace.id],
  }),
  from: one(users, {
    fields: [invites.inviteFrom],
    references: [users.id],
    relationName: "inviteFrom",
  }),
  to: one(users, {
    fields: [invites.inviteTo],
    references: [users.id],
    relationName: "inviteTo",
  }),
}));
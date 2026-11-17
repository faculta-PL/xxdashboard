-- Nazix PostgreSQL source of truth (0001_init).
-- The Vite app keeps Firestore and local storage until DATABASE_URL is set.
-- npm run build does not apply this file and does not generate a Prisma client.
--
-- Removing a workspace_members row does not delete the workspace.
-- workspace_members.workspace_id -> workspaces ON DELETE CASCADE runs only when the workspace is deleted.
-- workspace_members.user_id -> users ON DELETE CASCADE removes the membership and leaves the workspace.
-- workspaces.created_by_id -> users ON DELETE SET NULL, so deleting the creator keeps the workspace.
-- Author and lead foreign keys use ON DELETE SET NULL, so removing a member keeps notes, ideas, and projects.

-- CreateEnum
CREATE TYPE "workspace_role" AS ENUM ('owner', 'admin', 'member', 'guest');

-- CreateEnum
CREATE TYPE "group_role" AS ENUM ('lead', 'admin', 'member', 'observer');

-- CreateEnum
CREATE TYPE "project_role" AS ENUM ('lead', 'member', 'guest');

-- CreateEnum
CREATE TYPE "group_visibility" AS ENUM ('private', 'workspace');

-- CreateEnum
CREATE TYPE "visibility" AS ENUM ('private', 'shared', 'workspace', 'public');

-- CreateEnum
CREATE TYPE "share_permission" AS ENUM ('read', 'edit');

-- CreateEnum
CREATE TYPE "invite_status" AS ENUM ('pending', 'accepted', 'declined', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "conversation_kind" AS ENUM ('direct', 'group');

-- CreateEnum
CREATE TYPE "participant_status" AS ENUM ('invited', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "billing_interval" AS ENUM ('month', 'year', 'custom');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "avatar_url" TEXT,
    "email_verified_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "time_zone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "notify_email" BOOLEAN NOT NULL DEFAULT true,
    "notify_push" BOOLEAN NOT NULL DEFAULT false,
    "extras" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "workspace_role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "group_visibility" NOT NULL DEFAULT 'private',
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "role" "group_role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "workspace_role" NOT NULL DEFAULT 'member',
    "token_hash" TEXT NOT NULL,
    "status" "invite_status" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6),
    "uses" INTEGER NOT NULL DEFAULT 0,
    "max_uses" INTEGER,
    "invited_by_id" TEXT,
    "accepted_by_id" TEXT,
    "group_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lead_id" TEXT,
    "created_by_id" TEXT,
    "visibility" "visibility" NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "role" "project_role" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT,
    "parent_id" TEXT,
    "author_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "visibility" "visibility" NOT NULL DEFAULT 'private',
    "important" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT,
    "author_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "position" INTEGER NOT NULL DEFAULT 0,
    "visibility" "visibility" NOT NULL DEFAULT 'private',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_shares" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "permission" "share_permission" NOT NULL DEFAULT 'read',
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "group_id" TEXT,
    "kind" "conversation_kind" NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT,
    "created_by_id" TEXT,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "visibility" "visibility" NOT NULL DEFAULT 'workspace',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "status" "participant_status" NOT NULL DEFAULT 'invited',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "interval" "billing_interval" NOT NULL,
    "limits" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "billing_user_id" TEXT,
    "status" "subscription_status" NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6),
    "cancel_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "number" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "status" "invoice_status" NOT NULL DEFAULT 'open',
    "issued_at" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "subscription_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "status" "transaction_status" NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT '',
    "provider_ref" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "read_at" TIMESTAMPTZ(6),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_created_by_id_idx" ON "workspaces"("created_by_id");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "groups_workspace_id_idx" ON "groups"("workspace_id");

-- CreateIndex
CREATE INDEX "groups_created_by_id_idx" ON "groups"("created_by_id");

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE INDEX "group_members_workspace_id_idx" ON "group_members"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");

-- CreateIndex
CREATE INDEX "invitations_workspace_id_idx" ON "invitations"("workspace_id");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_invited_by_id_idx" ON "invitations"("invited_by_id");

-- CreateIndex
CREATE INDEX "invitations_accepted_by_id_idx" ON "invitations"("accepted_by_id");

-- CreateIndex
CREATE INDEX "invitations_group_id_idx" ON "invitations"("group_id");

-- CreateIndex
CREATE INDEX "invitations_status_idx" ON "invitations"("status");

-- CreateIndex
CREATE INDEX "projects_workspace_id_idx" ON "projects"("workspace_id");

-- CreateIndex
CREATE INDEX "projects_lead_id_idx" ON "projects"("lead_id");

-- CreateIndex
CREATE INDEX "projects_created_by_id_idx" ON "projects"("created_by_id");

-- CreateIndex
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "project_members_workspace_id_idx" ON "project_members"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "notes_workspace_id_idx" ON "notes"("workspace_id");

-- CreateIndex
CREATE INDEX "notes_project_id_idx" ON "notes"("project_id");

-- CreateIndex
CREATE INDEX "notes_parent_id_idx" ON "notes"("parent_id");

-- CreateIndex
CREATE INDEX "notes_author_id_idx" ON "notes"("author_id");

-- CreateIndex
CREATE INDEX "ideas_workspace_id_idx" ON "ideas"("workspace_id");

-- CreateIndex
CREATE INDEX "ideas_project_id_idx" ON "ideas"("project_id");

-- CreateIndex
CREATE INDEX "ideas_author_id_idx" ON "ideas"("author_id");

-- CreateIndex
CREATE INDEX "ideas_workspace_id_status_idx" ON "ideas"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "note_shares_note_id_idx" ON "note_shares"("note_id");

-- CreateIndex
CREATE INDEX "note_shares_user_id_idx" ON "note_shares"("user_id");

-- CreateIndex
CREATE INDEX "note_shares_workspace_id_idx" ON "note_shares"("workspace_id");

-- CreateIndex
CREATE INDEX "note_shares_created_by_id_idx" ON "note_shares"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "note_shares_note_id_user_id_key" ON "note_shares"("note_id", "user_id");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_idx" ON "conversations"("workspace_id");

-- CreateIndex
CREATE INDEX "conversations_group_id_idx" ON "conversations"("group_id");

-- CreateIndex
CREATE INDEX "conversations_created_by_id_idx" ON "conversations"("created_by_id");

-- CreateIndex
CREATE INDEX "conversation_members_conversation_id_idx" ON "conversation_members"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members"("user_id");

-- CreateIndex
CREATE INDEX "conversation_members_workspace_id_idx" ON "conversation_members"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_members_conversation_id_user_id_key" ON "conversation_members"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_workspace_id_idx" ON "messages"("workspace_id");

-- CreateIndex
CREATE INDEX "messages_author_id_idx" ON "messages"("author_id");

-- CreateIndex
CREATE INDEX "events_workspace_id_idx" ON "events"("workspace_id");

-- CreateIndex
CREATE INDEX "events_project_id_idx" ON "events"("project_id");

-- CreateIndex
CREATE INDEX "events_created_by_id_idx" ON "events"("created_by_id");

-- CreateIndex
CREATE INDEX "events_starts_at_idx" ON "events"("starts_at");

-- CreateIndex
CREATE INDEX "event_participants_event_id_idx" ON "event_participants"("event_id");

-- CreateIndex
CREATE INDEX "event_participants_user_id_idx" ON "event_participants"("user_id");

-- CreateIndex
CREATE INDEX "event_participants_workspace_id_idx" ON "event_participants"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_event_id_user_id_key" ON "event_participants"("event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "plan_features_plan_id_idx" ON "plan_features"("plan_id");

-- CreateIndex
CREATE INDEX "plan_features_feature_key_idx" ON "plan_features"("feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_plan_id_feature_key_key" ON "plan_features"("plan_id", "feature_key");

-- CreateIndex
CREATE INDEX "subscriptions_workspace_id_idx" ON "subscriptions"("workspace_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_billing_user_id_idx" ON "subscriptions"("billing_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_idx" ON "invoices"("workspace_id");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "transactions_workspace_id_idx" ON "transactions"("workspace_id");

-- CreateIndex
CREATE INDEX "transactions_invoice_id_idx" ON "transactions"("invoice_id");

-- CreateIndex
CREATE INDEX "transactions_subscription_id_idx" ON "transactions"("subscription_id");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_idx" ON "notifications"("workspace_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_idx" ON "audit_logs"("workspace_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_shares" ADD CONSTRAINT "note_shares_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_shares" ADD CONSTRAINT "note_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_shares" ADD CONSTRAINT "note_shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_shares" ADD CONSTRAINT "note_shares_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billing_user_id_fkey" FOREIGN KEY ("billing_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity that Prisma models cannot express directly.
ALTER TABLE "users" ADD CONSTRAINT "users_handle_format" CHECK ("handle" ~ '^[a-z0-9_]{3,20}$');

ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_slug_format" CHECK (
  "slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length("slug") BETWEEN 2 AND 48
);

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_token_hash_sha256" CHECK (
  char_length("token_hash") = 64 AND "token_hash" ~ '^[0-9a-f]{64}$'
);

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_uses_bounds" CHECK (
  "uses" >= 0 AND ("max_uses" IS NULL OR "max_uses" >= 1)
);

ALTER TABLE "plans" ADD CONSTRAINT "plans_price_nonnegative" CHECK ("price_cents" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_nonnegative" CHECK ("amount_cents" >= 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_nonnegative" CHECK ("amount_cents" >= 0);

-- One owner membership per workspace. Deleting that row does not delete the workspace.
CREATE UNIQUE INDEX "workspace_members_one_owner" ON "workspace_members" ("workspace_id") WHERE "role" = 'owner';

-- A workspace can have one pending invite per email.
CREATE UNIQUE INDEX "invitations_one_pending_email" ON "invitations" ("workspace_id", lower("email")) WHERE "status" = 'pending';

CREATE OR REPLACE FUNCTION nazix_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'users',
    'user_settings',
    'workspaces',
    'groups',
    'invitations',
    'projects',
    'notes',
    'ideas',
    'conversations',
    'events',
    'subscriptions'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION nazix_set_updated_at()',
      target || '_set_updated_at',
      target
    );
  END LOOP;
END;
$$;

-- Seed plans and plan_features from src/platform/plans.js (PLAN_SEED).
-- Limits are stored on plans.limits. Feature keys are stored on plan_features.
-- -1 means unlimited. fileBytes is 20971520 on every plan (20 MB product cap).
INSERT INTO "plans" ("id", "code", "name", "description", "price_cents", "currency", "interval", "limits", "active") VALUES ('plan_free', 'free', 'Free', 'Solo workspace on this device. No payment.', 0, 'EUR', 'month'::"billing_interval", '{"workspaces":1,"members":1,"guests":0,"projects":10,"notes":500,"ideas":500,"groups":1,"storageBytes":104857600,"fileBytes":20971520}'::jsonb, true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_notes', 'plan_free', 'notes', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_ideas', 'plan_free', 'ideas', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_projects', 'plan_free', 'projects', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_calendar', 'plan_free', 'calendar', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_files', 'plan_free', 'files', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_export', 'plan_free', 'export', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_games', 'plan_free', 'games', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_search', 'plan_free', 'search', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_notifications', 'plan_free', 'notifications', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_budget', 'plan_free', 'budget', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_risks', 'plan_free', 'risks', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_free_import', 'plan_free', 'import', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plans" ("id", "code", "name", "description", "price_cents", "currency", "interval", "limits", "active") VALUES ('plan_pro', 'pro', 'Pro', 'Collaboration for a small team.', 1500, 'EUR', 'month'::"billing_interval", '{"workspaces":5,"members":25,"guests":10,"projects":200,"notes":10000,"ideas":10000,"groups":50,"storageBytes":21474836480,"fileBytes":20971520}'::jsonb, true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_notes', 'plan_pro', 'notes', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_ideas', 'plan_pro', 'ideas', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_projects', 'plan_pro', 'projects', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_calendar', 'plan_pro', 'calendar', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_files', 'plan_pro', 'files', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_export', 'plan_pro', 'export', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_games', 'plan_pro', 'games', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_search', 'plan_pro', 'search', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_notifications', 'plan_pro', 'notifications', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_budget', 'plan_pro', 'budget', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_risks', 'plan_pro', 'risks', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_import', 'plan_pro', 'import', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_chat', 'plan_pro', 'chat', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_canvas', 'plan_pro', 'canvas', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_assistant', 'plan_pro', 'assistant', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_share', 'plan_pro', 'share', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_groups', 'plan_pro', 'groups', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_team', 'plan_pro', 'team', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_pro_feedback', 'plan_pro', 'feedback', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plans" ("id", "code", "name", "description", "price_cents", "currency", "interval", "limits", "active") VALUES ('plan_business', 'business', 'Business', 'Roles, invites, and audit for a growing organisation.', 4900, 'EUR', 'month'::"billing_interval", '{"workspaces":50,"members":250,"guests":100,"projects":2000,"notes":100000,"ideas":100000,"groups":500,"storageBytes":214748364800,"fileBytes":20971520}'::jsonb, true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_notes', 'plan_business', 'notes', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_ideas', 'plan_business', 'ideas', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_projects', 'plan_business', 'projects', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_calendar', 'plan_business', 'calendar', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_files', 'plan_business', 'files', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_export', 'plan_business', 'export', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_games', 'plan_business', 'games', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_search', 'plan_business', 'search', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_notifications', 'plan_business', 'notifications', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_budget', 'plan_business', 'budget', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_risks', 'plan_business', 'risks', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_import', 'plan_business', 'import', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_chat', 'plan_business', 'chat', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_canvas', 'plan_business', 'canvas', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_assistant', 'plan_business', 'assistant', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_share', 'plan_business', 'share', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_groups', 'plan_business', 'groups', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_team', 'plan_business', 'team', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_feedback', 'plan_business', 'feedback', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_invite', 'plan_business', 'invite', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_business_audit', 'plan_business', 'audit', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plans" ("id", "code", "name", "description", "price_cents", "currency", "interval", "limits", "active") VALUES ('plan_enterprise', 'enterprise', 'Enterprise', 'Custom contract. Unlimited limits. No in-app checkout.', 0, 'EUR', 'custom'::"billing_interval", '{"workspaces":-1,"members":-1,"guests":-1,"projects":-1,"notes":-1,"ideas":-1,"groups":-1,"storageBytes":-1,"fileBytes":20971520}'::jsonb, true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_notes', 'plan_enterprise', 'notes', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_ideas', 'plan_enterprise', 'ideas', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_projects', 'plan_enterprise', 'projects', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_calendar', 'plan_enterprise', 'calendar', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_files', 'plan_enterprise', 'files', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_export', 'plan_enterprise', 'export', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_games', 'plan_enterprise', 'games', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_search', 'plan_enterprise', 'search', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_notifications', 'plan_enterprise', 'notifications', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_budget', 'plan_enterprise', 'budget', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_risks', 'plan_enterprise', 'risks', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_import', 'plan_enterprise', 'import', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_chat', 'plan_enterprise', 'chat', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_canvas', 'plan_enterprise', 'canvas', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_assistant', 'plan_enterprise', 'assistant', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_share', 'plan_enterprise', 'share', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_groups', 'plan_enterprise', 'groups', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_team', 'plan_enterprise', 'team', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_feedback', 'plan_enterprise', 'feedback', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_invite', 'plan_enterprise', 'invite', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "plan_features" ("id", "plan_id", "feature_key", "enabled") VALUES ('pf_enterprise_audit', 'plan_enterprise', 'audit', true) ON CONFLICT ("id") DO NOTHING;

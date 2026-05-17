CREATE TYPE "public"."bookmark_status" AS ENUM('want_read', 'reading', 'finished');--> statement-breakpoint
CREATE TYPE "public"."contributor_role" AS ENUM('creator', 'ancestor', 'collaborator');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('private', 'group', 'system');--> statement-breakpoint
CREATE TYPE "public"."credit_type" AS ENUM('check_in', 'ai_generate', 'admin_grant', 'refund');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'work_share', 'system');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('generating', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'banned', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."work_status" AS ENUM('draft', 'published', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."work_type" AS ENUM('comic', 'drama', 'novel');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"read_status" "bookmark_status" DEFAULT 'want_read' NOT NULL,
	"last_read_page" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"check_date" date NOT NULL,
	"streak" integer DEFAULT 1 NOT NULL,
	"credits_earned" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "contributor_role" DEFAULT 'creator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "conversation_type" DEFAULT 'private' NOT NULL,
	"title" varchar(200) DEFAULT '',
	"work_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"type" "credit_type" NOT NULL,
	"description" text DEFAULT '',
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "task_status" DEFAULT 'generating' NOT NULL,
	"type" "work_type" DEFAULT 'comic' NOT NULL,
	"input_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"content" text NOT NULL,
	"msg_type" "message_type" DEFAULT 'text' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"last_viewed_fork_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_ai_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"text_base_url" text DEFAULT '',
	"text_api_key" text DEFAULT '',
	"text_model" text DEFAULT '',
	"image_base_url" text DEFAULT '',
	"image_api_key" text DEFAULT '',
	"image_model" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ai_configs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"nickname" varchar(100) NOT NULL,
	"avatar" text DEFAULT '',
	"bio" text DEFAULT '',
	"credits" integer DEFAULT 1000 NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "work_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"image_url" text DEFAULT '',
	"description" text DEFAULT '',
	"dialogue" text DEFAULT '',
	"ai_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"subtitle" varchar(200) DEFAULT '',
	"description" text DEFAULT '',
	"cover_image" text DEFAULT '',
	"type" "work_type" DEFAULT 'comic' NOT NULL,
	"status" "work_status" DEFAULT 'draft' NOT NULL,
	"allow_fork" boolean DEFAULT true NOT NULL,
	"creator_id" uuid NOT NULL,
	"parent_work_id" uuid,
	"root_work_id" uuid,
	"fork_from_page" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributors" ADD CONSTRAINT "contributors_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributors" ADD CONSTRAINT "contributors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_logs" ADD CONSTRAINT "credit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_tasks" ADD CONSTRAINT "generation_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_likes" ADD CONSTRAINT "page_likes_page_id_work_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."work_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_likes" ADD CONSTRAINT "page_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ai_configs" ADD CONSTRAINT "user_ai_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_likes" ADD CONSTRAINT "work_likes_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_likes" ADD CONSTRAINT "work_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_pages" ADD CONSTRAINT "work_pages_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_parent_work_id_works_id_fk" FOREIGN KEY ("parent_work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_root_work_id_works_id_fk" FOREIGN KEY ("root_work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bookmarks_unique" ON "bookmarks" USING btree ("user_id","work_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user_status" ON "bookmarks" USING btree ("user_id","read_status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_checkins_unique" ON "check_ins" USING btree ("user_id","check_date");--> statement-breakpoint
CREATE INDEX "idx_comments_work" ON "comments" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "idx_comments_parent" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_comments_user" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contributors_unique" ON "contributors" USING btree ("work_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_contributors_work" ON "contributors" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "idx_contributors_user" ON "contributors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conv_members_unique" ON "conversation_members" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_conv_members_conv" ON "conversation_members" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_conv_members_user" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_logs_user" ON "credit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_logs_task" ON "credit_logs" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_follows_unique" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "idx_follows_follower" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "idx_follows_following" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_user" ON "generation_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "generation_tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_messages_conv" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_page_likes_unique" ON "page_likes" USING btree ("page_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_page_likes_page" ON "page_likes" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_subscriptions_unique" ON "subscriptions" USING btree ("user_id","work_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_nickname" ON "users" USING btree ("nickname");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_work_likes_unique" ON "work_likes" USING btree ("work_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_work_likes_work" ON "work_likes" USING btree ("work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pages_work_page" ON "work_pages" USING btree ("work_id","page_number");--> statement-breakpoint
CREATE INDEX "idx_works_creator" ON "works" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_works_parent" ON "works" USING btree ("parent_work_id");--> statement-breakpoint
CREATE INDEX "idx_works_root" ON "works" USING btree ("root_work_id");--> statement-breakpoint
CREATE INDEX "idx_works_status_type" ON "works" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "idx_works_created" ON "works" USING btree ("created_at");
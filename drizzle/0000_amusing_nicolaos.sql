CREATE TABLE "ai_analysis_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"column_key" varchar NOT NULL,
	"name" varchar NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_analysis_columns_column_key_unique" UNIQUE("column_key")
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"column_key" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "phone_user_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"direction" varchar NOT NULL,
	"message_body" text NOT NULL,
	"message_sid" varchar,
	"timestamp" timestamp with time zone DEFAULT now(),
	"status" varchar
);

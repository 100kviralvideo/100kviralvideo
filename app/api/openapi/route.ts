import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Viral Video Publisher API",
      version: "1.0.0",
      description: "API endpoints for publishing approved AI video clips.",
    },
    servers: [
      {
        url: "/",
        description: "Current site",
      },
      {
        url: "https://100kviralvideo.vercel.app",
        description: "Production server",
      },
      {
        url: "http://localhost:3000",
        description: "Local development server",
      },
    ],
    paths: {
      "/api/drive/find-video": {
        post: {
          summary: "Find a generated video in Google Drive",
          operationId: "findDriveVideo",
          description:
            "Finds a named video file inside a specific Google Drive folder, makes it publicly readable, and returns a direct download URL for publishing.",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/FindDriveVideoPayload",
                },
                examples: {
                  findVideo: {
                    summary: "Find final rendered clip",
                    value: {
                      folder_id: "1abcDriveFolderId",
                      video_filename: "clip_xxx_final.mp4",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Newest matching video file selected",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/FindDriveVideoResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid find-video request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "401": {
              description: "Missing or invalid bearer token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "404": {
              description: "No matching video file found in the requested folder",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/drive/test-upload": {
        post: {
          summary: "Upload a test video to Google Drive",
          operationId: "testUploadDriveVideo",
          description:
            "Uploads a video file to GOOGLE_DRIVE_FOLDER_ID, makes it publicly readable, and returns a final_video_url for testing the approval workflow.",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  $ref: "#/components/schemas/TestUploadDriveVideoPayload",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Video uploaded to Google Drive",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/FindDriveVideoResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid upload request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "401": {
              description: "Missing or invalid bearer token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/config-check": {
        get: {
          summary: "Check server configuration",
          operationId: "configCheck",
          responses: {
            "200": {
              description: "Environment variable presence report",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
      },
      "/api/openapi": {
        get: {
          summary: "Get OpenAPI document",
          operationId: "getOpenApiDocument",
          responses: {
            "200": {
              description: "OpenAPI JSON document used by Swagger UI",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
      },
      "/api/history": {
        get: {
          summary: "List publish history",
          operationId: "listPublishHistory",
          responses: {
            "200": {
              description: "Publish history",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      source: {
                        type: "string",
                        example: "google_sheets",
                      },
                      history: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/review/pending": {
        get: {
          summary: "List clips waiting for approval",
          operationId: "listPendingReviewClips",
          description:
            "Loads REVIEW_QUEUE_JSON, resolves completed Drive videos, and returns only clips ready for human review.",
          responses: {
            "200": {
              description: "Ready clips for dashboard approval",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/PendingReviewResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/review/approve": {
        post: {
          summary: "Approve and publish a review clip",
          operationId: "approveReviewClip",
          description:
            "Approves a configured review queue item and calls /api/publish server-side with human_approved and rights_cleared set to true.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ApproveReviewPayload",
                },
                examples: {
                  approveClip: {
                    value: {
                      id: "clip_001",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Publish processed",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/PublishResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid approval request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "404": {
              description: "Review queue item not found",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/youtube/auth": {
        get: {
          summary: "Start YouTube OAuth",
          operationId: "startYouTubeAuth",
          responses: {
            "307": {
              description: "Redirects to Google OAuth consent",
            },
            "500": {
              description: "Missing or invalid YouTube OAuth configuration",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/youtube/callback": {
        get: {
          summary: "Handle YouTube OAuth callback",
          operationId: "youtubeOAuthCallback",
          parameters: [
            {
              name: "code",
              in: "query",
              required: true,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "OAuth token exchange result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
      },
      "/api/tiktok/auth": {
        get: {
          summary: "Start TikTok OAuth",
          operationId: "startTikTokAuth",
          responses: {
            "307": {
              description: "Redirects to TikTok OAuth consent",
            },
            "500": {
              description: "Missing or invalid TikTok OAuth configuration",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
      "/api/tiktok/callback": {
        get: {
          summary: "Handle TikTok OAuth callback",
          operationId: "tiktokOAuthCallback",
          parameters: [
            {
              name: "code",
              in: "query",
              required: true,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "OAuth token exchange result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
              },
            },
          },
        },
      },
      "/api/publish": {
        post: {
          summary: "Submit a video publish job",
          operationId: "publishVideo",
          description:
            "Processes each requested platform. YouTube uploads require YouTube OAuth environment variables. Instagram Reels requires a clean public MP4 URL and Meta Graph API credentials.",
          security: [
            {
              bearerAuth: [],
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/PublishPayload",
                },
                examples: {
                  testJob: {
                    summary: "Test publish job",
                    value: {
                      job_id: "test_001",
                      final_video_url: "https://example.com/video.mp4",
                      title: "Test AI Movie Clip",
                      caption: "This is a test caption.",
                      description: "AI-generated movie commentary.",
                      hashtags: ["movies", "film", "shorts"],
                      duration_sec: 75,
                      human_approved: true,
                      rights_cleared: true,
                      ai_generated: true,
                      platforms: [
                        {
                          platform: "youtube_shorts",
                          privacy: "private",
                        },
                        {
                          platform: "instagram_reels",
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Publish job accepted",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/PublishResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid publish request",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "401": {
              description: "Missing or invalid bearer token",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "Enter: Bearer your_publish_api_key",
        },
      },
      schemas: {
        FindDriveVideoPayload: {
          type: "object",
          required: ["folder_id", "video_filename"],
          properties: {
            folder_id: {
              type: "string",
              description: "Google Drive folder ID to search inside.",
            },
            video_filename: {
              type: "string",
              example: "clip_xxx_final.mp4",
            },
          },
          additionalProperties: false,
        },
        TestUploadDriveVideoPayload: {
          type: "object",
          required: ["file"],
          properties: {
            file: {
              type: "string",
              format: "binary",
              description: "Video file to upload to GOOGLE_DRIVE_FOLDER_ID.",
            },
            filename: {
              type: "string",
              description:
                "Optional filename to use in Google Drive. Defaults to the uploaded file name.",
              example: "clip_001_final.mp4",
            },
          },
        },
        FindDriveVideoResponse: {
          type: "object",
          required: [
            "success",
            "file_id",
            "name",
            "final_video_url",
            "warning",
          ],
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            file_id: {
              type: "string",
            },
            name: {
              type: "string",
            },
            mime_type: {
              type: "string",
              example: "video/mp4",
            },
            size: {
              type: "string",
              description: "File size in bytes, as returned by Google Drive.",
            },
            created_time: {
              type: "string",
              format: "date-time",
            },
            web_view_link: {
              type: "string",
              format: "uri",
            },
            web_content_link: {
              type: "string",
              format: "uri",
            },
            final_video_url: {
              type: "string",
              format: "uri",
              example:
                "https://drive.google.com/uc?export=download&id=FILE_ID",
            },
            warning: {
              type: ["string", "null"],
              example: "Multiple files found; newest file selected.",
            },
          },
        },
        PendingReviewResponse: {
          type: "object",
          properties: {
            configured: {
              type: "boolean",
            },
            clips: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                  },
                  title: {
                    type: "string",
                  },
                  caption: {
                    type: "string",
                  },
                  description: {
                    type: "string",
                  },
                  hashtags: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  duration_sec: {
                    type: "number",
                  },
                  ai_generated: {
                    type: "boolean",
                  },
                  platforms: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/PlatformTarget",
                    },
                  },
                  drive_video: {
                    $ref: "#/components/schemas/FindDriveVideoResponse",
                  },
                },
                additionalProperties: true,
              },
            },
          },
        },
        ApproveReviewPayload: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              example: "clip_001",
            },
          },
          additionalProperties: false,
        },
        PlatformTarget: {
          type: "object",
          required: ["platform"],
          properties: {
            platform: {
              type: "string",
              enum: ["youtube_shorts", "instagram_reels", "tiktok"],
            },
            account_id: {
              type: "string",
            },
            privacy: {
              type: "string",
              enum: ["private", "public", "unlisted"],
              description: "YouTube privacy setting.",
            },
            privacy_level: {
              type: "string",
              example: "SELF_ONLY",
              description: "TikTok privacy level from creator_info options.",
            },
            disable_duet: {
              type: "boolean",
              default: false,
            },
            disable_comment: {
              type: "boolean",
              default: false,
            },
            disable_stitch: {
              type: "boolean",
              default: false,
            },
            publish_at: {
              type: "string",
              format: "date-time",
            },
          },
          additionalProperties: false,
        },
        PublishPayload: {
          type: "object",
          required: [
            "job_id",
            "final_video_url",
            "title",
            "caption",
            "description",
            "hashtags",
            "duration_sec",
            "human_approved",
            "rights_cleared",
            "ai_generated",
            "platforms",
          ],
          properties: {
            job_id: {
              type: "string",
            },
            final_video_url: {
              type: "string",
              format: "uri",
            },
            title: {
              type: "string",
            },
            caption: {
              type: "string",
            },
            description: {
              type: "string",
            },
            hashtags: {
              type: "array",
              items: {
                type: "string",
              },
            },
            duration_sec: {
              type: "number",
            },
            human_approved: {
              type: "boolean",
            },
            rights_cleared: {
              type: "boolean",
            },
            ai_generated: {
              type: "boolean",
            },
            platforms: {
              type: "array",
              items: {
                $ref: "#/components/schemas/PlatformTarget",
              },
              minItems: 1,
            },
          },
          additionalProperties: false,
        },
        PublishResponse: {
          type: "object",
          properties: {
            job_id: {
              type: "string",
            },
            status: {
              type: "string",
              example: "processed",
            },
            results: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
            },
          },
          required: ["error"],
        },
      },
    },
  });
}

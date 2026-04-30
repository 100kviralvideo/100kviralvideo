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
      "/api/drive/auth": {
        get: {
          summary: "Initiate Google Drive OAuth flow",
          operationId: "driveAuth",
          description: "Redirects the user to the Google OAuth2 consent screen to authorize Drive access.",
          responses: {
            "302": {
              description: "Redirect to Google OAuth consent screen",
            },
          },
        },
      },
      "/api/drive/callback": {
        get: {
          summary: "Google Drive OAuth callback",
          operationId: "driveCallback",
          description: "Handles the callback from Google OAuth, exchanges the authorization code for tokens.",
          parameters: [
            {
              name: "code",
              in: "query",
              required: true,
              schema: {
                type: "string",
              },
              description: "The authorization code returned from Google.",
            },
          ],
          responses: {
            "200": {
              description: "Tokens retrieved successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/DriveCallbackResponse",
                  },
                },
              },
            },
            "400": {
              description: "Missing or invalid authorization code",
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
      "/api/drive/upload-from-url": {
        post: {
          summary: "Upload a video to Google Drive from a URL",
          operationId: "uploadDriveVideoFromUrl",
          description: "Downloads a video from a given URL and uploads it directly to a Google Drive folder.",
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
                  $ref: "#/components/schemas/UploadFromUrlPayload",
                },
                examples: {
                  uploadVideo: {
                    summary: "Upload video from external URL",
                    value: {
                      source_video_url: "https://example.com/generated_video.mp4",
                      video_filename: "viral_clip_001.mp4",
                      folder_id: "1abcDriveFolderId",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Video uploaded successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/UploadFromUrlResponse",
                  },
                },
              },
            },
            "400": {
              description: "Invalid request payload",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse",
                  },
                },
              },
            },
            "500": {
              description: "Upload failed",
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
        DriveCallbackResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
            },
            refresh_token: {
              type: "string",
            },
            access_token_exists: {
              type: "boolean",
            },
            expiry_date: {
              type: "number",
            },
          },
        },
        UploadFromUrlPayload: {
          type: "object",
          required: ["source_video_url", "video_filename"],
          properties: {
            source_video_url: {
              type: "string",
              format: "uri",
            },
            video_filename: {
              type: "string",
            },
            folder_id: {
              type: "string",
            },
          },
        },
        UploadFromUrlResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            file_id: {
              type: "string",
            },
            name: {
              type: "string",
            },
            mime_type: {
              type: "string",
            },
            size: {
              type: "string",
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
            },
          },
        },
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

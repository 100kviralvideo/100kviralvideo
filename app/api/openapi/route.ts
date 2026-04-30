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
      "/api/comfy/generate-video": {
        post: {
          summary: "Generate a video from uploaded images with ComfyUI",
          operationId: "generateComfyVideo",
          description:
            "Queues a ComfyUI job from four image uploads plus prompts. Google Drive upload is handled outside this app by RunPod.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  $ref: "#/components/schemas/ComfyMultipartPayload",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "ComfyUI job queued in ComfyUI",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ComfyQueuedResponse" },
                },
              },
            },
            "400": {
              description: "Invalid generation request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Missing or invalid bearer token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/comfy/generate-video-from-urls": {
        post: {
          summary: "Generate a video from image URLs with ComfyUI",
          operationId: "generateComfyVideoFromUrls",
          description:
            "Downloads four image URLs and queues the ComfyUI workflow. Google Drive upload is handled outside this app by RunPod.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ComfyUrlPayload" },
              },
            },
          },
          responses: {
            "200": {
              description: "ComfyUI job queued in ComfyUI",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ComfyQueuedResponse" },
                },
              },
            },
            "400": {
              description: "Invalid generation request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Missing or invalid bearer token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/comfy/jobs/{job_id}": {
        get: {
          summary: "Get ComfyUI video generation job status",
          operationId: "getComfyJob",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "job_id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "ComfyUI job status",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ComfyJob" },
                },
              },
            },
            "401": {
              description: "Missing or invalid bearer token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Job not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
        ComfyGenerationControls: {
          type: "object",
          properties: {
            width: { type: "number", example: 960 },
            height: { type: "number", example: 544 },
            fps: { type: "number", example: 24 },
            segment_lengths: {
              type: "array",
              items: { type: "number" },
              minItems: 4,
              maxItems: 4,
              example: [204, 192, 156, 121],
              description:
                "JSON body only. For multipart, send segment_lengths as comma-separated text or segment_1_length through segment_4_length.",
            },
            image_strength: { type: "number", example: 0.7 },
          },
        },
        ComfyMultipartPayload: {
          allOf: [
            { $ref: "#/components/schemas/ComfyGenerationControls" },
            {
              type: "object",
              required: [
                "global_prompt",
                "segment_1_prompt",
                "segment_2_prompt",
                "segment_3_prompt",
                "segment_4_prompt",
                "segment_1_image",
                "segment_2_image",
                "segment_3_image",
                "segment_4_image",
              ],
              properties: {
                title: {
                  type: "string",
                  description:
                    "Used as the Google Drive video filename after generation.",
                  example: "My YouTube Short Title",
                },
                global_prompt: { type: "string" },
                segment_1_prompt: { type: "string" },
                segment_2_prompt: { type: "string" },
                segment_3_prompt: { type: "string" },
                segment_4_prompt: { type: "string" },
                segment_1_image: { type: "string", format: "binary" },
                segment_2_image: { type: "string", format: "binary" },
                segment_3_image: { type: "string", format: "binary" },
                segment_4_image: { type: "string", format: "binary" },
                segment_lengths: {
                  type: "string",
                  example: "204,192,156,121",
                },
              },
            },
          ],
        },
        ComfyUrlPayload: {
          allOf: [
            { $ref: "#/components/schemas/ComfyGenerationControls" },
            {
              type: "object",
              required: [
                "global_prompt",
                "segment_prompts",
                "segment_1_image_url",
                "segment_2_image_url",
                "segment_3_image_url",
                "segment_4_image_url",
              ],
              properties: {
                title: {
                  type: "string",
                  description:
                    "Used as the Google Drive video filename after generation.",
                  example: "My YouTube Short Title",
                },
                global_prompt: { type: "string" },
                segment_prompts: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 4,
                  maxItems: 4,
                },
                segment_1_image_url: { type: "string", format: "uri" },
                segment_2_image_url: { type: "string", format: "uri" },
                segment_3_image_url: { type: "string", format: "uri" },
                segment_4_image_url: { type: "string", format: "uri" },
              },
            },
          ],
        },
        ComfyQueuedResponse: {
          type: "object",
          required: ["job_id", "prompt_id", "status"],
          properties: {
            job_id: { type: "string" },
            title: { type: ["string", "null"] },
            status_url: {
              type: "string",
              example:
                "/api/comfy/jobs/JOB_ID?prompt_id=PROMPT_ID&client_id=CLIENT_ID&title=Video+Title",
            },
            prompt_id: { type: "string" },
            comfy_client_id: { type: "string" },
            status: { type: "string", example: "processing" },
          },
        },
        ComfyJob: {
          type: "object",
          required: ["job_id", "status", "created_at", "updated_at"],
          properties: {
            job_id: { type: "string" },
            title: { type: "string" },
            status: {
              type: "string",
              enum: [
                "queued",
                "uploading_images_to_comfy",
                "loading_workflow",
                "queued_in_comfy",
                "processing",
                "reading_output",
                "done",
                "failed",
              ],
            },
            prompt_id: { type: "string" },
            comfy_client_id: { type: "string" },
            output_file_name: { type: "string" },
            output_file_subfolder: { type: "string" },
            output_file_type: { type: "string" },
            error: { type: "string" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
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

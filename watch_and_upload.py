from pathlib import Path
import subprocess
import time
from datetime import datetime
import re
import requests
import json
from urllib.parse import quote

# ===== CONFIG =====
OUTPUT_DIR = Path("/workspace/runpod-slim/ComfyUI/output")
DRIVE_REMOTE = "gdrive:100kviral/video_test"

# Google Drive folder id ของโฟลเดอร์ video_test
DRIVE_FOLDER_ID = "1md21Y-nilWxg_nHzvI1DbUuUN8D15ivM"

# API ที่ต้องเรียกหลัง upload เสร็จ
API_BASE_URL = "https://100kviralvideo.vercel.app"
POST_ENDPOINT = f"{API_BASE_URL}/api/pre-publish"
JOB_BY_TITLE_ENDPOINT = f"{API_BASE_URL}/api/comfy/jobs/by-title"

POST_HEADERS = {
    "Content-Type": "application/json",
    # ถ้า API มี token ค่อยเพิ่ม:
    "Authorization": "Bearer test_secret_key"
}

CHECK_INTERVAL = 5
READY_WAIT = 15
VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv"]
DEFAULT_FPS = 24
DEFAULT_PLATFORMS = [
    {
        "platform": "youtube_shorts",
        "privacy": "private",
    }
]
# ==================

START_TIME = time.time()
uploaded_this_session = set()


def is_file_ready(path: Path) -> bool:
    try:
        size1 = path.stat().st_size
        time.sleep(READY_WAIT)
        size2 = path.stat().st_size
        return size1 == size2 and size2 > 0
    except FileNotFoundError:
        return False


def is_audio_video_file(path: Path) -> bool:
    name = path.stem.lower()
    return name.endswith("-audio") or name.endswith("_audio")


def clean_video_name(video: Path) -> str:
    title = video.stem

    # ตัวอย่าง:
    # My Title_00003-audio.mp4 -> My Title.mp4
    # My Title-00003-audio.mp4 -> My Title.mp4
    # My Title_audio.mp4 -> My Title.mp4
    title = re.sub(r"[_-]\d+[-_]audio$", "", title, flags=re.IGNORECASE)
    title = re.sub(r"[-_]audio$", "", title, flags=re.IGNORECASE)

    title = title.strip()

    if not title:
        title = video.stem

    return f"{title}.mp4"


def find_new_audio_videos():
    videos = []

    for ext in VIDEO_EXTENSIONS:
        videos.extend(OUTPUT_DIR.glob(f"*{ext}"))

    new_videos = []

    for video in videos:
        try:
            if video.stat().st_mtime < START_TIME:
                continue

            if not is_audio_video_file(video):
                continue

            new_videos.append(video)

        except FileNotFoundError:
            continue

    return sorted(new_videos, key=lambda p: p.stat().st_mtime)


def upload_to_drive(video: Path):
    drive_name = clean_video_name(video)
    remote_path = f"{DRIVE_REMOTE}/{drive_name}"

    result = subprocess.run(
        ["rclone", "copyto", str(video), remote_path],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print(f"[DONE] Uploaded: {video.name} -> {drive_name}")
        return True, drive_name

    print(f"[ERROR] Upload failed: {video.name}")
    print(result.stderr)
    return False, None


def video_title_from_filename(video_filename: str) -> str:
    return Path(video_filename).stem.strip()


def normalize_hashtags(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        return [item.strip() for item in re.split(r"[\s,]+", value) if item.strip()]

    return []


def calculate_duration_sec(metadata: dict) -> float:
    if isinstance(metadata.get("duration_sec"), (int, float)):
        return metadata["duration_sec"]

    segment_lengths = metadata.get("segment_lengths")
    fps = metadata.get("fps") or DEFAULT_FPS

    if (
        isinstance(segment_lengths, list)
        and segment_lengths
        and isinstance(fps, (int, float))
        and fps > 0
    ):
        frame_count = sum(
            value for value in segment_lengths if isinstance(value, (int, float))
        )
        if frame_count > 0:
            return round(frame_count / fps, 3)

    return 0


def fetch_job_metadata(title: str) -> dict:
    url = f"{JOB_BY_TITLE_ENDPOINT}/{quote(title, safe='')}"
    headers = {
        "accept": "application/json",
        "Authorization": "Bearer test_secret_key",
    }

    print(f"[META] Fetching job metadata: {url}")

    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"[META STATUS] {response.status_code}")
        print(f"[META RESPONSE] {response.text}")

        if 200 <= response.status_code < 300:
            data = response.json()
            return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[META EXCEPTION] {e}")

    return {}


def build_pre_publish_payload(video_filename: str) -> dict:
    title = video_title_from_filename(video_filename)
    metadata = fetch_job_metadata(title)
    job_id = metadata.get("job_id")

    if not isinstance(job_id, str) or not job_id.strip():
        raise RuntimeError(f"Missing Comfy job metadata UUID for title: {title}")

    metadata_title = metadata.get("title") if isinstance(metadata.get("title"), str) else title
    caption = metadata.get("caption") if isinstance(metadata.get("caption"), str) else metadata_title
    description = (
        metadata.get("description")
        if isinstance(metadata.get("description"), str)
        else ""
    )

    payload = {
        "job_id": job_id.strip(),
        "folder_id": DRIVE_FOLDER_ID,
        "video_filename": video_filename,
        "title": metadata_title,
        "caption": caption,
        "description": description,
        "hashtags": normalize_hashtags(metadata.get("hashtags")),
        "duration_sec": calculate_duration_sec(metadata),
        "ai_generated": True,
        "platforms": DEFAULT_PLATFORMS,
    }

    return payload


def notify_pre_publish_api(video_filename: str):
    payload = build_pre_publish_payload(video_filename)

    headers = {
        "accept": "application/json",
        "Authorization": "Bearer test_secret_key",
        "Content-Type": "application/json"
    }

    print(f"[POST] Calling pre-publish API for: {repr(video_filename)}")
    print(f"[POST PAYLOAD] {payload}")

    for attempt in range(1, 6):
        try:
            print(f"[POST TRY] Attempt {attempt}/5")

            response = requests.post(
                POST_ENDPOINT,
                headers=headers,
                data=json.dumps(payload, ensure_ascii=False),
                timeout=60
            )

            print(f"[POST REQUEST BODY] {response.request.body}")
            print(f"[POST REQUEST HEADERS] {response.request.headers}")
            print(f"[POST STATUS] {response.status_code}")
            print(f"[POST RESPONSE] {response.text}")

            if 200 <= response.status_code < 300:
                print("[POST DONE] API response:")
                print(response.text)
                return True

            time.sleep(10)

        except Exception as e:
            print(f"[POST EXCEPTION] {e}")
            time.sleep(10)

    return False


print("Watching only NEW audio video files from now...")
print(f"Started at: {datetime.fromtimestamp(START_TIME)}")
print(f"Output folder: {OUTPUT_DIR}")
print(f"Google Drive target: {DRIVE_REMOTE}")
print(f"Drive folder id: {DRIVE_FOLDER_ID}")
print(f"Post endpoint: {POST_ENDPOINT}")
print(f"Job metadata endpoint: {JOB_BY_TITLE_ENDPOINT}")
print("Only files ending with -audio or _audio will be uploaded.")
print("Old files already in output folder will be ignored.")
print("Press Ctrl+C to stop.")

while True:
    for video in find_new_audio_videos():
        if video.name in uploaded_this_session:
            continue

        print(f"[FOUND] New audio video: {video.name}")

        if not is_file_ready(video):
            print(f"[WAIT] File still writing: {video.name}")
            continue

        upload_success, drive_filename = upload_to_drive(video)

        if upload_success and drive_filename:
            post_success = notify_pre_publish_api(drive_filename)

            if post_success:
                print(f"[ALL DONE] Uploaded and API notified: {drive_filename}")
            else:
                print(f"[WARN] Uploaded but API notification failed: {drive_filename}")

            uploaded_this_session.add(video.name)

    time.sleep(CHECK_INTERVAL)

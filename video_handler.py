"""
Handles downloading the video file from a direct CDN URL to a temp file,
enforcing Telegram's 50MB bot upload limit, and cleaning up afterward.
"""

import logging
import os
import tempfile

import requests

from config import (
    API_KEY,
    DOWNLOAD_CHUNK_SIZE,
    DOWNLOAD_TIMEOUT,
    MAX_FILE_SIZE_BYTES,
    PROXY_VIDEO_ENDPOINT,
)

logger = logging.getLogger(__name__)


class VideoTooLargeError(Exception):
    """Raised when the video exceeds Telegram's upload limit."""


class VideoDownloadError(Exception):
    """Raised for any other download failure."""


BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

PLATFORM_HEADERS = {
    "tiktok": {**BASE_HEADERS, "Referer": "https://www.tiktok.com/", "Origin": "https://www.tiktok.com"},
    "facebook": {**BASE_HEADERS, "Referer": "https://www.facebook.com/", "Origin": "https://www.facebook.com"},
    "instagram": {**BASE_HEADERS, "Referer": "https://www.instagram.com/", "Origin": "https://www.instagram.com"},
}


def _headers_for(video_url: str, platform: str = "") -> dict:
    platform = (platform or "").lower()
    if platform in PLATFORM_HEADERS:
        return PLATFORM_HEADERS[platform]
    host = video_url.lower()
    if "tiktok" in host:
        return PLATFORM_HEADERS["tiktok"]
    if "fbcdn" in host or "facebook" in host:
        return PLATFORM_HEADERS["facebook"]
    if "cdninstagram" in host or "instagram" in host:
        return PLATFORM_HEADERS["instagram"]
    return BASE_HEADERS


def _resolve_download_url(video_url: str, platform: str, proxy_token: str = "") -> tuple:
    """
    Returns (url_to_fetch, headers, params) for the actual HTTP GET.

    For TikTok, the API server actually downloads the video file to local
    disk at resolve time (TikTok's CDN rejects fetches for its signed urls
    from any process other than the one that resolved them — this was
    confirmed even when passing yt-dlp's own resolved headers along). The
    proxy_token here just references that already-downloaded file; the
    proxy endpoint streams it directly, no CDN url is fetched a second time.
    """
    platform_key = (platform or "").lower()
    if platform_key == "tiktok" or "tiktok" in video_url.lower():
        params = {"platform": "tiktok"}
        if proxy_token:
            params["proxy_token"] = proxy_token
        else:
            params["video_url"] = video_url
        return (PROXY_VIDEO_ENDPOINT, {"x-api-key": API_KEY}, params)
    return (video_url, _headers_for(video_url, platform), None)


def download_video(
    video_url: str, suffix: str = ".mp4", platform: str = "", proxy_token: str = ""
) -> str:
    """
    Stream-download the video at video_url to a temp file.

    Returns the local file path on success.
    Raises VideoTooLargeError if the file exceeds MAX_FILE_SIZE_BYTES.
    Raises VideoDownloadError for network/other failures.
    The caller is responsible for deleting the returned file afterward.
    """
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(tmp_fd)

    fetch_url, headers, params = _resolve_download_url(video_url, platform, proxy_token)

    try:
        with requests.get(
            fetch_url,
            stream=True,
            timeout=DOWNLOAD_TIMEOUT,
            headers=headers,
            params=params,
        ) as response:
            response.raise_for_status()

            # Fast check via Content-Length header when available
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > MAX_FILE_SIZE_BYTES:
                raise VideoTooLargeError(
                    f"Video is {int(content_length) / (1024 * 1024):.2f} MB, "
                    f"which exceeds Telegram's 50 MB bot upload limit."
                )

            downloaded = 0
            with open(tmp_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=DOWNLOAD_CHUNK_SIZE):
                    if not chunk:
                        continue
                    downloaded += len(chunk)
                    if downloaded > MAX_FILE_SIZE_BYTES:
                        raise VideoTooLargeError(
                            "Video exceeds Telegram's 50 MB bot upload limit."
                        )
                    f.write(chunk)

        return tmp_path

    except VideoTooLargeError:
        _safe_delete(tmp_path)
        raise
    except requests.exceptions.Timeout:
        _safe_delete(tmp_path)
        raise VideoDownloadError("Downloading the video timed out. Please try again.")
    except requests.exceptions.ConnectionError:
        _safe_delete(tmp_path)
        raise VideoDownloadError("Could not connect to the video source.")
    except requests.exceptions.HTTPError as exc:
        _safe_delete(tmp_path)
        status = exc.response.status_code if exc.response is not None else None
        if status == 403:
            raise VideoDownloadError(
                "The video link expired or was rejected by the source platform "
                "(this is common with TikTok's signed CDN links). Please send the link again."
            )
        if status == 502:
            raise VideoDownloadError(
                "The source platform rejected this video (link likely expired). "
                "Please send the link again."
            )
        raise VideoDownloadError(f"Failed to download the video (HTTP {status}).")
    except requests.exceptions.RequestException as exc:
        _safe_delete(tmp_path)
        raise VideoDownloadError(f"Failed to download the video: {exc}")
    except Exception as exc:
        _safe_delete(tmp_path)
        logger.exception("Unexpected error during video download")
        raise VideoDownloadError(f"Unexpected error while downloading the video: {exc}")


def _safe_delete(path: str) -> None:
    """Delete a file if it exists, ignoring any errors."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except OSError:
        logger.warning("Failed to delete temp file: %s", path)

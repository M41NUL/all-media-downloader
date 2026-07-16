"""
Handles downloading the video file from a direct CDN URL to a temp file,
enforcing Telegram's 50MB bot upload limit, and cleaning up afterward.
"""

import logging
import os
import tempfile

import requests

from config import DOWNLOAD_CHUNK_SIZE, DOWNLOAD_TIMEOUT, MAX_FILE_SIZE_BYTES

logger = logging.getLogger(__name__)


class VideoTooLargeError(Exception):
    """Raised when the video exceeds Telegram's upload limit."""


class VideoDownloadError(Exception):
    """Raised for any other download failure."""


def download_video(video_url: str, suffix: str = ".mp4") -> str:
    """
    Stream-download the video at video_url to a temp file.

    Returns the local file path on success.
    Raises VideoTooLargeError if the file exceeds MAX_FILE_SIZE_BYTES.
    Raises VideoDownloadError for network/other failures.
    The caller is responsible for deleting the returned file afterward.
    """
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(tmp_fd)

    try:
        with requests.get(video_url, stream=True, timeout=DOWNLOAD_TIMEOUT) as response:
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

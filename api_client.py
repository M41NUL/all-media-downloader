"""
Client for the All Media Downloader external API.
Handles the HTTP call and returns a normalized result dict —
never raises for expected failure cases (network errors, bad JSON,
API-level failure), so callers can always show a friendly message.
"""

import logging

import requests

from config import API_DOWNLOAD_ENDPOINT, API_KEY, API_REQUEST_TIMEOUT

logger = logging.getLogger(__name__)


def fetch_video_info(url: str) -> dict:
    """
    Call the download API for the given video URL.

    Returns a dict with either:
      - {"success": True, ...fields from the API...}
      - {"success": False, "error": "<user-friendly message>"}
    """
    headers = {"x-api-key": API_KEY}
    params = {"url": url}

    try:
        response = requests.get(
            API_DOWNLOAD_ENDPOINT,
            headers=headers,
            params=params,
            timeout=API_REQUEST_TIMEOUT,
        )
    except requests.exceptions.Timeout:
        return {"success": False, "error": "The API took too long to respond. Please try again."}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Could not connect to the download service. Please try again later."}
    except requests.exceptions.RequestException as exc:
        logger.exception("Unexpected request error while calling API")
        return {"success": False, "error": f"Network error: {exc}"}

    try:
        data = response.json()
    except ValueError:
        return {"success": False, "error": "The download service returned an invalid response."}

    if not response.ok:
        detail = data.get("detail") if isinstance(data, dict) else None
        return {"success": False, "error": detail or f"API error (HTTP {response.status_code})."}

    if not isinstance(data, dict) or not data.get("success"):
        detail = data.get("detail") if isinstance(data, dict) else None
        return {"success": False, "error": detail or "Could not process this link."}

    # Success — pass through the fields we care about
    return {
        "success": True,
        "caption": data.get("caption", ""),
        "platform": data.get("platform", "unknown"),
        "format": data.get("format", "mp4"),
        "size": data.get("size", "unknown"),
        "duration": data.get("duration", "unknown"),
        "video_url": data.get("video_url"),
        "thumbnail_url": data.get("thumbnail_url"),
        "quality": data.get("quality", "unknown"),
        # Present for TikTok — carries yt-dlp's exact resolved headers on
        # the API side so the proxy can fetch with them instead of guessing.
        "proxy_token": data.get("proxy_token"),
    }

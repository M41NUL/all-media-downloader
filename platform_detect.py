"""
Detects whether a message contains a supported video link
(TikTok, Instagram, or Facebook) and extracts the URL.
"""

import re

SUPPORTED_DOMAINS = (
    "tiktok.com",
    "vt.tiktok.com",
    "instagram.com",
    "facebook.com",
    "fb.watch",
)

# Matches http(s) URLs in free-form text
URL_PATTERN = re.compile(r"https?://[^\s]+")


def extract_url(text: str) -> str | None:
    """Return the first URL found in the text, or None."""
    if not text:
        return None
    match = URL_PATTERN.search(text)
    return match.group(0) if match else None


def is_supported_link(text: str) -> bool:
    """Check if the given text contains a URL from a supported platform."""
    url = extract_url(text)
    if not url:
        return False
    url_lower = url.lower()
    return any(domain in url_lower for domain in SUPPORTED_DOMAINS)


def get_supported_url(text: str) -> str | None:
    """Return the supported URL from the text if present, else None."""
    url = extract_url(text)
    if url and any(domain in url.lower() for domain in SUPPORTED_DOMAINS):
        return url
    return None

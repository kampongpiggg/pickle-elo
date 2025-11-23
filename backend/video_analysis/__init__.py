"""
video_analysis package

This exposes the main entry point for the video processing pipeline:
`analyze_video_to_json`.

The actual implementation lives in runner.py, and the PICKLEBALLL_VIDEO_ANALYSIS
repo is included as a submodule/library inside this folder.
"""

from .runner import analyze_video_to_json

__all__ = ["analyze_video_to_json"]

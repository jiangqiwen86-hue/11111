#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地 Whisper ASR 服务（泰语直播语音转文字）
- 接收音频/视频文件，返回泰语转写文字（带时间戳分段）
- 供「直播运营中心」前端调用，前端再交给 DeepSeek 翻译成中文

用法：
    python whisper_server.py
环境变量：
    WHISPER_MODEL_PATH  模型目录（默认 ~/.workbuddy/whisper-models/faster-whisper-small）
    WHISPER_LANGUAGE    识别语言（默认 th 泰语）
    WHISPER_PORT        端口（默认 8765）
"""
import os
import sys
import tempfile
import time

from flask import Flask, request, jsonify

MODEL_PATH = os.environ.get(
    "WHISPER_MODEL_PATH",
    os.path.expanduser("~/.workbuddy/whisper-models/faster-whisper-small"),
)
LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "th")
PORT = int(os.environ.get("WHISPER_PORT", "8765"))
MAX_MB = int(os.environ.get("WHISPER_MAX_MB", "500"))  # 单文件上限

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_MB * 1024 * 1024

_model = None
_model_load_time = 0.0


def get_model():
    global _model, _model_load_time
    if _model is None:
        from faster_whisper import WhisperModel
        t0 = time.time()
        _model = WhisperModel(MODEL_PATH, device="cpu", compute_type="int8")
        _model_load_time = round(time.time() - t0, 2)
    return _model


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Max-Age"] = "86400"
    return resp


@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return ("", 204)
    return jsonify({
        "ok": True,
        "model": MODEL_PATH,
        "language": LANGUAGE,
        "loaded": _model is not None,
        "load_time_s": _model_load_time,
    })


@app.route("/transcribe", methods=["POST", "OPTIONS"])
def transcribe():
    if request.method == "OPTIONS":
        return ("", 204)
    if "file" not in request.files:
        return jsonify({"error": "缺少 file 字段"}), 400
    f = request.files["file"]
    lang = (request.form.get("language") or LANGUAGE).strip()
    if lang in ("", "auto"):
        lang = None  # 自动检测语言
    suffix = os.path.splitext(f.filename or "")[1] or ".mp4"
    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        f.save(tmp_path)
        model = get_model()
        t0 = time.time()
        segments, info = model.transcribe(
            tmp_path,
            language=lang,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )
        segs = [
            {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
            for s in segments
        ]
        text = "".join(s["text"] for s in segs)
        return jsonify({
            "text": text,
            "language": getattr(info, "language", lang),
            "language_probability": round(getattr(info, "language_probability", 0), 3),
            "duration": round(getattr(info, "duration", 0), 2),
            "elapsed_s": round(time.time() - t0, 2),
            "segments": segs,
        })
    except Exception as e:
        return jsonify({"error": "转写失败：" + str(e)}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


if __name__ == "__main__":
    print(f"[Whisper ASR] 模型目录: {MODEL_PATH}")
    print(f"[Whisper ASR] 语言: {LANGUAGE} | 端口: {PORT} | 单文件上限: {MAX_MB}MB")
    print(f"[Whisper ASR] 健康检查: http://127.0.0.1:{PORT}/health")
    app.run(host="127.0.0.1", port=PORT, threaded=True)

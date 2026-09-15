#!/bin/bash
# 启动本地 Whisper ASR 服务
# 依赖：faster-whisper 已装入 managed venv，模型已下载到 ~/.workbuddy/whisper-models/faster-whisper-small
PY="/Users/jqw/.workbuddy/binaries/python/envs/default/bin/python"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export WHISPER_MODEL_PATH="${WHISPER_MODEL_PATH:-$HOME/.workbuddy/whisper-models/faster-whisper-small}"
export WHISPER_LANGUAGE="${WHISPER_LANGUAGE:-th}"
export WHISPER_PORT="${WHISPER_PORT:-8765}"

exec "$PY" "$SCRIPT_DIR/whisper_server.py"

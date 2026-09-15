# 本地 Whisper ASR 服务（泰语直播语音转文字）

给「直播运营中心」的视频片段分析提供语音转文字能力：前端上传视频 → 本服务用 Whisper 识别泰语 → 返回泰语文字（带时间戳）→ 前端交给 DeepSeek 翻译成中文。

## 一键启动

```bash
cd outputs/whisper-server
chmod +x start.sh
./start.sh
```

启动后健康检查：`http://127.0.0.1:8765/health`

## 接口

### POST /transcribe
上传音频或视频文件（`multipart/form-data`，字段名 `file`，可选 `language`，默认 `th`）。

返回：
```json
{
  "text": "识别出的完整泰语文字",
  "language": "th",
  "duration": 62.3,
  "segments": [{"start": 0.0, "end": 4.2, "text": "..."}]
}
```

### GET /health
服务状态。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| WHISPER_MODEL_PATH | ~/.workbuddy/whisper-models/faster-whisper-small | 模型目录 |
| WHISPER_LANGUAGE | th | 识别语言 |
| WHISPER_PORT | 8765 | 端口 |
| WHISPER_MAX_MB | 500 | 单文件大小上限(MB) |

## 模型

faster-whisper-small（CTranslate2 格式，多语言含泰语），来源 ModelScope `pengzhendong/faster-whisper-small`（HuggingFace 国内被墙，故走魔搭）。

## 注意事项

- 服务只监听 127.0.0.1（仅本机访问）。前端页面部署在 GitHub Pages，浏览器跨域调用本服务，服务端已加 CORS 头放行。
- 首次请求会加载模型（small 约几秒），之后常驻内存。
- 建议用 `compute_type=int8`（CPU 下速度快、内存省），如需更高准确率可换 medium 模型（更大更慢）。

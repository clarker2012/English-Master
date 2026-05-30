# Local voice clone service

This app calls `http://127.0.0.1:5055/synthesize` when a saved voice style is active.

Recommended open-source engines:

- OpenVoice: https://github.com/myshell-ai/OpenVoice
- OpenVoice API server: https://github.com/ValyrianTech/OpenVoice_server
- CosyVoice: https://github.com/FunAudioLLM/CosyVoice
- Coqui XTTS API server: https://github.com/RedApple990129/Coqui-xtts-api

Run a compatible engine locally, then adapt `server.py` to call that engine's endpoint or Python API.
The browser sends:

```json
{
  "text": "Generated reading passage.",
  "voiceName": "BBC announcer",
  "referenceAudio": "data:audio/webm;base64,...",
  "engine": "openvoice"
}
```

The service should return an audio file response, such as WAV or MP3.

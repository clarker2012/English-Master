"""
Local voice-clone gateway for the vocabulary trainer.

This file is intentionally a thin adapter. Install and run one of these engines,
then fill in the engine-specific call:
- OpenVoice: https://github.com/myshell-ai/OpenVoice
- OpenVoice_server: https://github.com/ValyrianTech/OpenVoice_server
- CosyVoice: https://github.com/FunAudioLLM/CosyVoice
- Coqui XTTS API: https://github.com/RedApple990129/Coqui-xtts-api
"""

from __future__ import annotations

import base64
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel


class SynthesisRequest(BaseModel):
    text: str
    voiceName: str = "reference"
    referenceAudio: str
    engine: str = "openvoice"


app = FastAPI(title="Vocabulary Voice Clone Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4176", "http://localhost:4176"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


def save_reference_audio(data_url: str, work_dir: Path) -> Path:
    if "," not in data_url:
        raise HTTPException(status_code=400, detail="referenceAudio must be a data URL")
    header, payload = data_url.split(",", 1)
    suffix = ".webm"
    if "wav" in header:
        suffix = ".wav"
    elif "mpeg" in header or "mp3" in header:
        suffix = ".mp3"
    output = work_dir / f"reference{suffix}"
    output.write_bytes(base64.b64decode(payload))
    return output


def synthesize_with_engine(req: SynthesisRequest, reference_path: Path, output_path: Path) -> Path:
    """
    Replace this stub with the selected GitHub engine call.

    OpenVoice_server example shape:
      POST reference_path to its upload/voice endpoint, then POST req.text for synthesis.

    CosyVoice example shape:
      call `/inference_zero_shot` with tts_text=req.text and prompt_wav=reference_path.

    XTTS API example shape:
      call its speaker-cloning endpoint with reference_path, then synthesize req.text.
    """
    raise HTTPException(
        status_code=501,
        detail=(
            "Voice clone engine is not connected. Install OpenVoice, CosyVoice, "
            "or XTTS locally and implement synthesize_with_engine()."
        ),
    )


@app.post("/synthesize")
def synthesize(req: SynthesisRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    with tempfile.TemporaryDirectory() as temp:
        work_dir = Path(temp)
        reference_path = save_reference_audio(req.referenceAudio, work_dir)
        output_path = work_dir / "output.wav"
        result_path = synthesize_with_engine(req, reference_path, output_path)
        if not result_path.exists():
            raise HTTPException(status_code=500, detail="engine did not produce audio")
        return FileResponse(result_path, media_type="audio/wav", filename="lead-reading.wav")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("VOICE_CLONE_PORT", "5055"))
    uvicorn.run(app, host="127.0.0.1", port=port)

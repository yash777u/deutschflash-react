from __future__ import annotations

from pathlib import Path

from faster_whisper import WhisperModel


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "public" / "podcasts"
SUBTITLE_DIR = AUDIO_DIR / "subtitles"
MODEL_NAME = "base"


def vtt_timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    whole_seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02}.{milliseconds:03}"


def main() -> None:
    SUBTITLE_DIR.mkdir(parents=True, exist_ok=True)
    audio_files = sorted(
        (path for path in AUDIO_DIR.iterdir() if path.suffix.lower() in {".mp3", ".m4a"}),
        key=lambda path: (path.stem.casefold(), path.suffix.lower() != ".mp3"),
    )

    unique_audio: dict[str, Path] = {}
    for audio in audio_files:
        unique_audio.setdefault(audio.stem, audio)

    missing = [
        audio
        for audio in unique_audio.values()
        if not any((SUBTITLE_DIR / f"{audio.stem}{suffix}").exists() for suffix in (".vtt", ".srt"))
    ]
    if not missing:
        print("Podcast subtitles already exist; skipping transcription.")
        return

    print(f"Loading Whisper {MODEL_NAME} model for German speech transcription...")
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")

    for audio in missing:
        output = SUBTITLE_DIR / f"{audio.stem}.vtt"
        print(f"Transcribing {audio.name}...")
        segments, _ = model.transcribe(
            str(audio),
            language="de",
            beam_size=3,
            vad_filter=True,
            word_timestamps=False,
        )
        with output.open("w", encoding="utf-8", newline="\n") as subtitle_file:
            subtitle_file.write("WEBVTT\n\n")
            for index, segment in enumerate(segments, start=1):
                text = " ".join(segment.text.split())
                if not text:
                    continue
                subtitle_file.write(f"{index}\n")
                subtitle_file.write(f"{vtt_timestamp(segment.start)} --> {vtt_timestamp(segment.end)}\n")
                subtitle_file.write(f"{text}\n\n")
        print(f"Saved {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
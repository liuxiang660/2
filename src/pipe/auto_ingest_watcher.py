import json
import os
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Set

from extract_product_pipe import main_pipeline


BASE_DIR = Path(__file__).resolve().parent
WATCH_DIR = Path(os.getenv("PIPE_WATCH_DIR", str(BASE_DIR / "incoming_news")))
ARCHIVE_DIR = Path(os.getenv("PIPE_ARCHIVE_DIR", str(BASE_DIR / "processed_news")))
FAILED_DIR = Path(os.getenv("PIPE_FAILED_DIR", str(BASE_DIR / "failed_news")))
OUTPUT_DIR = Path(os.getenv("PIPE_OUTPUT_DIR", str(BASE_DIR / "auto_outputs")))
STATE_FILE = Path(os.getenv("PIPE_WATCH_STATE", str(BASE_DIR / ".watcher_state.json")))
POLL_SECONDS = int(os.getenv("PIPE_WATCH_POLL_SECONDS", "10"))
STABLE_SECONDS = int(os.getenv("PIPE_WATCH_STABLE_SECONDS", "8"))


def ensure_dirs() -> None:
    WATCH_DIR.mkdir(parents=True, exist_ok=True)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    FAILED_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> Set[str]:
    if not STATE_FILE.exists():
        return set()
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("processed"), list):
            return set(str(x) for x in data["processed"])
    except Exception:
        pass
    return set()


def save_state(processed: Set[str]) -> None:
    payload: Dict[str, object] = {
        "processed": sorted(processed),
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }
    STATE_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def file_fingerprint(path: Path) -> str:
    stat = path.stat()
    return f"{path.name}|{int(stat.st_size)}|{int(stat.st_mtime)}"


def is_stable(path: Path, stable_seconds: int) -> bool:
    age = time.time() - path.stat().st_mtime
    return age >= stable_seconds


def safe_move(src: Path, dst_dir: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = dst_dir / f"{src.stem}_{ts}{src.suffix}"
    shutil.move(str(src), str(dst))
    return dst


def process_one_file(news_file: Path) -> None:
    output_file = OUTPUT_DIR / f"{news_file.stem}_pipeline_result.json"
    print(f"\n[WATCHER] Processing: {news_file}")
    print(f"[WATCHER] Output will be saved to: {output_file}")

    main_pipeline(
        news_path=str(news_file),
        hs_path=str(BASE_DIR / "hs_table.xlsx"),
        gpc_path=str(BASE_DIR / "gpc_table.xlsx"),
        output_path=str(output_file),
    )


def run_watcher() -> None:
    ensure_dirs()
    processed = load_state()

    print("=" * 72)
    print("[WATCHER] News watcher started")
    print(f"[WATCHER] WATCH_DIR    : {WATCH_DIR}")
    print(f"[WATCHER] ARCHIVE_DIR  : {ARCHIVE_DIR}")
    print(f"[WATCHER] FAILED_DIR   : {FAILED_DIR}")
    print(f"[WATCHER] OUTPUT_DIR   : {OUTPUT_DIR}")
    print(f"[WATCHER] POLL_SECONDS : {POLL_SECONDS}")
    print(f"[WATCHER] STABLE_SECONDS: {STABLE_SECONDS}")
    print("=" * 72)

    while True:
        try:
            candidates = sorted(WATCH_DIR.glob("*.jsonl"))
            if not candidates:
                time.sleep(POLL_SECONDS)
                continue

            for news_file in candidates:
                try:
                    if not news_file.is_file():
                        continue
                    if not is_stable(news_file, STABLE_SECONDS):
                        continue

                    fp = file_fingerprint(news_file)
                    if fp in processed:
                        continue

                    process_one_file(news_file)
                    archived = safe_move(news_file, ARCHIVE_DIR)
                    processed.add(fp)
                    save_state(processed)
                    print(f"[WATCHER] Success. Archived to: {archived}")
                except Exception as e:
                    try:
                        failed = safe_move(news_file, FAILED_DIR)
                        print(f"[WATCHER] Failed. Moved to: {failed}")
                    except Exception:
                        pass
                    print(f"[WATCHER] Error processing {news_file.name}: {e}")

            time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            print("\n[WATCHER] Stopped by user")
            break
        except Exception as e:
            print(f"[WATCHER] Loop error: {e}")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    run_watcher()

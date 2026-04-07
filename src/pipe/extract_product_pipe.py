import json
import re
import time
import math
import os
from typing import Dict, List, Optional
import pandas as pd
from tqdm import tqdm
import requests


def _load_env_file(path: str) -> None:
    """轻量读取 .env 文件，避免额外依赖。"""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV_CANDIDATES = [
    os.path.join(os.getcwd(), ".env.local"),
    os.path.join(os.getcwd(), ".env"),
    os.path.normpath(os.path.join(_CURRENT_DIR, "..", "..", ".env.local")),
    os.path.normpath(os.path.join(_CURRENT_DIR, "..", "..", ".env")),
]
for _env_path in _ENV_CANDIDATES:
    _load_env_file(_env_path)


def _resolve_data_path(path: str) -> str:
    """将相对路径解析到当前脚本目录，保证可在任意工作目录运行。"""
    if os.path.isabs(path):
        return path
    return os.path.normpath(os.path.join(_CURRENT_DIR, path))


# =========================
# 全局配置（独立出来，方便修改）
# =========================
LLM_API_BASE = os.getenv("LLM_API_BASE", "https://dashscope.aliyuncs.com/compatible-mode/v1")
LLM_API_URL = f"{LLM_API_BASE.rstrip('/')}/chat/completions"
LLM_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("DASHSCOPE_API_KEY")
LLM_MODEL = os.getenv("OPENAI_MODEL", "qwen-plus")
LLM_API_TIMEOUT = 300
LLM_MAX_TOKENS_EXTRACT = 128  # 实体提取用
LLM_MAX_TOKENS_LEVEL = 192  # 单层级匹配用
API_RETRY_TIMES = 2
CONFIDENCE_THRESHOLD = 0.7
PROCESS_NEWS_COUNT = 5
PIPELINE_ORG_ID = os.getenv("PIPELINE_ORGANIZATION_ID", "00000000-0000-0000-0000-000000000001")
DB_WRITE_ENABLED = os.getenv("PIPELINE_DB_WRITE", "true").lower() in {"1", "true", "yes", "on"}
LLM_TRACE_ENABLED = os.getenv("PIPELINE_LLM_TRACE", "false").lower() in {"1", "true", "yes", "on"}
LLM_DEBUG_LOG = os.getenv("PIPELINE_LLM_DEBUG_LOG", "").strip()

LLM_STATS = {
    "calls": 0,
    "success": 0,
    "fail": 0,
    "retries": 0,
    "total_latency_ms": 0,
    "total_prompt_chars": 0,
    "total_completion_chars": 0,
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0,
}


# =========================
# 基础工具模块（独立，不依赖业务逻辑）
# =========================
def call_qwen_api(prompt: str, max_tokens: int, retry=API_RETRY_TIMES) -> str:
    """统一封装云端Qwen API调用，带重试机制"""
    if not LLM_API_KEY:
        raise RuntimeError("未检测到云端 API Key，请设置 OPENAI_API_KEY 或 DASHSCOPE_API_KEY")

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are an information extraction assistant. Follow user's format instructions strictly and return only requested output."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": max_tokens,
        "temperature": 0.0,
        "top_p": 1.0,
        "stream": False
    }
    LLM_STATS["total_prompt_chars"] += len(prompt or "")

    attempts_left = retry + 1
    last_error = None
    while attempts_left > 0:
        LLM_STATS["calls"] += 1
        started = time.time()
        try:
            response = requests.post(
                LLM_API_URL,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {LLM_API_KEY}"
                },
                timeout=LLM_API_TIMEOUT
            )
            elapsed_ms = int((time.time() - started) * 1000)
            LLM_STATS["total_latency_ms"] += elapsed_ms
            response.raise_for_status()

            body = response.json()
            usage = body.get("usage", {}) if isinstance(body, dict) else {}
            LLM_STATS["prompt_tokens"] += int(usage.get("prompt_tokens", 0) or 0)
            LLM_STATS["completion_tokens"] += int(usage.get("completion_tokens", 0) or 0)
            LLM_STATS["total_tokens"] += int(usage.get("total_tokens", 0) or 0)

            content = body.get("choices", [{}])[0].get("message", {}).get("content", "") if isinstance(body, dict) else ""
            content = content.strip() if isinstance(content, str) else ""
            LLM_STATS["total_completion_chars"] += len(content)
            LLM_STATS["success"] += 1

            if LLM_TRACE_ENABLED:
                print(
                    f"[LLM] model={LLM_MODEL} latency={elapsed_ms}ms "
                    f"prompt_chars={len(prompt or '')} completion_chars={len(content)}"
                )

            if LLM_DEBUG_LOG:
                try:
                    log_line = {
                        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "model": LLM_MODEL,
                        "latency_ms": elapsed_ms,
                        "prompt_chars": len(prompt or ""),
                        "completion_chars": len(content),
                        "usage": usage,
                        "completion_preview": content[:200],
                    }
                    with open(LLM_DEBUG_LOG, "a", encoding="utf-8") as lf:
                        lf.write(json.dumps(log_line, ensure_ascii=False) + "\n")
                except Exception:
                    pass

            return content
        except Exception as e:
            elapsed_ms = int((time.time() - started) * 1000)
            LLM_STATS["total_latency_ms"] += elapsed_ms
            last_error = e
            attempts_left -= 1
            if attempts_left > 0:
                LLM_STATS["retries"] += 1
                time.sleep(0.5)
                continue

    LLM_STATS["fail"] += 1
    if LLM_TRACE_ENABLED and last_error is not None:
        print(f"[LLM] request failed after retries: {last_error}")
    return ""


def print_llm_usage_summary() -> None:
    calls = int(LLM_STATS.get("calls", 0) or 0)
    if calls == 0:
        print("🤖 LLM summary: no calls")
        return

    success = int(LLM_STATS.get("success", 0) or 0)
    fail = int(LLM_STATS.get("fail", 0) or 0)
    retries = int(LLM_STATS.get("retries", 0) or 0)
    total_latency = int(LLM_STATS.get("total_latency_ms", 0) or 0)
    avg_latency = total_latency / max(calls, 1)

    print("🤖 LLM usage summary:")
    print(f"  - model: {LLM_MODEL}")
    print(f"  - endpoint: {LLM_API_URL}")
    print(f"  - calls: {calls}, success: {success}, fail: {fail}, retries: {retries}")
    print(f"  - avg latency: {avg_latency:.1f} ms")
    print(f"  - prompt chars: {LLM_STATS['total_prompt_chars']}, completion chars: {LLM_STATS['total_completion_chars']}")
    if int(LLM_STATS.get("total_tokens", 0) or 0) > 0:
        print(
            f"  - tokens: prompt={LLM_STATS['prompt_tokens']}, "
            f"completion={LLM_STATS['completion_tokens']}, total={LLM_STATS['total_tokens']}"
        )
    else:
        print("  - tokens: not returned by provider")


def extract_json(text: str) -> Optional[Dict]:
    """健壮的JSON提取函数，处理模型输出不规范的情况"""
    if not text or not isinstance(text, str):
        return None
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and start < end:
        candidate = text[start:end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end != -1 and start < end:
        candidate = text[start:end + 1]
        try:
            arr = json.loads(candidate)
            if isinstance(arr, list):
                return {"matches": arr}
        except json.JSONDecodeError:
            pass
    return None


def _supabase_auth_headers() -> Optional[Dict[str, str]]:
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
    )
    if not supabase_url or not supabase_key:
        return None
    return {
        "url": supabase_url.rstrip("/"),
        "headers": {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
        },
    }


def _supabase_table_exists(base_url: str, headers: Dict[str, str], table: str) -> bool:
    try:
        url = f"{base_url}/rest/v1/{table}"
        resp = requests.get(url, headers=headers, params={"select": "id", "limit": 1}, timeout=20)
        return resp.status_code in (200, 206)
    except Exception:
        return False


def _supabase_post_with_fallback(
    url: str,
    headers: Dict[str, str],
    payload_variants: List[Dict],
    timeout_sec: int = 12,
) -> bool:
    for payload in payload_variants:
        try:
            resp = requests.post(
                url,
                headers={**headers, "Prefer": "return=representation"},
                json=payload,
                timeout=timeout_sec,
            )
            if 200 <= resp.status_code < 300:
                return True
        except Exception:
            continue
    return False


def _supabase_patch_with_fallback(
    url: str,
    headers: Dict[str, str],
    params: Dict[str, str],
    payload_variants: List[Dict],
    timeout_sec: int = 12,
) -> bool:
    for payload in payload_variants:
        try:
            resp = requests.patch(
                url,
                headers={**headers, "Prefer": "return=representation"},
                params=params,
                json=payload,
                timeout=timeout_sec,
            )
            if 200 <= resp.status_code < 300:
                return True
        except Exception:
            continue
    return False


def _derive_severity(news_result: Dict) -> str:
    product_matches = news_result.get("product_matches", [])
    if not product_matches:
        return "info"
    hs_failed = sum(1 for x in product_matches if x.get("hs_hierarchical_result", {}).get("match_status") != "success")
    fail_ratio = hs_failed / max(len(product_matches), 1)
    if fail_ratio >= 0.8:
        return "warning"
    if fail_ratio >= 0.5:
        return "info"
    return "info"


def _derive_confidence_score(news_result: Dict) -> int:
    product_matches = news_result.get("product_matches", [])
    if not product_matches:
        return 60
    scores: List[float] = []
    for item in product_matches:
        hs = item.get("hs_hierarchical_result", {})
        gpc = item.get("gpc_hierarchical_result", {})
        scores.extend([
            float(hs.get("level1", {}).get("confidence", 0.0) or 0.0),
            float(hs.get("level2", {}).get("confidence", 0.0) or 0.0),
            float(hs.get("level3", {}).get("confidence", 0.0) or 0.0),
            float(gpc.get("segment", {}).get("confidence", 0.0) or 0.0),
            float(gpc.get("family", {}).get("confidence", 0.0) or 0.0),
            float(gpc.get("class", {}).get("confidence", 0.0) or 0.0),
            float(gpc.get("brick", {}).get("confidence", 0.0) or 0.0),
        ])
    avg = sum(scores) / max(len(scores), 1)
    return max(1, min(100, int(round(avg * 100))))


def _looks_like_code(value: str) -> bool:
    """判断字符串是否更像编码而不是自然语言名称。"""
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not text:
        return False
    if re.search(r"\s", text):
        return False
    # 兼容常见编码格式：纯数字或字母数字短串（HS/GPC/内部码）
    return bool(re.fullmatch(r"[A-Za-z0-9._-]{4,32}", text))


def _normalize_product_match_fields(product_match: Dict) -> Dict[str, Optional[str]]:
    """从层级匹配结果中提取名称和可用编码，避免名称误写到code字段。"""
    hs = product_match.get("hs_hierarchical_result", {})
    gpc = product_match.get("gpc_hierarchical_result", {})

    hs_name = hs.get("level3", {}).get("matched_name") or hs.get("level2", {}).get("matched_name")
    gpc_name = gpc.get("brick", {}).get("matched_name") or gpc.get("class", {}).get("matched_name")

    hs_code = hs_name if _looks_like_code(str(hs_name or "")) else None
    gpc_code = gpc_name if _looks_like_code(str(gpc_name or "")) else None

    return {
        "hs_name": str(hs_name).strip() if hs_name else None,
        "gpc_name": str(gpc_name).strip() if gpc_name else None,
        "hs_code": hs_code,
        "gpc_code": gpc_code,
    }


def persist_results_to_database(all_results: List[Dict], organization_id: str = PIPELINE_ORG_ID) -> Dict[str, int]:
    """将管道结果写入现有业务表（仅写保守可用字段）。"""
    auth = _supabase_auth_headers()
    if not auth:
        print("⚠️  DB write skipped: SUPABASE_URL / SUPABASE key 未配置")
        return {"events_upserted": 0, "products_upserted": 0, "sources_upserted": 0}

    base_url = auth["url"]
    headers = auth["headers"]

    has_events = _supabase_table_exists(base_url, headers, "events")
    has_products = _supabase_table_exists(base_url, headers, "products")
    has_event_sources = _supabase_table_exists(base_url, headers, "event_sources")

    counters = {"events_upserted": 0, "products_upserted": 0, "sources_upserted": 0}

    for news_result in all_results:
        news_meta = news_result.get("news_metadata", {})
        title = str(news_meta.get("title", "")).strip()
        content = str(news_meta.get("content", "")).strip()
        source_name = str(news_meta.get("source", "")).strip() or "pipeline"
        source_url = str(news_meta.get("url", "")).strip()
        occurred_at = str(news_meta.get("date", "")).strip() or time.strftime("%Y-%m-%d")

        event_id = None

        if has_events and title:
            try:
                find_url = f"{base_url}/rest/v1/events"
                find_resp = requests.get(
                    find_url,
                    headers=headers,
                    params={
                        "select": "id",
                        "organization_id": f"eq.{organization_id}",
                        "title": f"eq.{title}",
                        "limit": 1,
                    },
                    timeout=20,
                )
                find_resp.raise_for_status()
                existing = find_resp.json() if isinstance(find_resp.json(), list) else []

                # 仅写核心公共字段，避免不同库结构下字段不兼容
                payload = {
                    "organization_id": organization_id,
                    "title": title,
                    "description": content[:6000] if content else None,
                    "occurred_at": occurred_at,
                }

                if existing:
                    event_id = str(existing[0].get("id"))
                    patch_url = f"{base_url}/rest/v1/events"
                    patch_resp = requests.patch(
                        patch_url,
                        headers={**headers, "Prefer": "return=representation"},
                        params={"id": f"eq.{event_id}"},
                        json=payload,
                        timeout=20,
                    )
                    patch_resp.raise_for_status()
                    counters["events_upserted"] += 1
                else:
                    post_url = f"{base_url}/rest/v1/events"
                    post_resp = requests.post(
                        post_url,
                        headers={**headers, "Prefer": "return=representation"},
                        json=payload,
                        timeout=20,
                    )
                    post_resp.raise_for_status()
                    data = post_resp.json() if isinstance(post_resp.json(), list) else []
                    if data:
                        event_id = str(data[0].get("id"))
                    counters["events_upserted"] += 1
            except Exception as e:
                print(f"⚠️  events upsert failed: {title[:40]}... | {e}")

        if has_event_sources and event_id and (source_name or source_url):
            try:
                find_url = f"{base_url}/rest/v1/event_sources"
                find_resp = requests.get(
                    find_url,
                    headers=headers,
                    params={
                        "select": "id",
                        "event_id": f"eq.{event_id}",
                        "source_name": f"eq.{source_name}",
                        "limit": 1,
                    },
                    timeout=20,
                )
                find_resp.raise_for_status()
                existing = find_resp.json() if isinstance(find_resp.json(), list) else []

                source_payload = {
                    "event_id": event_id,
                    "source_name": source_name,
                    "source_url": source_url or None,
                }

                if existing:
                    sid = str(existing[0].get("id"))
                    ok = _supabase_patch_with_fallback(
                        find_url,
                        headers,
                        {"id": f"eq.{sid}"},
                        [
                            source_payload,
                            {
                                "source_name": source_name,
                                "source_url": source_url or None,
                            },
                            {
                                "source_url": source_url or None,
                            },
                        ],
                    )
                    if not ok:
                        raise RuntimeError("event_sources patch payload 不兼容")
                else:
                    ok = _supabase_post_with_fallback(
                        find_url,
                        headers,
                        [
                            source_payload,
                            {
                                "event_id": event_id,
                                "source_name": source_name,
                                "source_url": source_url or None,
                            },
                            {
                                "event_id": event_id,
                                "source_url": source_url or None,
                            },
                        ],
                    )
                    if not ok:
                        raise RuntimeError("event_sources insert payload 不兼容")
                counters["sources_upserted"] += 1
            except Exception as e:
                print(f"⚠️  event_sources upsert failed: {title[:40]}... | {e}")

        if has_products:
            for pm in news_result.get("product_matches", []):
                try:
                    product_name = str(pm.get("product_name", "")).strip()
                    if not product_name:
                        continue
                    hs = pm.get("hs_hierarchical_result", {})
                    gpc = pm.get("gpc_hierarchical_result", {})
                    normalized = _normalize_product_match_fields(pm)
                    hs_code = normalized.get("hs_code") or ""
                    gpc_code = normalized.get("gpc_code") or ""
                    category = gpc.get("segment", {}).get("matched_name") or "Unknown"

                    find_url = f"{base_url}/rest/v1/products"
                    find_resp = requests.get(
                        find_url,
                        headers=headers,
                        params={
                            "select": "id",
                            "organization_id": f"eq.{organization_id}",
                            "name": f"eq.{product_name}",
                            "limit": 1,
                        },
                        timeout=20,
                    )
                    find_resp.raise_for_status()
                    existing = find_resp.json() if isinstance(find_resp.json(), list) else []

                    # products 仅写可确认字段：组织、名称；编码仅在像编码时才写
                    product_payload = {
                        "organization_id": organization_id,
                        "name": product_name,
                    }
                    if isinstance(hs_code, str) and hs_code:
                        product_payload["hs_code"] = hs_code[:128]
                    if isinstance(gpc_code, str) and gpc_code:
                        product_payload["gpc_code"] = gpc_code[:128]
                    if isinstance(category, str) and category:
                        product_payload["category"] = category[:128]

                    if existing:
                        pid = str(existing[0].get("id"))
                        ok = _supabase_patch_with_fallback(
                            find_url,
                            headers,
                            {"id": f"eq.{pid}"},
                            [
                                product_payload,
                                {
                                    "name": product_name,
                                    "hs_code": hs_code[:128] if isinstance(hs_code, str) and hs_code else None,
                                    "gpc_code": gpc_code[:128] if isinstance(gpc_code, str) and gpc_code else None,
                                    "category": category[:128] if isinstance(category, str) else None,
                                },
                                {"name": product_name},
                            ],
                        )
                        if not ok:
                            raise RuntimeError("products patch payload 不兼容")
                    else:
                        ok = _supabase_post_with_fallback(
                            find_url,
                            headers,
                            [
                                product_payload,
                                {
                                    "organization_id": organization_id,
                                    "name": product_name,
                                    "hs_code": hs_code[:128] if isinstance(hs_code, str) and hs_code else None,
                                    "gpc_code": gpc_code[:128] if isinstance(gpc_code, str) and gpc_code else None,
                                    "category": category[:128] if isinstance(category, str) else None,
                                },
                                {
                                    "organization_id": organization_id,
                                    "name": product_name,
                                },
                            ],
                        )
                        if not ok:
                            raise RuntimeError("products insert payload 不兼容")
                    counters["products_upserted"] += 1
                except Exception as e:
                    print(f"⚠️  products upsert failed: {str(pm.get('product_name', ''))[:40]}... | {e}")

    return counters


class SimpleBM25:
    """极简BM25实现：从候选列表中检索与query最相关的Top-K项"""

    def __init__(self, candidates: List[str]):
        self.candidates = candidates
        self.avg_dl = sum(len(c.split()) for c in candidates) / len(candidates) if candidates else 0
        self.doc_freq = {}
        for cand in candidates:
            for word in set(self._tokenize(cand)):
                self.doc_freq[word] = self.doc_freq.get(word, 0) + 1

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'[a-zA-Z0-9]+', text.lower())

    def _score(self, query: str, candidate: str) -> float:
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return 0.0
        score = 0.0
        for q in query_tokens:
            tf = candidate.lower().count(q)
            idf = math.log((len(self.candidates) - self.doc_freq.get(q, 0) + 0.5) /
                           (self.doc_freq.get(q, 0) + 0.5) + 1)
            score += idf * (tf * (1.2 + 1) / (tf + 1.2 * (1 - 0.75 + 0.75 * len(candidate.split()) / self.avg_dl)))
        return score

    def retrieve(self, query: str, top_k: int = 20) -> List[str]:
        scored = [(self._score(query, cand), cand) for cand in self.candidates]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [cand for _, cand in scored[:top_k]]


# =========================
# 步骤1：数据加载与预处理（单职责：只负责加载和构建层级字典）
# =========================
def step1_load_and_preprocess_data(
        news_path: str,
        hs_path: str,
        gpc_path: str
) -> Dict:
    """
    步骤1：加载所有数据并预处理成层级字典
    输入：三个数据文件的路径
    输出：预处理好的完整数据字典
    """
    # 1.1 加载新闻数据
    print("📥 Step 1: Loading and preprocessing data...")
    news = []
    with open(news_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                news.append(json.loads(line))
                if len(news) >= PROCESS_NEWS_COUNT:
                    break
            except json.JSONDecodeError:
                continue
    print(f"  ✅ Loaded {len(news)} news items")

    # 1.2 加载HS表并构建层级字典
    hs_df = pd.read_excel(hs_path)
    # 请根据你的实际Excel列名修改这里！
    hs_required_cols = ["HS_Level1", "HS_Level2", "HS_Level3"]
    for col in hs_required_cols:
        if col not in hs_df.columns:
            raise ValueError(f"HS Excel表缺少必要列：{col}，请检查列名")
    hs_hierarchy = {}
    hs_unique = hs_df[hs_required_cols].dropna().drop_duplicates()
    for _, row in hs_unique.iterrows():
        l1, l2, l3 = row["HS_Level1"].strip(), row["HS_Level2"].strip(), row["HS_Level3"].strip()
        if l1 not in hs_hierarchy: hs_hierarchy[l1] = {"level2": {}}
        if l2 not in hs_hierarchy[l1]["level2"]: hs_hierarchy[l1]["level2"][l2] = {"level3": []}
        if l3 not in hs_hierarchy[l1]["level2"][l2]["level3"]: hs_hierarchy[l1]["level2"][l2]["level3"].append(l3)
    print(f"  ✅ HS hierarchy built: {len(hs_hierarchy)} 大类")

    # 1.3 加载GPC表并构建层级字典
    gpc_df = pd.read_excel(gpc_path)
    gpc_required_cols = ["SegmentTitle", "FamilyTitle", "ClassTitle", "BrickTitle"]
    for col in gpc_required_cols:
        if col not in gpc_df.columns:
            raise ValueError(f"GPC Excel表缺少必要列：{col}，请检查列名")
    gpc_hierarchy = {}
    gpc_unique = gpc_df[gpc_required_cols].dropna().drop_duplicates()
    for _, row in gpc_unique.iterrows():
        seg, fam, cls, brick = row["SegmentTitle"].strip(), row["FamilyTitle"].strip(), row["ClassTitle"].strip(), row[
            "BrickTitle"].strip()
        if seg not in gpc_hierarchy: gpc_hierarchy[seg] = {"families": {}}
        if fam not in gpc_hierarchy[seg]["families"]: gpc_hierarchy[seg]["families"][fam] = {"classes": {}}
        if cls not in gpc_hierarchy[seg]["families"][fam]["classes"]: gpc_hierarchy[seg]["families"][fam]["classes"][
            cls] = {"bricks": []}
        if brick not in gpc_hierarchy[seg]["families"][fam]["classes"][cls]["bricks"]:
         gpc_hierarchy[seg]["families"][fam]["classes"][cls]["bricks"].append(brick)
    print(f"  ✅ GPC hierarchy built: {len(gpc_hierarchy)} Segment")

    return {
        "news": news,
        "hs_hierarchy": hs_hierarchy,
        "gpc_hierarchy": gpc_hierarchy
    }


# =========================
# 步骤2：大模型自由提取产品实体（单职责：只负责从新闻里提取产品）
# =========================
def step2_extract_products_from_news(news_text: str) -> List[str]:
    """
    步骤2：从单条新闻文本中自由提取产品实体
    输入：单条新闻的完整文本
    输出：提取到的产品实体列表
    """
    prompt = f"""
### STRICT INSTRUCTION
From the news text below, EXTRACT ONLY PHYSICAL, TRADEABLE PRODUCTS/EQUIPMENT/GOODS.
- DO NOT include people, places, organizations, events, policies, dates, abstract concepts.
- Output ONLY a JSON array of product names, no extra text.
- If NO products, output EXACTLY []

### NEWS TEXT
{news_text[:1500]}

### OUTPUT FORMAT (JSON ONLY)
["Product 1", "Product 2", ...]
"""
    model_output = call_qwen_api(prompt, LLM_MAX_TOKENS_EXTRACT)
    result_json = extract_json(model_output)

    if result_json and isinstance(result_json, list):
        return [p.strip() for p in result_json if p.strip()]
    if result_json and "matches" in result_json and isinstance(result_json["matches"], list):
        return [p.strip() for p in result_json["matches"] if p.strip()]
    return []


# =========================
# 步骤3：HS三层严格层级匹配（单职责：只负责HS三层匹配）
# =========================
def step3_hs_hierarchical_matching(
        product_name: str,
        hs_hierarchy: Dict
) -> Dict:
    """
    步骤3：对单个产品执行HS三层严格层级匹配
    输入：单个产品名称、HS层级字典
    输出：HS三层匹配的完整结果
    """
    final_result = {
        "level1": {"matched_name": None, "confidence": 0.0, "reason": ""},
        "level2": {"matched_name": None, "confidence": 0.0, "reason": ""},
        "level3": {"matched_name": None, "confidence": 0.0, "reason": ""},
        "match_status": "failed",
        "fail_reason": ""
    }

    # 通用层级匹配子函数（避免重复代码）
    def _match_single_level(
            prod_name: str,
            all_candidates: List[str],
            level_name: str
    ) -> Optional[Dict]:
        if not all_candidates:
            return None
        bm25 = SimpleBM25(all_candidates)
        candidates = bm25.retrieve(prod_name, top_k=20)
        candidates_fmt = "\n".join([f"{i + 1}. {cand}" for i, cand in enumerate(candidates)])
        prompt = f"""
### STRICT INSTRUCTION: OUTPUT ONLY VALID JSON
Match the product to the most suitable {level_name} from the candidates list below.
- ONLY select from the given candidates, NO invented names
- Output ONLY JSON with the exact format below
- If no match, set matched_name to null and confidence to 0.0

### PRODUCT NAME
{prod_name}

### {level_name} CANDIDATES
{candidates_fmt}

### OUTPUT FORMAT (JSON ONLY)
{{
  "matched_name": "exact candidate name from list",
  "confidence": 0.0-1.0,
  "reason": "short match reason"
}}

### CRITICAL: STOP IMMEDIATELY AFTER CLOSING BRACE }}.
"""
        output = call_qwen_api(prompt, LLM_MAX_TOKENS_LEVEL)
        return extract_json(output)

    # 3.1 HS Level1 匹配
    all_level1 = list(hs_hierarchy.keys())
    level1_json = _match_single_level(product_name, all_level1, "HS Level 1 (大类)")
    if not level1_json:
        final_result["fail_reason"] = "HS Level1匹配模型输出异常"
        return final_result
    level1_name = level1_json.get("matched_name")
    level1_conf = level1_json.get("confidence", 0.0)
    final_result["level1"] = level1_json
    if not level1_name or level1_conf < CONFIDENCE_THRESHOLD or level1_name not in hs_hierarchy:
        final_result["fail_reason"] = f"HS Level1匹配置信度{level1_conf:.2f}，低于阈值"
        return final_result

    # 3.2 HS Level2 匹配（仅在Level1下）
    level1_data = hs_hierarchy[level1_name]
    all_level2 = list(level1_data["level2"].keys())
    level2_json = _match_single_level(product_name, all_level2, "HS Level 2 (中类)")
    if not level2_json:
        final_result["fail_reason"] = "HS Level2匹配模型输出异常"
        return final_result
    level2_name = level2_json.get("matched_name")
    level2_conf = level2_json.get("confidence", 0.0)
    final_result["level2"] = level2_json
    if not level2_name or level2_conf < CONFIDENCE_THRESHOLD or level2_name not in level1_data["level2"]:
        final_result["fail_reason"] = f"HS Level2匹配置信度{level2_conf:.2f}，低于阈值"
        return final_result

    # 3.3 HS Level3 匹配（仅在Level2下）
    level2_data = level1_data["level2"][level2_name]
    all_level3 = level2_data["level3"]
    level3_json = _match_single_level(product_name, all_level3, "HS Level 3 (小类)")
    if not level3_json:
        final_result["fail_reason"] = "HS Level3匹配模型输出异常"
        return final_result
    level3_name = level3_json.get("matched_name")
    level3_conf = level3_json.get("confidence", 0.0)
    final_result["level3"] = level3_json

    if level3_name and level3_conf >= CONFIDENCE_THRESHOLD:
        final_result["match_status"] = "success"
        final_result["fail_reason"] = "HS三层级匹配完成"
    else:
        final_result["fail_reason"] = f"HS Level3匹配置信度{level3_conf:.2f}，低于阈值"

    return final_result


# =========================
# 步骤4：GPC四层严格层级匹配（单职责：只负责GPC四层匹配）
# =========================
def step4_gpc_hierarchical_matching(
        product_name: str,
        gpc_hierarchy: Dict
) -> Dict:
    """
    步骤4：对单个产品执行GPC四层严格层级匹配
    输入：单个产品名称、GPC层级字典
    输出：GPC四层匹配的完整结果
    """
    final_result = {
        "segment": {"matched_name": None, "confidence": 0.0, "reason": ""},
        "family": {"matched_name": None, "confidence": 0.0, "reason": ""},
        "class": {"matched_name": None, "confidence": 0.0, "reason": ""},
        "brick": {"matched_name": None, "confidence": 0.0, "reason": ""},
        "match_status": "failed",
        "fail_reason": ""
    }

    # 通用层级匹配子函数（复用）
    def _match_single_level(
            prod_name: str,
            all_candidates: List[str],
            level_name: str
    ) -> Optional[Dict]:
        if not all_candidates:
            return None
        bm25 = SimpleBM25(all_candidates)
        candidates = bm25.retrieve(prod_name, top_k=20)
        candidates_fmt = "\n".join([f"{i + 1}. {cand}" for i, cand in enumerate(candidates)])
        prompt = f"""
### STRICT INSTRUCTION: OUTPUT ONLY VALID JSON
Match the product to the most suitable {level_name} from the candidates list below.
- ONLY select from the given candidates, NO invented names
- Output ONLY JSON with the exact format below
- If no match, set matched_name to null and confidence to 0.0

### PRODUCT NAME
{prod_name}

### {level_name} CANDIDATES
{candidates_fmt}

### OUTPUT FORMAT (JSON ONLY)
{{
  "matched_name": "exact candidate name from list",
  "confidence": 0.0-1.0,
  "reason": "short match reason"
}}

### CRITICAL: STOP IMMEDIATELY AFTER CLOSING BRACE }}.
"""
        output = call_qwen_api(prompt, LLM_MAX_TOKENS_LEVEL)
        return extract_json(output)

    # 4.1 GPC Segment 匹配
    all_segments = list(gpc_hierarchy.keys())
    segment_json = _match_single_level(product_name, all_segments, "GPC Segment (大类)")
    if not segment_json:
        final_result["fail_reason"] = "GPC Segment匹配模型输出异常"
        return final_result
    segment_name = segment_json.get("matched_name")
    segment_conf = segment_json.get("confidence", 0.0)
    final_result["segment"] = segment_json
    if not segment_name or segment_conf < CONFIDENCE_THRESHOLD or segment_name not in gpc_hierarchy:
        final_result["fail_reason"] = f"GPC Segment匹配置信度{segment_conf:.2f}，低于阈值"
        return final_result

    # 4.2 GPC Family 匹配（仅在Segment下）
    segment_data = gpc_hierarchy[segment_name]
    all_families = list(segment_data["families"].keys())
    family_json = _match_single_level(product_name, all_families, "GPC Family (中类)")
    if not family_json:
        final_result["fail_reason"] = "GPC Family匹配模型输出异常"
        return final_result
    family_name = family_json.get("matched_name")
    family_conf = family_json.get("confidence", 0.0)
    final_result["family"] = family_json
    if not family_name or family_conf < CONFIDENCE_THRESHOLD or family_name not in segment_data["families"]:
        final_result["fail_reason"] = f"GPC Family匹配置信度{family_conf:.2f}，低于阈值"
        return final_result

    # 4.3 GPC Class 匹配（仅在Family下）
    family_data = segment_data["families"][family_name]
    all_classes = list(family_data["classes"].keys())
    class_json = _match_single_level(product_name, all_classes, "GPC Class (小类)")
    if not class_json:
        final_result["fail_reason"] = "GPC Class匹配模型输出异常"
        return final_result
    class_name = class_json.get("matched_name")
    class_conf = class_json.get("confidence", 0.0)
    final_result["class"] = class_json
    if not class_name or class_conf < CONFIDENCE_THRESHOLD or class_name not in family_data["classes"]:
        final_result["fail_reason"] = f"GPC Class匹配置信度{class_conf:.2f}，低于阈值"
        return final_result

    # 4.4 GPC Brick 匹配（仅在Class下）
    class_data = family_data["classes"][class_name]
    all_bricks = class_data["bricks"]
    brick_json = _match_single_level(product_name, all_bricks, "GPC Brick (细类)")
    if not brick_json:
        final_result["fail_reason"] = "GPC Brick匹配模型输出异常"
        return final_result
    brick_name = brick_json.get("matched_name")
    brick_conf = brick_json.get("confidence", 0.0)
    final_result["brick"] = brick_json

    if brick_name and brick_conf >= CONFIDENCE_THRESHOLD:
        final_result["match_status"] = "success"
        final_result["fail_reason"] = "GPC四层级匹配完成"
    else:
        final_result["fail_reason"] = f"GPC Brick匹配置信度{brick_conf:.2f}，低于阈值"

    return final_result


# =========================
# 单条新闻处理管道（自动串联步骤2-4）
# =========================
def single_news_pipeline(
        news_item: Dict,
        hs_hierarchy: Dict,
        gpc_hierarchy: Dict
) -> Dict:
    """
    单条新闻处理管道：自动串联步骤2-4
    输入：单条新闻、HS层级字典、GPC层级字典
    输出：单条新闻的完整处理结果
    """
    news_full_text = f"{news_item['title']}\n{news_item['content']}"

    news_result = {
        "news_metadata": {
            "title": news_item["title"],
            "content": news_item["content"],
            "date": news_item.get("date", ""),
            "url": news_item.get("url", "").strip(),
            "source": news_item.get("source", "")
        },
        "extracted_products": [],
        "product_matches": [],
        "extraction_status": "pending"
    }

    # 管道步骤2：提取产品
    extracted_products = step2_extract_products_from_news(news_full_text)
    news_result["extracted_products"] = extracted_products

    if not extracted_products:
        news_result["extraction_status"] = "no_products"
        return news_result

    news_result["extraction_status"] = "success"

    # 对每个产品，管道步骤3-4：HS和GPC层级匹配
    for product in extracted_products:
        hs_result = step3_hs_hierarchical_matching(product, hs_hierarchy)
        gpc_result = step4_gpc_hierarchical_matching(product, gpc_hierarchy)

        normalized_fields = _normalize_product_match_fields({
            "hs_hierarchical_result": hs_result,
            "gpc_hierarchical_result": gpc_result,
        })

        product_match_record = {
            "product_name": product,
            "hs_hierarchical_result": hs_result,
            "gpc_hierarchical_result": gpc_result,
            "normalized_fields": normalized_fields
        }
        news_result["product_matches"].append(product_match_record)
        time.sleep(0.1)  # 避免API过载

    return news_result


# =========================
# 主管道（自动串联所有步骤，批量处理）
# =========================
def main_pipeline(
        news_path: str = "news_all.jsonl",
        hs_path: str = "hs_table.xlsx",
        gpc_path: str = "gpc_table.xlsx",
        output_path: str = "news_hs_gpc_pipeline_result.json"
) -> List[Dict]:
    """
    主管道：自动串联所有步骤，批量处理所有新闻
    输入：三个数据文件的路径
    输出：所有新闻的完整处理结果列表
    """
    print("=" * 60)
    print("🚀 Starting full hierarchical matching pipeline...")
    print("=" * 60)

    news_path = _resolve_data_path(news_path)
    hs_path = _resolve_data_path(hs_path)
    gpc_path = _resolve_data_path(gpc_path)
    output_path = _resolve_data_path(output_path)

    # 管道步骤1：加载和预处理数据
    preprocessed_data = step1_load_and_preprocess_data(news_path, hs_path, gpc_path)
    news = preprocessed_data["news"]
    hs_hierarchy = preprocessed_data["hs_hierarchy"]
    gpc_hierarchy = preprocessed_data["gpc_hierarchy"]

    # 统计信息初始化
    stats = {
        "total_news": len(news),
        "news_with_products": 0,
        "news_no_products": 0,
        "total_products_extracted": 0,
        "hs_full_success": 0,
        "hs_partial_success": 0,
        "hs_failed": 0,
        "gpc_full_success": 0,
        "gpc_partial_success": 0,
        "gpc_failed": 0
    }

    # 批量处理所有新闻
    print(f"\n📝 Step 2-4: Processing {len(news)} news items...")
    all_results = []
    for idx, item in enumerate(tqdm(news, desc="Pipeline Progress")):
        title_short = item["title"][:70] + "..." if len(item["title"]) > 70 else item["title"]
        tqdm.write(f"\n--- Processing News {idx + 1}/{len(news)}: {title_short}")

        # 调用单条新闻管道
        news_result = single_news_pipeline(item, hs_hierarchy, gpc_hierarchy)
        all_results.append(news_result)

        # 更新统计信息
        if news_result["extraction_status"] == "no_products":
            stats["news_no_products"] += 1
            tqdm.write("  ❌ No products extracted")
        else:
            stats["news_with_products"] += 1
            stats["total_products_extracted"] += len(news_result["extracted_products"])
            tqdm.write(f"  ✅ Extracted {len(news_result['extracted_products'])} product(s)")

            # 更新HS和GPC统计
            for pm in news_result["product_matches"]:
                hs_res = pm["hs_hierarchical_result"]
                gpc_res = pm["gpc_hierarchical_result"]

                if hs_res["match_status"] == "success":
                    stats["hs_full_success"] += 1
                elif hs_res["level1"]["matched_name"]:
                    stats["hs_partial_success"] += 1
                else:
                    stats["hs_failed"] += 1

                if gpc_res["match_status"] == "success":
                    stats["gpc_full_success"] += 1
                elif gpc_res["segment"]["matched_name"]:
                    stats["gpc_partial_success"] += 1
                else:
                    stats["gpc_failed"] += 1

        time.sleep(0.1)

    # 保存结果
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    # 写入数据库（可通过 PIPELINE_DB_WRITE=false 关闭）
    if DB_WRITE_ENABLED:
        db_stats = persist_results_to_database(all_results)
        print(
            "💾 DB upsert summary: "
            f"events={db_stats['events_upserted']}, "
            f"products={db_stats['products_upserted']}, "
            f"sources={db_stats['sources_upserted']}"
        )
    else:
        print("ℹ️  DB write disabled by PIPELINE_DB_WRITE")

    # 打印最终统计
    print("\n" + "=" * 60)
    print("🎉 Pipeline completed!")
    print("=" * 60)
    print(f"📊 Final Statistics:")
    print(f"  - Total news processed: {stats['total_news']}")
    print(f"  - News with products extracted: {stats['news_with_products']}")
    print(f"  - News with no products: {stats['news_no_products']}")
    print(f"  - Total products extracted: {stats['total_products_extracted']}")
    print(f"  - HS full 3-level match success: {stats['hs_full_success']}")
    print(f"  - HS partial match: {stats['hs_partial_success']}")
    print(f"  - HS full match failed: {stats['hs_failed']}")
    print(f"  - GPC full 4-level match success: {stats['gpc_full_success']}")
    print(f"  - GPC partial match: {stats['gpc_partial_success']}")
    print(f"  - GPC full match failed: {stats['gpc_failed']}")
    print(f"💾 Full results saved to: {output_path}")
    print_llm_usage_summary()

    return all_results


# =========================
# 调用入口
# =========================
if __name__ == "__main__":
    # 直接调用主管道，自动串联所有步骤
    final_results = main_pipeline()
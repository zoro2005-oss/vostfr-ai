import json
import logging
from typing import Callable

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_BATCH_ITEMS = 40
MAX_BATCH_CHARS = 3000


def _translate_libretranslate(text: str, source_language: str, target_language: str) -> str:
    payload = {
        "q": text,
        "source": source_language or "auto",
        "target": target_language,
        "format": "text",
    }
    if settings.TRANSLATION_API_KEY:
        payload["api_key"] = settings.TRANSLATION_API_KEY

    with httpx.Client(timeout=30) as client:
        response = client.post(settings.TRANSLATION_API_URL, json=payload)
        response.raise_for_status()
        data = response.json()
    return data.get("translatedText") or data.get("translation") or text


def _translate_google(text: str, source_language: str, target_language: str) -> str:
    params = {
        "client": "gtx",
        "sl": source_language or "auto",
        "tl": target_language,
        "dt": "t",
        "q": text,
    }
    with httpx.Client(timeout=30, headers={"User-Agent": "Mozilla/5.0"}) as client:
        response = client.get("https://translate.googleapis.com/translate_a/single", params=params)
        response.raise_for_status()
        data = response.json()
    chunks = data[0] if data else []
    return "".join(chunk[0] for chunk in chunks if chunk and chunk[0]) or text


def _translate_groq(texts: list[str], source_language: str, target_language: str) -> list[str]:
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY manquant")

    source_label = "la langue source" if not source_language or source_language == "auto" else source_language
    system_prompt = (
        "Tu es un traducteur professionnel de sous-titres de cinéma. "
        f"Traduis chaque élément du tableau JSON fourni depuis {source_label} vers {target_language}. "
        "Conserve exactement l'ordre, le nombre d'éléments, les noms propres, le registre et le sens. "
        "Ne fusionne pas et ne divise pas les lignes. Ne commente pas. "
        'Réponds uniquement en JSON avec la forme {"translations": ["...", "..."]}.'
    )
    payload = {
        "model": settings.GROQ_TRANSLATION_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(texts, ensure_ascii=False)},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=120) as client:
        response = client.post(
            f"{settings.GROQ_API_BASE}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    translated = parsed.get("translations") if isinstance(parsed, dict) else parsed
    if not isinstance(translated, list) or len(translated) != len(texts):
        raise ValueError("Réponse de traduction Groq invalide")
    return [str(item).strip() if item else original for item, original in zip(translated, texts)]


def _active_provider() -> str:
    provider = (settings.TRANSLATION_PROVIDER or "").lower()
    if provider == "groq" and not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY absent : repli sur Google Translate")
        return "google"
    if provider == "libretranslate" and not settings.TRANSLATION_API_URL:
        logger.warning("TRANSLATION_API_URL absent : repli sur Google Translate")
        return "google"
    if provider in {"groq", "libretranslate", "google"}:
        return provider
    if settings.TRANSLATION_API_URL:
        return "libretranslate"
    return "google"


def _batches(texts: list[str]):
    batch: list[str] = []
    size = 0
    for text in texts:
        if batch and (len(batch) >= MAX_BATCH_ITEMS or size + len(text) > MAX_BATCH_CHARS):
            yield batch
            batch = []
            size = 0
        batch.append(text)
        size += len(text)
    if batch:
        yield batch


def translate_segments(
    texts: list[str],
    source_language: str,
    target_language: str,
    on_progress: Callable[[int, int], None] | None = None,
) -> list[str]:
    """Traduit une liste de segments en conservant l'ordre et la longueur."""
    if not texts or source_language == target_language:
        return list(texts)

    provider = _active_provider()
    results: list[str] = []
    total = len(texts)
    done = 0

    for batch in _batches(texts):
        translated: list[str] | None = None
        if provider == "groq":
            try:
                translated = _translate_groq(batch, source_language, target_language)
            except Exception:
                logger.exception("Échec de la traduction Groq, repli Google")
                provider = "google"

        if translated is None:
            translated = []
            for text in batch:
                try:
                    if provider == "libretranslate":
                        translated.append(_translate_libretranslate(text, source_language, target_language))
                    else:
                        translated.append(_translate_google(text, source_language, target_language))
                except Exception:
                    logger.exception("Échec de traduction d'un segment")
                    translated.append(text)

        results.extend(translated)
        done += len(batch)
        if on_progress:
            on_progress(done, total)

    return results


def translate_text(text: str, source_language: str, target_language: str) -> str:
    """Traduit un segment et renvoie l'original en cas d'échec."""
    if not text or source_language == target_language:
        return text
    try:
        return translate_segments([text], source_language, target_language)[0]
    except Exception:
        return text

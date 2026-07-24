#!/usr/bin/env python3
"""
Ethical Horizon Toolkit — Module 4: Literature Monitoring
-----------------------------------------------------------
Semi-automates Phase I "signal identification" by polling PubMed's official
E-utilities API (NIH/NLM — public, documented, no scraping of restricted
content) for recently published articles matching each biomedical subfield
plus ethics/governance keywords.

Matches are posted as *candidates* to a separate "CandidateSignals" sheet —
NOT directly into the validated "Signals" sheet — so a human still reviews
and promotes each one (matching the content-analysis + classification step
described in the proposal's Phase I methodology). Duplicate links are
rejected server-side, so this script can be re-run safely (e.g. daily via
cron) without flooding the sheet with repeats.

Setup:
    pip install requests --break-system-packages
    Set ENDPOINT_URL below to your deployed Apps Script Web App URL.

Run:
    python3 literature_monitor.py
"""

import sys
import time
from datetime import datetime, timedelta

import requests

ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbyZHESMWxHInCLWkPdNtAK6hAr4WJwT6E3ZWYUzbrvUulh0J_AlzHWBSUbsTDTTRGKM/exec"

PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"

# Persian subfield label -> PubMed search term (ethics/governance-scoped)
SUBFIELDS = {
    "ژنومیک": "genomics AND (ethics OR governance OR privacy)",
    "عصب‌فناوری": "neurotechnology AND (ethics OR governance)",
    "پزشکی دقیق": "precision medicine AND (ethics OR equity)",
    "فناوری‌های باروری": "assisted reproductive technology AND (ethics OR regulation)",
    "پژوهش ارگانوئید": "organoid research AND ethics",
    "سلامت دیجیتال": "digital health AND (ethics OR privacy OR governance)",
    "هوش مصنوعی در پزشکی": "artificial intelligence AND clinical AND (ethics OR governance OR bias)",
}

LOOKBACK_DAYS = 14          # how far back to search each run
MAX_RESULTS_PER_QUERY = 8   # keep each subfield's pull small and reviewable
REQUEST_DELAY_SECONDS = 0.4  # stays well under NCBI's 3 req/sec unauthenticated limit


def search_pubmed(term: str, days: int) -> list[str]:
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y/%m/%d")
    date_filter = f'("{since}"[PDAT] : "3000"[PDAT])'
    params = {
        "db": "pubmed",
        "term": f"{term} AND {date_filter}",
        "retmax": MAX_RESULTS_PER_QUERY,
        "retmode": "json",
        "sort": "most recent",
    }
    r = requests.get(PUBMED_ESEARCH, params=params, timeout=20)
    r.raise_for_status()
    return r.json().get("esearchresult", {}).get("idlist", [])


def fetch_summaries(pmids: list[str]) -> list[dict]:
    if not pmids:
        return []
    params = {"db": "pubmed", "id": ",".join(pmids), "retmode": "json"}
    r = requests.get(PUBMED_ESUMMARY, params=params, timeout=20)
    r.raise_for_status()
    result = r.json().get("result", {})
    return [result[pmid] for pmid in pmids if pmid in result]


def build_candidate(summary: dict, subfield: str) -> dict:
    pmid = summary.get("uid", "")
    title = summary.get("title", "").strip()
    pubdate = summary.get("pubdate", "")
    return {
        "recordType": "candidate",
        "timestamp": datetime.utcnow().isoformat(),
        "title": title,
        "description": f"چکیده/تاریخ انتشار: {pubdate}. منبع: PubMed (شناسه {pmid}).",
        "subfield": subfield,
        "sourceType": "مقاله علمی داوری‌شده",
        "sourceLink": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "submitterName": "رصد خودکار ادبیات (PubMed)",
        "submitterEmail": "",
    }


def post_candidate(candidate: dict) -> str:
    """Returns 'ok', 'duplicate', or 'error'."""
    try:
        resp = requests.post(ENDPOINT_URL, json=candidate, timeout=20)
        resp.raise_for_status()
        status = resp.json().get("status", "ok")
        return status
    except requests.RequestException as exc:
        print(f"  ! ارسال ناموفق: {exc}")
        return "error"


def main() -> None:
    if not ENDPOINT_URL or ENDPOINT_URL.startswith("PASTE_"):
        print("ابتدا ENDPOINT_URL را در این فایل تنظیم کنید.")
        sys.exit(1)

    added, duplicates, errors = 0, 0, 0

    for subfield, term in SUBFIELDS.items():
        print(f"در حال جست‌وجو: {subfield} ...")
        try:
            pmids = search_pubmed(term, LOOKBACK_DAYS)
        except requests.RequestException as exc:
            print(f"  ! خطا در جست‌وجوی PubMed: {exc}")
            continue

        for summary in fetch_summaries(pmids):
            candidate = build_candidate(summary, subfield)
            status = post_candidate(candidate)
            label = candidate["title"][:70] or "(بدون عنوان)"
            if status == "ok":
                added += 1
                print(f"  + {label}")
            elif status == "duplicate":
                duplicates += 1
                print(f"  = تکراری، رد شد: {label}")
            else:
                errors += 1
            time.sleep(REQUEST_DELAY_SECONDS)

        time.sleep(REQUEST_DELAY_SECONDS)

    print(f"\nپایان یافت. {added} کاندید جدید، {duplicates} تکراری، {errors} خطا.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Validate MineFarm Wiki content and generate the public item atlas."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "items.json"
ITEMS_DIR = ROOT / "atlas" / "items"
GENERATED_MARKER = "<!-- GENERATED FROM data/items.json. DO NOT EDIT DIRECTLY. -->"

CATEGORIES = {
    "crop": "작물",
    "mineral": "광물",
    "gathering": "채집물",
    "material": "재료",
    "processed-product": "가공품",
    "technical-product": "기술 제품",
    "tool": "도구",
    "consumable": "소비 아이템",
    "currency": "화폐·특수 재화",
    "quest": "퀘스트 아이템",
}
STATUSES = {"live", "planned", "hidden"}
TRADE_STATES = {"tradable", "restricted", "bound", "unknown"}
ID_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")


def load_items() -> dict:
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{DATA_FILE.relative_to(ROOT)} 읽기 실패: {exc}") from exc


def _text(value: object, field: str, errors: list[str], maximum: int) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{field}: 비어 있지 않은 문자열이어야 합니다.")
    elif len(value) > maximum:
        errors.append(f"{field}: {maximum}자를 넘을 수 없습니다.")


def _facts(value: object, field: str, errors: list[str]) -> None:
    if not isinstance(value, list):
        errors.append(f"{field}: 배열이어야 합니다.")
        return
    for index, fact in enumerate(value):
        prefix = f"{field}[{index}]"
        if not isinstance(fact, dict) or set(fact) != {"label", "details"}:
            errors.append(f"{prefix}: label과 details만 가져야 합니다.")
            continue
        _text(fact["label"], f"{prefix}.label", errors, 80)
        _text(fact["details"], f"{prefix}.details", errors, 240)


def validate_items(data: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict) or set(data) != {"version", "items"}:
        return ["최상위 데이터는 version과 items만 가져야 합니다."]
    if data["version"] != 1:
        errors.append("version은 1이어야 합니다.")
    if not isinstance(data["items"], list):
        return errors + ["items는 배열이어야 합니다."]

    required = {
        "id", "slug", "name", "category", "status", "public", "summary",
        "aliases", "obtain", "uses", "trade", "related",
    }
    optional = {"image", "verifiedAt", "approvedBy"}
    ids: set[str] = set()
    slugs: set[str] = set()

    for index, item in enumerate(data["items"]):
        prefix = f"items[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{prefix}: 객체여야 합니다.")
            continue
        missing = required - set(item)
        unknown = set(item) - required - optional
        if missing:
            errors.append(f"{prefix}: 필수 필드 누락: {', '.join(sorted(missing))}")
        if unknown:
            errors.append(f"{prefix}: 알 수 없는 필드: {', '.join(sorted(unknown))}")
        if missing:
            continue

        item_id = item["id"]
        slug = item["slug"]
        if not isinstance(item_id, str) or not ID_RE.fullmatch(item_id):
            errors.append(f"{prefix}.id: 소문자 영문·숫자·밑줄 형식이어야 합니다.")
        elif item_id in ids:
            errors.append(f"{prefix}.id: 중복된 ID입니다: {item_id}")
        else:
            ids.add(item_id)
        if not isinstance(slug, str) or not SLUG_RE.fullmatch(slug):
            errors.append(f"{prefix}.slug: 소문자 영문·숫자·하이픈 형식이어야 합니다.")
        elif slug in slugs:
            errors.append(f"{prefix}.slug: 중복된 slug입니다: {slug}")
        else:
            slugs.add(slug)

        _text(item["name"], f"{prefix}.name", errors, 80)
        _text(item["summary"], f"{prefix}.summary", errors, 240)
        if item["category"] not in CATEGORIES:
            errors.append(f"{prefix}.category: 지원하지 않는 분류입니다.")
        if item["status"] not in STATUSES:
            errors.append(f"{prefix}.status: live, planned, hidden 중 하나여야 합니다.")
        if not isinstance(item["public"], bool):
            errors.append(f"{prefix}.public: 불리언이어야 합니다.")

        aliases = item["aliases"]
        if not isinstance(aliases, list) or any(not isinstance(v, str) or not v.strip() for v in aliases):
            errors.append(f"{prefix}.aliases: 비어 있지 않은 문자열 배열이어야 합니다.")
        elif len(aliases) != len(set(aliases)):
            errors.append(f"{prefix}.aliases: 중복 값을 가질 수 없습니다.")
        _facts(item["obtain"], f"{prefix}.obtain", errors)
        _facts(item["uses"], f"{prefix}.uses", errors)

        trade = item["trade"]
        if not isinstance(trade, dict) or set(trade) != {"state", "details"}:
            errors.append(f"{prefix}.trade: state와 details만 가져야 합니다.")
        else:
            if trade["state"] not in TRADE_STATES:
                errors.append(f"{prefix}.trade.state: 지원하지 않는 거래 상태입니다.")
            if not isinstance(trade["details"], str) or len(trade["details"]) > 240:
                errors.append(f"{prefix}.trade.details: 240자 이하 문자열이어야 합니다.")

        related = item["related"]
        if not isinstance(related, list) or any(not isinstance(v, str) or not ID_RE.fullmatch(v) for v in related):
            errors.append(f"{prefix}.related: 유효한 아이템 ID 배열이어야 합니다.")
        elif len(related) != len(set(related)):
            errors.append(f"{prefix}.related: 중복 값을 가질 수 없습니다.")

        if "image" in item:
            image = item["image"]
            if not isinstance(image, dict) or set(image) != {"path", "alt"}:
                errors.append(f"{prefix}.image: path와 alt만 가져야 합니다.")
            else:
                _text(image["alt"], f"{prefix}.image.alt", errors, 160)
                image_path = image["path"]
                if not isinstance(image_path, str) or not re.fullmatch(r"\.\./\.\./assets/items/[a-z0-9/_-]+\.(png|webp)", image_path):
                    errors.append(f"{prefix}.image.path: assets/items 아래 PNG 또는 WebP 경로여야 합니다.")
                elif not (ITEMS_DIR / image_path).resolve().is_file():
                    errors.append(f"{prefix}.image.path: 파일이 없습니다: {image_path}")

        if item["public"] and item["status"] == "live":
            if item.get("approvedBy") != "Moon":
                errors.append(f"{prefix}: 공개 중인 아이템은 Moon 승인이 필요합니다.")
            try:
                date.fromisoformat(item.get("verifiedAt", ""))
            except (TypeError, ValueError):
                errors.append(f"{prefix}: 공개 중인 아이템은 verifiedAt 날짜가 필요합니다.")

    all_ids = {item.get("id") for item in data["items"] if isinstance(item, dict)}
    for index, item in enumerate(data["items"]):
        if isinstance(item, dict) and isinstance(item.get("related"), list):
            for related_id in item["related"]:
                if related_id not in all_ids:
                    errors.append(f"items[{index}].related: 존재하지 않는 ID입니다: {related_id}")
    return errors


def _facts_markdown(title: str, facts: list[dict]) -> list[str]:
    lines = [f"## {title}", ""]
    if not facts:
        return lines + ["확인된 정보가 없습니다.", ""]
    for fact in facts:
        lines.extend([f"### {fact['label']}", "", fact["details"], ""])
    return lines


def _item_page(item: dict, by_id: dict[str, dict]) -> str:
    lines = [GENERATED_MARKER, "", f"# {item['name']}", "", item["summary"], ""]
    if image := item.get("image"):
        lines.extend([f"![{image['alt']}]({image['path']})", ""])
    lines.extend(["| 항목 | 내용 |", "| --- | --- |", f"| 분류 | {CATEGORIES[item['category']]} |"])
    if item["aliases"]:
        lines.append(f"| 다른 이름 | {', '.join(item['aliases'])} |")
    lines.extend([f"| 거래 | {item['trade']['details'] or item['trade']['state']} |", f"| 확인일 | {item['verifiedAt']} |", ""])
    lines.extend(_facts_markdown("획득 방법", item["obtain"]))
    lines.extend(_facts_markdown("사용처", item["uses"]))
    public_related = [
        by_id[related_id] for related_id in item["related"]
        if by_id[related_id].get("public") and by_id[related_id].get("status") == "live"
    ]
    if public_related:
        lines.extend(["## 관련 아이템", ""])
        for related in public_related:
            lines.append(f"- [{related['name']}](./{related['slug']}.md)")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def generate_items(data: dict) -> None:
    public_items = sorted(
        (item for item in data["items"] if item["public"] and item["status"] == "live"),
        key=lambda item: (list(CATEGORIES).index(item["category"]), item["name"]),
    )
    by_id = {item["id"]: item for item in data["items"]}
    ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    expected = {"README.md", *(f"{item['slug']}.md" for item in public_items)}
    for path in ITEMS_DIR.glob("*.md"):
        if path.name not in expected and path.read_text(encoding="utf-8").startswith(GENERATED_MARKER):
            path.unlink()

    index = [
        GENERATED_MARKER, "", "# 전체 아이템", "",
        "실제 서버 정보 확인과 Moon의 공개 승인을 마친 아이템만 표시합니다.", "",
    ]
    for category, label in CATEGORIES.items():
        index.extend([f"## {label}", ""])
        matches = [item for item in public_items if item["category"] == category]
        if matches:
            for item in matches:
                index.append(f"- [{item['name']}](./{item['slug']}.md) — {item['summary']}")
        else:
            index.append("공개된 아이템이 아직 없습니다.")
        index.append("")
    (ITEMS_DIR / "README.md").write_text(
        "\n".join(index).rstrip() + "\n", encoding="utf-8", newline="\n"
    )
    for item in public_items:
        (ITEMS_DIR / f"{item['slug']}.md").write_text(
            _item_page(item, by_id), encoding="utf-8", newline="\n"
        )


def check_links() -> list[str]:
    errors: list[str] = []
    for source in ROOT.rglob("*.md"):
        if any(part in {".git", "node_modules"} for part in source.parts):
            continue
        content = source.read_text(encoding="utf-8")
        for raw_target in LINK_RE.findall(content):
            target = raw_target.strip().strip("<>").split(maxsplit=1)[0]
            if not target or target.startswith(("#", "http://", "https://", "mailto:")):
                continue
            path_part = unquote(target.split("#", 1)[0].split("?", 1)[0])
            resolved = (source.parent / path_part).resolve()
            if resolved.is_dir():
                resolved = resolved / "README.md"
            try:
                resolved.relative_to(ROOT)
            except ValueError:
                errors.append(f"{source.relative_to(ROOT)}: 위키 밖을 가리키는 링크: {raw_target}")
                continue
            if not resolved.is_file():
                errors.append(f"{source.relative_to(ROOT)}: 대상이 없는 링크: {raw_target}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("validate", "generate", "links", "check"))
    args = parser.parse_args()
    try:
        data = load_items()
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    item_errors = validate_items(data)
    if args.command in {"validate", "generate", "check"} and item_errors:
        for error in item_errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    if args.command == "generate":
        generate_items(data)
        print("아이템 도감 생성 완료")
        return 0

    link_errors = check_links() if args.command in {"links", "check"} else []
    if link_errors:
        for error in link_errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("위키 검증 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

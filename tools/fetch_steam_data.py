#!/usr/bin/env python3
"""Build games.json from Steam Store data and public reviews.

This keeps the published site static: GitHub Actions runs this script, writes
games.json, and GitHub Pages serves the generated file.
"""

from __future__ import annotations

import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "games.json"

DEFAULT_APP_IDS = [
    413150,   # Stardew Valley
    728880,   # Overcooked! 2
    1243830,  # Overcooked! All You Can Eat
    448510,   # Overcooked
    996770,   # Moving Out
    1641700,  # Moving Out 2
    945360,   # Among Us
    1568590,  # Goose Goose Duck
    1426210,  # It Takes Two
    1599600,  # PlateUp!
    477160,   # Human Fall Flat
    204360,   # Castle Crashers
    620,      # Portal 2
    341800,   # Keep Talking and Nobody Explodes
    431240,   # Golf With Your Friends
    1016920,  # Unrailed!
    674940,   # Stick Fight: The Game
    207140,   # SpeedRunners
    1794680,  # Vampire Survivors
    286160,   # Tabletop Simulator
    1364780,  # Street Fighter 6
    389730,   # TEKKEN 7
    1778820,  # TEKKEN 8
    310950,   # Street Fighter V
    1384160,  # GUILTY GEAR -STRIVE-
    678950,   # DRAGON BALL FighterZ
    383980,   # Rivals of Aether
    1086940,  # Baldur's Gate 3
    1966720,  # Lethal Company
    739630,   # Phasmophobia
    2881650,  # Content Warning
    2567870,  # Chained Together
    1943950,  # Escape the Backrooms
    602960,   # Barotrauma
    252490,   # Rust
    1172470,  # Apex Legends
    730,      # Counter-Strike 2
    570,      # Dota 2
    440,      # Team Fortress 2
    578080,   # PUBG: BATTLEGROUNDS
    2357570,  # Overwatch 2
    359550,   # Tom Clancy's Rainbow Six Siege
    1238810,  # Battlefield V
    1517290,  # Battlefield 2042
    1238840,  # Battlefield 1
    393380,   # Squad
    686810,   # Hell Let Loose
    505460,   # Foxhole
    671860,   # BattleBit Remastered
    1824220,  # Chivalry 2
    629760,   # MORDHAU
    304390,   # For Honor
    1782210,  # Crab Game
    1049590,  # Eternal Return
    444090,   # Paladins
    386360,   # SMITE
    386180,   # Crossout
    236390,   # War Thunder
    381210,   # Dead by Daylight
    322330,   # Don't Starve Together
    550,      # Left 4 Dead 2
    892970,   # Valheim
    1097150,  # Fall Guys
    291550,   # Brawlhalla
    553850,   # HELLDIVERS 2
    632360,   # Risk of Rain 2
    1282100,  # Remnant II
    617290,   # Remnant: From the Ashes
    239140,   # Dying Light
    534380,   # Dying Light 2
    552500,   # Warhammer: Vermintide 2
    1361210,  # Warhammer 40,000: Darktide
    49520,    # Borderlands 2
    397540,   # Borderlands 3
    1286680,  # Tiny Tina's Wonderlands
    582010,   # Monster Hunter: World
    1446780,  # Monster Hunter Rise
    2246340,  # Monster Hunter Wilds
    304930,   # Unturned
    548430,   # Deep Rock Galactic
    394360,   # Hearts of Iron IV
    281990,   # Stellaris
    236850,   # Europa Universalis IV
    289070,   # Sid Meier's Civilization VI
    8930,     # Sid Meier's Civilization V
    813780,   # Age of Empires II: Definitive Edition
    1466860,  # Age of Empires IV
    933110,   # Age of Empires III: Definitive Edition
    594570,   # Total War: WARHAMMER II
    1142710,  # Total War: WARHAMMER III
    105600,   # Terraria
    230410,   # Warframe
    1085660,  # Destiny 2
    238960,   # Path of Exile
    2694490,  # Path of Exile 2
    1599340,  # Lost Ark
    306130,   # The Elder Scrolls Online
    1284210,  # Guild Wars 2
    39210,    # FINAL FANTASY XIV Online
    582660,   # Black Desert
    8500,     # EVE Online
    438100,   # VRChat
    251570,   # 7 Days to Die
    346110,   # ARK: Survival Evolved
    2399830,  # ARK: Survival Ascended
    1203620,  # Enshrouded
    1604030,  # V Rising
    1623730,  # Palworld
    275850,   # No Man's Sky
    526870,   # Satisfactory
    427520,   # Factorio
    648800,   # Raft
    108600,   # Project Zomboid
    962130,   # Grounded
    1326470,  # Sons Of The Forest
    242760,   # The Forest
    1149460,  # Icarus
    768200,   # Smalland: Survive the Wilds
    815370,   # Green Hell
    2646460,  # Soulmask
    1928980,  # Nightingale
    244850,   # Space Engineers
    383120,   # Empyrion - Galactic Survival
    361420,   # ASTRONEER
    1281930,  # tModLoader
    221100,   # DayZ
    513710,   # SCUM
    218620,   # PAYDAY 2
    1272080,  # PAYDAY 3
    2073850,  # THE FINALS
    1811260,  # EA SPORTS FC 23
    2074920,  # The First Descendant
    899770,   # Last Epoch
    1172620,  # Sea of Thieves
    271590,   # Grand Theft Auto V Legacy
    4000,     # Garry's Mod
    244210,   # Assetto Corsa
    805550,   # Assetto Corsa Competizione
    1066890,  # Automobilista 2
    365960,   # rFactor 2
    690790,   # DiRT Rally 2.0
    1551360,  # Forza Horizon 5
    1222680,  # Need for Speed Heat
    359320,   # Elite Dangerous
]

MANUAL_PLAYERS = {
    413150: (1, 4),
    728880: (1, 4),
    1243830: (1, 4),
    448510: (1, 4),
    996770: (1, 4),
    1641700: (1, 4),
    945360: (4, 15),
    1568590: (4, 16),
    1426210: (2, 2),
    1599600: (1, 4),
    477160: (1, 8),
    204360: (1, 4),
    620: (1, 2),
    341800: (2, 6),
    431240: (1, 12),
    1016920: (1, 4),
    674940: (2, 4),
    207140: (1, 4),
    1794680: (1, 4),
    286160: (1, 10),
    1364780: (1, 2),
    389730: (1, 2),
    1778820: (1, 2),
    310950: (1, 2),
    1384160: (1, 2),
    678950: (1, 2),
    383980: (1, 4),
    1086940: (1, 4),
    1966720: (1, 4),
    739630: (1, 4),
    2881650: (2, 4),
    2567870: (1, 4),
    1943950: (1, 4),
    602960: (1, 16),
    252490: (1, 100),
    1172470: (1, 3),
    730: (1, 10),
    570: (1, 10),
    440: (1, 24),
    578080: (1, 4),
    2357570: (1, 5),
    359550: (1, 5),
    1238810: (1, 4),
    1517290: (1, 4),
    1238840: (1, 4),
    393380: (1, 50),
    686810: (1, 50),
    505460: (1, 100),
    671860: (1, 127),
    1824220: (1, 32),
    629760: (1, 64),
    304390: (1, 8),
    1782210: (1, 35),
    1049590: (1, 3),
    444090: (1, 5),
    386360: (1, 5),
    386180: (1, 8),
    236390: (1, 4),
    381210: (2, 5),
    322330: (1, 6),
    550: (1, 4),
    892970: (1, 10),
    1097150: (1, 4),
    291550: (1, 8),
    553850: (1, 4),
    632360: (1, 4),
    1282100: (1, 3),
    617290: (1, 3),
    239140: (1, 4),
    534380: (1, 4),
    552500: (1, 4),
    1361210: (1, 4),
    49520: (1, 4),
    397540: (1, 4),
    1286680: (1, 4),
    582010: (1, 4),
    1446780: (1, 4),
    2246340: (1, 4),
    304930: (1, 24),
    548430: (1, 4),
    394360: (1, 32),
    281990: (1, 32),
    236850: (1, 32),
    289070: (1, 12),
    8930: (1, 12),
    813780: (1, 8),
    1466860: (1, 8),
    933110: (1, 8),
    594570: (1, 2),
    1142710: (1, 8),
    105600: (1, 8),
    230410: (1, 4),
    1085660: (1, 6),
    238960: (1, 6),
    2694490: (1, 6),
    1599340: (1, 4),
    306130: (1, 12),
    1284210: (1, 5),
    39210: (1, 8),
    582660: (1, 5),
    8500: (1, 100),
    438100: (1, 40),
    251570: (1, 8),
    346110: (1, 70),
    2399830: (1, 70),
    1203620: (1, 16),
    1604030: (1, 40),
    1623730: (1, 4),
    275850: (1, 4),
    526870: (1, 4),
    427520: (1, 8),
    648800: (1, 8),
    108600: (1, 32),
    962130: (1, 4),
    1326470: (1, 8),
    242760: (1, 8),
    1149460: (1, 8),
    768200: (1, 10),
    815370: (1, 4),
    2646460: (1, 70),
    1928980: (1, 6),
    244850: (1, 16),
    383120: (1, 8),
    361420: (1, 4),
    1281930: (1, 8),
    221100: (1, 60),
    513710: (1, 64),
    218620: (1, 4),
    1272080: (1, 4),
    2073850: (1, 3),
    1811260: (1, 4),
    2074920: (1, 4),
    899770: (1, 4),
    1172620: (1, 4),
    271590: (1, 30),
    4000: (1, 128),
    244210: (1, 24),
    805550: (1, 30),
    1066890: (1, 32),
    365960: (1, 46),
    690790: (1, 8),
    1551360: (1, 12),
    1222680: (1, 16),
    359320: (1, 4),
}

COOP_WORDS = ("協力", "coop", "co-op", "cooperative", "pve", "online co-op", "shared/split screen co-op")
VERSUS_WORDS = ("対戦", "pvp", "versus", "competitive", "multi-player", "online pvp")


def main() -> None:
    app_ids = get_app_ids()
    games = []

    for index, app_id in enumerate(app_ids, start=1):
        print(f"[{index}/{len(app_ids)}] fetching {app_id}")
        try:
            app_data = fetch_appdetails(app_id)
            if not app_data:
                continue

            review_data = fetch_reviews(app_id)
            game = build_game(app_id, app_data, review_data)
            if not is_available_for_purchase(game):
                print(f"  skipped {app_id}: price unavailable")
                continue
            if not meets_review_threshold(game):
                print(f"  skipped {app_id}: not enough reviews")
                continue
            games.append(game)
            time.sleep(0.8)
        except Exception as exc:  # noqa: BLE001 - keep scheduled update resilient
            print(f"  skipped {app_id}: {exc}")

    if not games:
        raise SystemExit("No games were fetched. Existing games.json was not overwritten.")

    games.sort(key=lambda item: item["title"].lower())
    OUT.write_text(json.dumps(games, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(games)} games to {OUT}")


def get_app_ids() -> list[int]:
    env_value = os.environ.get("STEAM_APPIDS", "")
    if env_value.strip():
        app_ids = parse_app_ids(env_value)
    else:
        app_ids = list(DEFAULT_APP_IDS)

    extra_value = os.environ.get("STEAM_EXTRA_APPIDS", "")
    if extra_value.strip():
        app_ids.extend(parse_app_ids(extra_value))

    unique_app_ids = list(dict.fromkeys(app_ids))
    limit = int(os.environ.get("STEAM_MAX_APPS", "0") or "0")
    if limit > 0:
        return unique_app_ids[:limit]
    return unique_app_ids


def parse_app_ids(raw_value: str) -> list[int]:
    app_ids = []
    for raw in raw_value.split(","):
        raw = raw.strip()
        if raw:
            app_ids.append(int(raw))
    return app_ids


def fetch_json(url: str, timeout: int = 25) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "steam-player-count-recommender/1.0",
            "Accept": "application/json",
        },
    )
    context = None
    if os.environ.get("STEAM_ALLOW_INSECURE_SSL") == "1":
        context = ssl._create_unverified_context()

    with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_appdetails(app_id: int) -> dict | None:
    params = urllib.parse.urlencode({"appids": app_id, "cc": "jp", "l": "japanese"})
    payload = fetch_json(f"https://store.steampowered.com/api/appdetails?{params}")
    item = payload.get(str(app_id), {})
    if not item.get("success"):
        return None
    data = item.get("data", {})
    if data.get("type") != "game":
        return None
    return data


def fetch_reviews(app_id: int) -> dict:
    params = urllib.parse.urlencode(
        {
            "json": 1,
            "language": "japanese",
            "filter": "all",
            "purchase_type": "all",
            "num_per_page": 60,
            "cursor": "*",
        }
    )
    try:
        return fetch_json(f"https://store.steampowered.com/appreviews/{app_id}?{params}")
    except (urllib.error.HTTPError, urllib.error.URLError):
        params = urllib.parse.urlencode(
            {
                "json": 1,
                "language": "all",
                "filter": "all",
                "purchase_type": "all",
                "num_per_page": 60,
                "cursor": "*",
            }
        )
        return fetch_json(f"https://store.steampowered.com/appreviews/{app_id}?{params}")


def build_game(app_id: int, app_data: dict, review_data: dict) -> dict:
    reviews = [review.get("review", "") for review in review_data.get("reviews", [])]
    categories = [item.get("description", "") for item in app_data.get("categories", [])]
    genres = [item.get("description", "") for item in app_data.get("genres", [])]
    min_players, max_players = infer_players(app_id, reviews, categories)
    styles = infer_styles(reviews, categories, genres)
    price = parse_price(app_data)
    language = parse_language(app_data)
    summary = review_data.get("query_summary", {})

    return {
        "appId": app_id,
        "title": app_data.get("name", f"Steam App {app_id}"),
        "minPlayers": min_players,
        "maxPlayers": max_players,
        "styles": styles,
        "reviews": trim_reviews(reviews),
        "price": price,
        "language": language,
        "reviewSummary": {
            "totalReviews": summary.get("total_reviews", 0),
            "totalPositive": summary.get("total_positive", 0),
            "totalNegative": summary.get("total_negative", 0),
            "scoreDescription": summary.get("review_score_desc", "レビュー未取得"),
        },
        "headerImage": app_data.get("header_image", ""),
        "steamUrl": f"https://store.steampowered.com/app/{app_id}/",
        "updatedAt": int(time.time()),
    }


def infer_players(app_id: int, reviews: list[str], categories: list[str]) -> tuple[int, int]:
    if app_id in MANUAL_PLAYERS:
        return MANUAL_PLAYERS[app_id]

    joined = " ".join(reviews + categories)
    numbers = [int(value) for value in re.findall(r"(\d{1,3})\s*(?:人|players?|player)", joined, re.IGNORECASE)]
    if not numbers:
        return (1, 4) if any("co-op" in item.lower() for item in categories) else (1, 8)

    numbers = [number for number in numbers if 1 <= number <= 100]
    if not numbers:
        return (1, 8)
    return min(numbers), max(numbers)


def infer_styles(reviews: list[str], categories: list[str], genres: list[str]) -> list[str]:
    joined = " ".join(reviews + categories + genres).lower()
    styles = []
    if any(word in joined for word in COOP_WORDS):
        styles.append("coop")
    if any(word in joined for word in VERSUS_WORDS):
        styles.append("versus")
    return styles or ["coop", "versus"]


def parse_price(app_data: dict) -> dict:
    if app_data.get("is_free"):
        return {
            "isFree": True,
            "currency": "JPY",
            "initial": 0,
            "final": 0,
            "initialFormatted": "無料",
            "finalFormatted": "無料",
            "discountPercent": 0,
        }

    overview = app_data.get("price_overview") or {}
    return {
        "isFree": False,
        "currency": overview.get("currency", "JPY"),
        "initial": overview.get("initial"),
        "final": overview.get("final"),
        "initialFormatted": overview.get("initial_formatted") or overview.get("final_formatted") or "価格未取得",
        "finalFormatted": overview.get("final_formatted") or "価格未取得",
        "discountPercent": overview.get("discount_percent", 0),
    }


def is_available_for_purchase(game: dict) -> bool:
    price = game.get("price", {})
    if price.get("isFree"):
        return True

    final_price = price.get("final")
    final_label = price.get("finalFormatted")
    return isinstance(final_price, int) and final_label != "価格未取得"


def meets_review_threshold(game: dict) -> bool:
    minimum = int(os.environ.get("STEAM_MIN_REVIEWS", "0") or "0")
    if minimum <= 0:
        return True
    total_reviews = int(game.get("reviewSummary", {}).get("totalReviews", 0) or 0)
    return total_reviews >= minimum


def parse_language(app_data: dict) -> dict:
    raw_languages = app_data.get("supported_languages") or ""
    plain_languages = re.sub(r"<[^>]+>", "", raw_languages)
    normalized = plain_languages.lower()
    supports_japanese = "japanese" in normalized or "日本語" in plain_languages

    return {
        "supportsJapanese": supports_japanese,
        "supportedLanguages": plain_languages,
    }


def trim_reviews(reviews: list[str]) -> list[str]:
    cleaned = []
    for review in reviews:
        review = " ".join(review.split())
        if len(review) >= 8:
            cleaned.append(review[:260])
        if len(cleaned) >= 8:
            break
    return cleaned or ["レビュー情報を取得できませんでした。"]


if __name__ == "__main__":
    main()

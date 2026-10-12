#!/usr/bin/env python3
"""Convert the selected blackmatrix7 Clash YAML rule sets to sing-box source JSON."""
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "rules"

RULES = {
    "WeChat": ("WeChat", "WeChat_No_Resolve.yaml"),
    "Apple": ("Apple", "Apple_Classical_No_Resolve.yaml"),
    "BiliBili": ("BiliBili", "BiliBili_No_Resolve.yaml"),
    "Netflix": ("Netflix", "Netflix_No_Resolve.yaml"),
    "Disney": ("Disney", "Disney_No_Resolve.yaml"),
    "YouTube": ("YouTube", "YouTube_No_Resolve.yaml"),
    "TikTok": ("TikTok", "TikTok_No_Resolve.yaml"),
    "GlobalMedia": ("GlobalMedia", "GlobalMedia_Classical_No_Resolve.yaml"),
    "OpenAI": ("OpenAI", "OpenAI_No_Resolve.yaml"),
    "Claude": ("Claude", "Claude_No_Resolve.yaml"),
    "Gemini": ("Gemini", "Gemini_No_Resolve.yaml"),
    "Google": ("Google", "Google_No_Resolve.yaml"),
    "Microsoft": ("Microsoft", "Microsoft_No_Resolve.yaml"),
    "PayPal": ("PayPal", "PayPal_No_Resolve.yaml"),
    "Telegram": ("Telegram", "Telegram_No_Resolve.yaml"),
    "Steam": ("Steam", "Steam_No_Resolve.yaml"),
    "Lan": ("Lan", "Lan_No_Resolve.yaml"),
    "ChinaMax": ("ChinaMax", "ChinaMax_Classical_No_IPv6_No_Resolve.yaml"),
}

TYPE_MAP = {
    "DOMAIN": "domain",
    "DOMAIN-SUFFIX": "domain_suffix",
    "DOMAIN-KEYWORD": "domain_keyword",
    "IP-CIDR": "ip_cidr",
    "IP-CIDR6": "ip_cidr",
    "PROCESS-NAME": "process_name",
}


def convert(tag: str, group: str, filename: str) -> None:
    url = f"https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/{group}/{filename}"
    request = urllib.request.Request(url, headers={"User-Agent": "LJAYi-Tools-Singbox"})
    text = urllib.request.urlopen(request, timeout=60).read().decode()
    rules = []
    skipped = {}
    in_payload = False
    for line in text.splitlines():
        if line.strip() == "payload:":
            in_payload = True
            continue
        if not in_payload or not re.match(r"^\s+-\s+", line):
            continue
        item = re.sub(r"^\s+-\s+", "", line).split("#", 1)[0].strip()
        parts = [part.strip().strip("'\"") for part in item.split(",")]
        if len(parts) < 2:
            raise ValueError(f"Invalid upstream rule in {tag}: {line}")
        if parts[0] == "IP-ASN":
            skipped["IP-ASN"] = skipped.get("IP-ASN", 0) + 1
            continue
        if parts[0] not in TYPE_MAP:
            raise ValueError(f"Unsupported upstream rule type in {tag}: {parts[0]}")
        kind = TYPE_MAP[parts[0]]
        value = parts[1]
        rules.append({kind: [value]})
    output = OUT / f"{tag}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"version": 1, "rules": rules}, ensure_ascii=False, indent=2) + "\n")
    note = f", skipped {skipped}" if skipped else ""
    print(f"Built {output} ({len(rules)} rules{note})")


if __name__ == "__main__":
    for tag, (group, filename) in RULES.items():
        convert(tag, group, filename)

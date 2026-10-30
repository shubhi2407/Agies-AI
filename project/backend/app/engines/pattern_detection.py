import re
from typing import Any
from app.engines.detection_rules import is_rule_active

PATTERNS = {
    "EMAIL": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "PHONE": re.compile(
        r"(?<!\d)(?:\+91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}(?!\d)|(?<!\d)\+?\d{1,3}[\s.-]\d{3,4}[\s.-]\d{3,4}(?!\d)"
    ),
    "API_KEY": re.compile(r"\b(?:sk|pk|api)[-_]?[A-Za-z0-9_-]{16,}\b", re.IGNORECASE),
    "AWS_ACCESS_KEY": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "PRIVATE_KEY": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "DATABASE_URL": re.compile(r"\b(?:mongodb|postgres(?:ql)?|mysql)://[^\s]+", re.IGNORECASE),
    "CREDIT_CARD": re.compile(r"(?<!\d)(?:\d[ -]*?){13,19}(?!\d)"),
    "PASSWORD_ASSIGNMENT": re.compile(r"\b(?:password|passwd|pwd|secret)\s*[:=]\s*\S+", re.IGNORECASE),
}


_RULE_NAME_BY_TYPE = {
    "API_KEY": "API_KEY_PATTERN",
    "EMAIL": "EMAIL_PATTERN",
    "PHONE": "PHONE_PATTERN",
    "AWS_ACCESS_KEY": "AWS_ACCESS_KEY_PATTERN",
    "PRIVATE_KEY": "PRIVATE_KEY_PATTERN",
    "DATABASE_URL": "DATABASE_URL_PATTERN",
    "CREDIT_CARD": "CREDIT_CARD_PATTERN",
    "PASSWORD_ASSIGNMENT": "PASSWORD_ASSIGNMENT_PATTERN",
}

def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def _luhn_valid(value: str) -> bool:
    digits = _digits(value)
    if not 13 <= len(digits) <= 19:
        return False
    total = 0
    parity = len(digits) % 2
    for i, ch in enumerate(digits):
        n = int(ch)
        if i % 2 == parity:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def mask_value(value: str) -> str:
    if len(value) <= 6:
        return "*" * len(value)
    return value[:4] + "*" * min(len(value) - 4, 12)


def detect_patterns(text: str) -> dict[str, Any]:
    findings = []

    for pattern_name, pattern in PATTERNS.items():
        if not is_rule_active(_RULE_NAME_BY_TYPE.get(pattern_name, "")):
            continue
        raw_matches = pattern.findall(text)
        matches = []

        for match in raw_matches:
            value = match if isinstance(match, str) else match[0]
            if pattern_name == "CREDIT_CARD" and not _luhn_valid(value):
                continue
            if pattern_name == "PHONE":
                # Avoid treating ordinary short numbers as phone PII.
                digits = _digits(value)
                if not 10 <= len(digits) <= 15:
                    continue
            matches.append(value)

        if matches:
            findings.append({
                "type": pattern_name,
                "count": len(matches),
                "masked_examples": [mask_value(value) for value in matches[:3]],
            })

    return {
        "detected": bool(findings),
        "finding_count": len(findings),
        "findings": findings,
    }

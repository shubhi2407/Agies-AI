from typing import Any
import re
from app.engines.detection_rules import is_rule_active

HIGH_RISK_CONTEXTS = {
    "production_environment": (re.compile(r"\b(?:production|prod)\b"), 20),
    "database": (re.compile(r"\b(?:database|db)\b"), 15),
    "deployment": (re.compile(r"\b(?:deploy|deployment)\b"), 15),
    "server": (re.compile(r"\bserver\b"), 10),
    "administrative_access": (re.compile(r"\b(?:admin|root)\b"), 15),
    "credentials": (re.compile(r"\b(?:credential|credentials|secret|secrets|password)\b"), 15),
    "private_information": (re.compile(r"\bprivate\b"), 10),
    "confidential_information": (
        re.compile(r"\b(?:confidential|restricted|proprietary|internal(?:\s+(?:information|document|data|report))?)\b"),
        35,
    ),
    "financial_information": (
        re.compile(r"\b(?:revenue|financial|financials|forecast|salary|payroll|bank|transaction)\b"),
        20,
    ),
}

MEDIUM_RISK_CONTEXTS = {
    "external_sharing": (re.compile(r"\b(?:send|share|upload|paste|give|forward|submit)\b"), 10),
    "external_destination": (
        re.compile(r"\b(?:external|public|third[- ]party|outside)\b"),
        10,
    ),
    "external_ai": (
        re.compile(r"\b(?:chatgpt|gemini|claude|copilot|ai\s+assistant|external\s+ai)\b"),
        20,
    ),
}

SAFE_CONTEXTS = {
    "example_or_testing": (re.compile(r"\b(?:sample|test|testing|dummy)\b"), -10),
    "documentation": (re.compile(r"\bdocumentation\b"), -5),
}


CONTEXT_RULE_NAMES = {
    "production_environment": "PRODUCTION_ENVIRONMENT",
    "database": "DATABASE_CONTEXT",
    "deployment": "DEPLOYMENT_CONTEXT",
    "server": "SERVER_CONTEXT",
    "administrative_access": "ADMINISTRATIVE_ACCESS_CONTEXT",
    "credentials": "CREDENTIALS_CONTEXT",
    "private_information": "PRIVATE_INFORMATION_CONTEXT",
    "confidential_information": "CONFIDENTIAL_INFORMATION",
    "financial_information": "FINANCIAL_INFORMATION",
    "external_sharing": "EXTERNAL_SHARING",
    "external_destination": "EXTERNAL_DESTINATION",
    "external_ai": "EXTERNAL_AI_DESTINATION",
    "example_or_testing": "EXAMPLE_OR_TESTING",
    "documentation": "DOCUMENTATION_CONTEXT",
}

def analyze_context(text: str, detection: dict[str, Any]) -> dict[str, Any]:
    normalized_text = text.lower()
    score_modifier = 0
    signals = []

    for concept, (pattern, weight) in HIGH_RISK_CONTEXTS.items():
        if not is_rule_active(CONTEXT_RULE_NAMES.get(concept, "")):
            continue
        if pattern.search(normalized_text):
            score_modifier += weight
            signals.append({"signal": concept, "category": "HIGH_RISK_CONTEXT", "impact": weight})

    for concept, (pattern, weight) in MEDIUM_RISK_CONTEXTS.items():
        if not is_rule_active(CONTEXT_RULE_NAMES.get(concept, "")):
            continue
        if pattern.search(normalized_text):
            score_modifier += weight
            signals.append({"signal": concept, "category": "MEDIUM_RISK_CONTEXT", "impact": weight})

    for concept, (pattern, weight) in SAFE_CONTEXTS.items():
        if not is_rule_active(CONTEXT_RULE_NAMES.get(concept, "")):
            continue
        if pattern.search(normalized_text):
            score_modifier += weight
            signals.append({"signal": concept, "category": "SAFE_CONTEXT", "impact": weight})

    # Context is useful even when regex finds no structured PII.
    score_modifier = max(-20, min(score_modifier, 70))

    if score_modifier >= 35:
        context_level = "HIGH"
    elif score_modifier >= 10:
        context_level = "MEDIUM"
    else:
        context_level = "LOW"

    return {"context_level": context_level, "score_modifier": score_modifier, "signals": signals}

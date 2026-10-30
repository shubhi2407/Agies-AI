# Employee Risk Analytics v1.9

Employee statistics now include:
- `risk_score`: average risk score across recorded incidents
- `high_risk_events`: incidents with risk score >= 70
- `block_rate`: percentage of incidents blocked
- `top_violation`: most frequently detected finding type

The existing `risk_level` remains conservative: it reflects the highest recorded incident risk level for the employee.

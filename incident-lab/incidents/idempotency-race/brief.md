# Duplicate charges under concurrent retries

`POST /charges` accepts `{"amount": 4500}` and an `Idempotency-Key`.
Two simultaneous retries sometimes create two charges. Return the original
charge on every retry, including retries with a different amount. The service
can have multiple worker processes sharing one SQLite database.

Reproduce with `python -m pytest incidents/idempotency-race/repro_test.py`.
Preserve successful charging for distinct keys and database persistence.

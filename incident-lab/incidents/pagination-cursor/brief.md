# Inventory pages repeat tied timestamps

`GET /items?limit=2&cursor=...` orders inventory by `(created_at, id)`.
Seeded items share timestamps. The next page must advance beyond the previous
page's last item, including when timestamps tie. Continue until an empty page.

Reproduce with `python -m pytest incidents/pagination-cursor/repro_test.py`.
The cursor must remain meaningful if earlier rows are deleted or historical
rows are inserted between page reads. This is forward traversal, not a snapshot:
new rows before the cursor need not appear, but unseen rows after it must not
be skipped and seen rows must not reappear. Invalid cursors must return 400.

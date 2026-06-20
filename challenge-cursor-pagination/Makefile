DB_HOST     ?= localhost
DB_PORT     ?= 5432
DB_NAME     ?= productsdb
DB_USER     ?= user
DB_PASSWORD ?= password
PORT        ?= 8000

install:
	pip install -r requirements.txt

run:
	uvicorn src.index:app --host 0.0.0.0 --port $(PORT) --reload

db:
	PGPASSWORD=$(DB_PASSWORD) psql -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME)

# Fetch the first page — fast with any implementation
test-shallow:
	curl -s -w "\n\nTotal time: %{time_total}s\n" \
		"http://localhost:$(PORT)/products?limit=20" | python3 -m json.tool

# Fetch a deep page — slow with OFFSET, instant with cursor pagination
test-deep:
	curl -s -w "\n\nTotal time: %{time_total}s\n" \
		"http://localhost:$(PORT)/products?cursor=20000&limit=20" | python3 -m json.tool

# Compare shallow vs deep to see the latency gap
test-compare:
	@echo "=== Shallow page (page 1) ==="
	@curl -s -o /dev/null -w "Time: %{time_total}s\n" \
		"http://localhost:$(PORT)/products?limit=20"
	@echo ""
	@echo "=== Deep page (cursor=20000) ==="
	@curl -s -o /dev/null -w "Time: %{time_total}s\n" \
		"http://localhost:$(PORT)/products?cursor=20000&limit=20"

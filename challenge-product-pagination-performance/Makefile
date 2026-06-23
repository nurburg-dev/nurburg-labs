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

# Fetch the first page
test-shallow:
	curl -s -w "\n\nTotal time: %{time_total}s\n" \
		"http://localhost:$(PORT)/products?limit=20" | python3 -m json.tool

# Fetch the next page using the token returned by the API
test-next:
	@TOKEN=$$(curl -s "http://localhost:$(PORT)/products?limit=20" | python3 -c 'import sys,json; print(json.load(sys.stdin)["next_page_token"])'); \
	curl -s -w "\n\nTotal time: %{time_total}s\n" \
		"http://localhost:$(PORT)/products?page_token=$$TOKEN&limit=20" | python3 -m json.tool

# Compare first-page vs next-page latency
test-compare:
	@echo "=== First page ==="
	@curl -s -o /dev/null -w "Time: %{time_total}s\n" \
		"http://localhost:$(PORT)/products?limit=20"
	@echo ""
	@echo "=== Next page ==="
	@TOKEN=$$(curl -s "http://localhost:$(PORT)/products?limit=20" | python3 -c 'import sys,json; print(json.load(sys.stdin)["next_page_token"])'); \
	curl -s -o /dev/null -w "Time: %{time_total}s\n" \
		"http://localhost:$(PORT)/products?page_token=$$TOKEN&limit=20"

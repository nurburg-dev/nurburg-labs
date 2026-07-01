PORT ?= 8000

install:
	pip install -r requirements.txt

run:
	PORT=$(PORT) uvicorn src.index:app --host 0.0.0.0 --port $(PORT) --reload

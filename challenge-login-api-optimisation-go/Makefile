PORT ?= 3000

build:
	go build -o bin/challenge .

run:
	DB_HOST=userdb DB_PORT=5432 DB_NAME=userdb DB_USER=user DB_PASSWORD=password PORT=$(PORT) \
	go run .

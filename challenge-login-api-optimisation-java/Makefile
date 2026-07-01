PORT ?= 8080

build:
	sh mvnw package -DskipTests

run:
	DB_HOST=userdb DB_PORT=5432 DB_NAME=userdb DB_USER=user DB_PASSWORD=password PORT=$(PORT) \
	java -jar target/challenge-0.0.1-SNAPSHOT.jar

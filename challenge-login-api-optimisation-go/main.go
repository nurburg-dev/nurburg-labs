package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var pool *pgxpool.Pool

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string   `json:"token"`
	User  userInfo `json:"user"`
}

type userInfo struct {
	ID    int    `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type errorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func healthcheck(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("OK"))
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse{
			Error:   "Validation Error",
			Message: "Invalid request body",
		})
		return
	}

	if req.Password == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse{
			Error:   "Validation Error",
			Message: "Password is required",
		})
		return
	}

	var (
		id           int
		email        string
		passwordHash string
		name         string
	)
	err := pool.QueryRow(r.Context(),
		"SELECT id, email, password_hash, name FROM users WHERE email = $1",
		req.Email,
	).Scan(&id, &email, &passwordHash, &name)

	if err != nil {
		writeJSON(w, http.StatusUnauthorized, errorResponse{
			Error:   "Authentication Failed",
			Message: "Invalid email or password",
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, errorResponse{
			Error:   "Authentication Failed",
			Message: "Invalid email or password",
		})
		return
	}

	secret := getenv("JWT_SECRET", "your-secret-key-change-in-production")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": id,
		"email":  email,
		"exp":    time.Now().Add(24 * time.Hour).Unix(),
	})
	tokenStr, err := token.SignedString([]byte(secret))
	if err != nil {
		log.Printf("JWT signing error: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{
			Error:   "Internal Server Error",
			Message: "An unexpected error occurred",
		})
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		Token: tokenStr,
		User:  userInfo{ID: id, Email: email, Name: name},
	})
}

func main() {
	ctx := context.Background()

	connStr := fmt.Sprintf(
		"host=%s port=%s dbname=%s user=%s password=%s pool_max_conns=10",
		getenv("DB_HOST", "userdb"),
		getenv("DB_PORT", "5432"),
		getenv("DB_NAME", "userdb"),
		getenv("DB_USER", "user"),
		getenv("DB_PASSWORD", "password"),
	)

	var err error
	pool, err = pgxpool.New(ctx, connStr)
	if err != nil {
		log.Fatalf("Unable to create connection pool: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}

	port := getenv("PORT", "3000")

	mux := http.NewServeMux()
	mux.HandleFunc("/healthcheck", healthcheck)
	mux.HandleFunc("/auth/login", loginHandler)

	log.Printf("Server running on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

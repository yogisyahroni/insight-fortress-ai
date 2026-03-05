package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"datalens/internal/config"
	"datalens/internal/crypto"
	"datalens/internal/middleware"
	"datalens/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// AIHandler handles natural language → data query (Ask Data) and AI report generation.
//
// Security model:
//   - Non-streaming endpoints use server-configured AI_API_KEY (env var) as fallback.
//   - Streaming endpoints resolve the API key from the user's encrypted DB config.
//   - The raw API key NEVER leaves the server — DevTools only sees your own domain.
type AIHandler struct {
	db            *gorm.DB
	aiConf        config.AIConfig
	encryptionKey string // server-side AES-256-GCM key for decrypting user AI keys
}

// NewAIHandler creates a new AIHandler.
func NewAIHandler(db *gorm.DB, aiConf config.AIConfig, encryptionKey string) *AIHandler {
	return &AIHandler{db: db, aiConf: aiConf, encryptionKey: encryptionKey}
}

// resolvedConfig holds the effective AI configuration for a single request.
// It merges: user DB config > server env config fallback.
type resolvedConfig struct {
	Provider  string
	APIKey    string
	Model     string
	MaxTokens int
	BaseURL   string
}

// resolveUserConfig loads and decrypts the user's AI config from the database.
// Falls back to the server-level AI_API_KEY when no user config is found.
func (h *AIHandler) resolveUserConfig(userID string) (resolvedConfig, error) {
	var userCfg models.UserAIConfig
	err := h.db.Where("user_id = ?", userID).First(&userCfg).Error

	// If user has saved their own config, use it
	if err == nil {
		if userCfg.EncryptedAPIKey == "" {
			return resolvedConfig{}, fmt.Errorf("AI not configured: no API key saved")
		}
		rawKey, decryptErr := crypto.Decrypt(userCfg.EncryptedAPIKey, h.encryptionKey)
		if decryptErr != nil {
			return resolvedConfig{}, fmt.Errorf("failed to decrypt API key: %w", decryptErr)
		}
		return resolvedConfig{
			Provider:  userCfg.Provider,
			APIKey:    rawKey,
			Model:     userCfg.Model,
			MaxTokens: userCfg.MaxTokens,
			BaseURL:   userCfg.BaseURL,
		}, nil
	}

	// Record not found — fall back to server-level env config
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if h.aiConf.APIKey == "" {
			return resolvedConfig{}, fmt.Errorf("AI not configured. Save your API key in Settings.")
		}
		return resolvedConfig{
			Provider:  h.aiConf.Provider,
			APIKey:    h.aiConf.APIKey,
			Model:     h.aiConf.Model,
			MaxTokens: h.aiConf.MaxTokens,
			BaseURL:   h.aiConf.BaseURL,
		}, nil
	}

	return resolvedConfig{}, fmt.Errorf("DB error loading AI config: %w", err)
}

// ─────────────────────────────────────────────────────────────────────────────
// AskData — non-streaming NL→SQL (backwards compat)
// POST /api/v1/ask-data
// ─────────────────────────────────────────────────────────────────────────────
func (h *AIHandler) AskData(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req struct {
		Question  string `json:"question"`
		DatasetID string `json:"datasetId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}
	if req.Question == "" || req.DatasetID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "question and datasetId required"})
	}

	cfg, err := h.resolveUserConfig(userID)
	if err != nil {
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": err.Error()})
	}

	var tableDef struct {
		DataTableName string
		Columns       json.RawMessage
	}
	if err := h.db.Table("datasets").Select("data_table_name, columns").
		Where("id = ?", req.DatasetID).Scan(&tableDef).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Dataset not found"})
	}

	schemaContext := fmt.Sprintf("Table: %s\nColumns: %s", tableDef.DataTableName, string(tableDef.Columns))
	prompt := fmt.Sprintf(`You are a PostgreSQL expert. Given the following table schema, write a SQL SELECT query to answer the user's question.
ONLY output valid SQL, nothing else. Do not include markdown code fences.

Schema:
%s

Question: %s

SQL:`, schemaContext, req.Question)

	sqlQuery, err := h.callOpenAI(cfg, prompt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI call failed: " + err.Error()})
	}

	if !strings.HasPrefix(strings.TrimSpace(strings.ToUpper(sqlQuery)), "SELECT") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "AI generated a non-SELECT query. Rejected for safety."})
	}

	var results []map[string]interface{}
	if err := h.db.Raw(sqlQuery).Find(&results).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "SQL execution failed", "sql": sqlQuery, "dbError": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"question": req.Question, "sql": sqlQuery,
		"data": results, "rowCount": len(results),
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// GenerateReport — non-streaming (backwards compat)
// POST /api/v1/reports/generate
// ─────────────────────────────────────────────────────────────────────────────
func (h *AIHandler) GenerateReport(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req struct {
		DatasetID string `json:"datasetId"`
		Prompt    string `json:"prompt"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	cfg, err := h.resolveUserConfig(userID)
	if err != nil {
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": err.Error()})
	}

	basePrompt := "Generate a comprehensive data analysis report."
	if req.Prompt != "" {
		basePrompt = req.Prompt
	}

	content, err := h.callOpenAI(cfg, basePrompt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "AI call failed"})
	}
	return c.JSON(fiber.Map{"title": "AI Generated Report", "content": content})
}

// ─────────────────────────────────────────────────────────────────────────────
// StreamGenerateReport — SSE streaming report generation
// POST /api/v1/reports/stream
//
// SECURITY: The AI API key is decrypted server-side from the DB.
// Browser DevTools will only see requests to your own domain.
// ─────────────────────────────────────────────────────────────────────────────
func (h *AIHandler) StreamGenerateReport(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req struct {
		DatasetID string `json:"datasetId"`
		Prompt    string `json:"prompt"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	// Resolve and decrypt user's API key — raw key stays on server
	cfg, err := h.resolveUserConfig(userID)
	if err != nil {
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{
			"error":  err.Error(),
			"hint":   "Save your AI API key in Settings → AI Configuration",
			"action": "settings",
		})
	}

	basePrompt := "Generate a comprehensive data analysis report with executive summary, key findings, recommendations, and data story."
	if req.Prompt != "" {
		basePrompt = req.Prompt
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		sendSSEEvent(w, "progress", `{"stage":"generating","message":"AI is writing your report..."}`)
		w.Flush()

		err := h.streamOpenAI(cfg, basePrompt, func(token string) {
			sendSSEEvent(w, "token", jsonEscape(token))
			w.Flush()
		})
		if err != nil {
			sendSSEEvent(w, "error", jsonEscape(err.Error()))
		} else {
			sendSSEEvent(w, "done", `{"message":"Report generation complete"}`)
		}
		w.Flush()
	})
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// StreamAskData — SSE streaming NL→SQL→results with phased progress
// POST /api/v1/ask-data/stream
// ─────────────────────────────────────────────────────────────────────────────
func (h *AIHandler) StreamAskData(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req struct {
		Question  string `json:"question"`
		DatasetID string `json:"datasetId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}
	if req.Question == "" || req.DatasetID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "question and datasetId required"})
	}

	cfg, err := h.resolveUserConfig(userID)
	if err != nil {
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": err.Error()})
	}

	var tableDef struct {
		DataTableName string
		Columns       json.RawMessage
	}
	if err := h.db.Table("datasets").Select("data_table_name, columns").
		Where("id = ?", req.DatasetID).Scan(&tableDef).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Dataset not found"})
	}

	schemaContext := fmt.Sprintf("Table: %s\nColumns: %s", tableDef.DataTableName, string(tableDef.Columns))
	prompt := fmt.Sprintf(`You are a PostgreSQL expert. Given the following table schema, write a SQL SELECT query to answer the user's question.
ONLY output valid SQL, nothing else. Do not include markdown code fences.

Schema:
%s

Question: %s

SQL:`, schemaContext, req.Question)

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		sendSSEEvent(w, "progress", `{"stage":"thinking","message":"Analyzing your question..."}`)
		w.Flush()

		var sqlBuf strings.Builder
		sendSSEEvent(w, "progress", `{"stage":"generating","message":"Generating SQL query..."}`)
		w.Flush()

		err := h.streamOpenAI(cfg, prompt, func(token string) {
			sqlBuf.WriteString(token)
			sendSSEEvent(w, "token", jsonEscape(token))
			w.Flush()
		})
		if err != nil {
			sendSSEEvent(w, "error", jsonEscape("AI call failed: "+err.Error()))
			w.Flush()
			return
		}

		sqlQuery := strings.TrimSpace(sqlBuf.String())
		sqlJSON, _ := json.Marshal(map[string]string{"sql": sqlQuery})
		sendSSEEvent(w, "sql", string(sqlJSON))
		w.Flush()

		if !strings.HasPrefix(strings.ToUpper(sqlQuery), "SELECT") {
			sendSSEEvent(w, "error", jsonEscape("Non-SELECT query rejected for safety."))
			sendSSEEvent(w, "done", "{}")
			w.Flush()
			return
		}

		sendSSEEvent(w, "progress", `{"stage":"executing","message":"Running query on your data..."}`)
		w.Flush()

		var results []map[string]interface{}
		if dbErr := h.db.Raw(sqlQuery).Find(&results).Error; dbErr != nil {
			errJSON, _ := json.Marshal(map[string]string{"error": dbErr.Error(), "sql": sqlQuery})
			sendSSEEvent(w, "error", string(errJSON))
			sendSSEEvent(w, "done", "{}")
			w.Flush()
			return
		}

		resultJSON, _ := json.Marshal(map[string]interface{}{
			"question": req.Question, "sql": sqlQuery,
			"data": results, "rowCount": len(results),
		})
		sendSSEEvent(w, "result", string(resultJSON))
		sendSSEEvent(w, "done", "{}")
		w.Flush()
	})
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// callOpenAI — non-streaming OpenAI-compatible request
// ─────────────────────────────────────────────────────────────────────────────
func (h *AIHandler) callOpenAI(cfg resolvedConfig, prompt string) (string, error) {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = providerBaseURL(cfg.Provider)
	}

	reqBody := map[string]interface{}{
		"model":      cfg.Model,
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
		"max_tokens": cfg.MaxTokens,
	}
	data, _ := json.Marshal(reqBody)
	httpReq, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, err := (&http.Client{}).Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI API error %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode AI response: %w", err)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("AI returned no choices")
	}
	return result.Choices[0].Message.Content, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// streamOpenAI — streaming OpenAI-compatible request, calls onToken per delta
// ─────────────────────────────────────────────────────────────────────────────
func (h *AIHandler) streamOpenAI(cfg resolvedConfig, prompt string, onToken func(string)) error {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = providerBaseURL(cfg.Provider)
	}

	reqBody := map[string]interface{}{
		"model":      cfg.Model,
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
		"max_tokens": cfg.MaxTokens,
		"stream":     true,
	}
	data, _ := json.Marshal(reqBody)
	httpReq, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(data))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := (&http.Client{}).Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AI API error %d: %s", resp.StatusCode, string(body))
	}

	// Parse OpenAI streaming SSE: "data: {...}" lines, terminated by "data: [DONE]"
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		if payload == "[DONE]" {
			break
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if json.Unmarshal([]byte(payload), &chunk) != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			onToken(chunk.Choices[0].Delta.Content)
		}
	}
	return scanner.Err()
}

// providerBaseURL maps known provider names to their OpenAI-compatible API base URL.
// Providers not listed here must set baseUrl explicitly in user config.
func providerBaseURL(provider string) string {
	switch provider {
	case "openai":
		return "https://api.openai.com/v1"
	case "openrouter":
		return "https://openrouter.ai/api/v1"
	case "groq":
		return "https://api.groq.com/openai/v1"
	case "deepseek":
		return "https://api.deepseek.com/v1"
	case "together":
		return "https://api.together.xyz/v1"
	case "mistral":
		return "https://api.mistral.ai/v1"
	case "nvidia":
		return "https://integrate.api.nvidia.com/v1"
	case "moonshot":
		return "https://api.moonshot.cn/v1"
	default:
		return "https://api.openai.com/v1"
	}
}

// sendSSEEvent writes one SSE event: "event: <type>\ndata: <payload>\n\n"
func sendSSEEvent(w *bufio.Writer, event, data string) {
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
}

// jsonEscape wraps a string in JSON quotes, safe for SSE data fields.
func jsonEscape(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

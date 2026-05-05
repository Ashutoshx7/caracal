// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// MCP reverse proxy: pre-flight expiry check, per-request STS exchange, 401-retry on upstream failure.

package internal

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	sharederr "github.com/garudex-labs/caracal/shared/errors"
	"github.com/rs/zerolog"
)

// preflightWindow is how early we exchange: HTTP client timeout (5 s) + 30 s buffer.
const preflightWindow = 35 * time.Second

type proxy struct {
	sts    *stsClient
	client *http.Client
	log    zerolog.Logger
}

func newProxy(sts *stsClient, log zerolog.Logger) *proxy {
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 100,
		MaxConnsPerHost:     200,
		IdleConnTimeout:     90 * time.Second,
	}
	return &proxy{sts: sts, client: &http.Client{Timeout: 30 * time.Second, Transport: transport}, log: log}
}

func (p *proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	bearer := extractBearer(r.Header.Get("Authorization"))
	if bearer == "" {
		writeErr(w, http.StatusUnauthorized, sharederr.New(sharederr.InvalidToken, "missing bearer token"))
		return
	}

	if exp, ok := jwtExp(bearer); ok && time.Until(exp) < preflightWindow {
		writeErr(w, http.StatusUnauthorized, sharederr.New(sharederr.CredentialExpired, "credential expiring within pre-flight window"))
		return
	}

	clientID := strings.TrimSpace(r.Header.Get("X-Caracal-Client-ID"))
	if clientID == "" {
		writeErr(w, http.StatusBadRequest, sharederr.New(sharederr.InvalidToken, "missing X-Caracal-Client-ID header"))
		return
	}
	resource := strings.TrimSpace(r.Header.Get("X-Caracal-Resource"))
	if resource == "" {
		writeErr(w, http.StatusBadRequest, sharederr.New(sharederr.InvalidToken, "missing X-Caracal-Resource header"))
		return
	}

	requestID := r.Header.Get("X-Request-Id")
	token, upstreamRaw, status, cerr := p.sts.Exchange(r.Context(), bearer, clientID, resource, requestID)
	if cerr != nil {
		writeErr(w, status, cerr)
		return
	}
	upstreamURL, err := parseApprovedUpstream(upstreamRaw)
	if err != nil {
		writeErr(w, http.StatusBadGateway, sharederr.New(sharederr.Internal, err.Error()))
		return
	}

	body, retryBody, canRetry, err := requestBodies(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, sharederr.New(sharederr.Internal, "read request body failed"))
		return
	}

	resp, err := p.forward(r, upstreamURL, body, token)
	if err != nil {
		writeErr(w, http.StatusBadGateway, sharederr.New(sharederr.STSUnavailable, err.Error()))
		return
	}
	if resp.StatusCode == http.StatusUnauthorized && canRetry {
		_ = resp.Body.Close()
		newToken, retryUpstreamRaw, retryStatus, retryErr := p.sts.Exchange(r.Context(), bearer, clientID, resource, requestID)
		if retryErr != nil {
			writeErr(w, retryStatus, retryErr)
			return
		}
		retryUpstreamURL, parseErr := parseApprovedUpstream(retryUpstreamRaw)
		if parseErr != nil {
			writeErr(w, http.StatusBadGateway, sharederr.New(sharederr.Internal, parseErr.Error()))
			return
		}
		resp, err = p.forward(r, retryUpstreamURL, retryBody, newToken)
		if err != nil {
			writeErr(w, http.StatusBadGateway, sharederr.New(sharederr.STSUnavailable, err.Error()))
			return
		}
	}
	defer resp.Body.Close()
	copyResponse(w, resp)
}

func (p *proxy) forward(r *http.Request, upstreamURL *url.URL, body io.ReadCloser, token string) (*http.Response, error) {
	req := r.Clone(r.Context())
	req.URL.Scheme = upstreamURL.Scheme
	req.URL.Host = upstreamURL.Host
	req.URL.Path = joinURLPath(upstreamURL.Path, r.URL.Path)
	req.URL.RawPath = ""
	req.URL.RawQuery = joinURLQuery(upstreamURL.RawQuery, r.URL.RawQuery)
	req.Host = upstreamURL.Host
	req.RequestURI = ""
	req.Body = body
	req.Header = r.Header.Clone()
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Del("X-Caracal-Client-ID")
	req.Header.Del("X-Caracal-Resource")
	req.Header.Del("X-Caracal-Upstream")
	return p.client.Do(req)
}

func parseApprovedUpstream(raw string) (*url.URL, error) {
	upstreamURL, err := url.Parse(raw)
	if err != nil || upstreamURL.Scheme == "" || upstreamURL.Host == "" {
		return nil, sharederr.New(sharederr.Internal, "invalid approved upstream URL")
	}
	if upstreamURL.Scheme != "http" && upstreamURL.Scheme != "https" {
		return nil, sharederr.New(sharederr.Internal, "unsupported approved upstream scheme")
	}
	if upstreamURL.User != nil {
		return nil, sharederr.New(sharederr.Internal, "approved upstream URL must not include user info")
	}
	upstreamURL.Fragment = ""
	return upstreamURL, nil
}

func joinURLPath(upstreamPath, requestPath string) string {
	if upstreamPath == "" || upstreamPath == "/" {
		if requestPath == "" {
			return "/"
		}
		return requestPath
	}
	if requestPath == "" || requestPath == "/" {
		return upstreamPath
	}
	return path.Join(upstreamPath, requestPath)
}

func joinURLQuery(upstreamQuery, requestQuery string) string {
	if upstreamQuery == "" {
		return requestQuery
	}
	if requestQuery == "" {
		return upstreamQuery
	}
	return upstreamQuery + "&" + requestQuery
}

func requestBodies(r *http.Request) (io.ReadCloser, io.ReadCloser, bool, error) {
	if r.Body == nil || r.Body == http.NoBody {
		return http.NoBody, http.NoBody, true, nil
	}
	if r.GetBody == nil {
		return r.Body, nil, false, nil
	}
	retryBody, err := r.GetBody()
	if err != nil {
		return nil, nil, false, err
	}
	return r.Body, retryBody, true, nil
}

func copyResponse(w http.ResponseWriter, resp *http.Response) {
	for key, vals := range resp.Header {
		for _, val := range vals {
			w.Header().Add(key, val)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// jwtExp decodes the JWT payload (without signature verification) and returns the exp claim.
func jwtExp(token string) (time.Time, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return time.Time{}, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}, false
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil || claims.Exp == 0 {
		return time.Time{}, false
	}
	return time.Unix(claims.Exp, 0), true
}

func extractBearer(h string) string {
	if strings.HasPrefix(h, "Bearer ") {
		return h[7:]
	}
	return ""
}

func writeErr(w http.ResponseWriter, status int, e *sharederr.CaracalError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(e)
}

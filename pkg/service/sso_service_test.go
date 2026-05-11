package service

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/sso"
	ssotypes "github.com/aws/aws-sdk-go-v2/service/sso/types"
	"github.com/aws/aws-sdk-go-v2/service/ssooidc"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/aws/smithy-go"
)

// --- Mock clients ---

type mockSSOOIDCClient struct {
	registerClientFn          func(ctx context.Context, params *ssooidc.RegisterClientInput, optFns ...func(*ssooidc.Options)) (*ssooidc.RegisterClientOutput, error)
	startDeviceAuthorizationFn func(ctx context.Context, params *ssooidc.StartDeviceAuthorizationInput, optFns ...func(*ssooidc.Options)) (*ssooidc.StartDeviceAuthorizationOutput, error)
	createTokenFn             func(ctx context.Context, params *ssooidc.CreateTokenInput, optFns ...func(*ssooidc.Options)) (*ssooidc.CreateTokenOutput, error)
}

func (m *mockSSOOIDCClient) RegisterClient(ctx context.Context, params *ssooidc.RegisterClientInput, optFns ...func(*ssooidc.Options)) (*ssooidc.RegisterClientOutput, error) {
	return m.registerClientFn(ctx, params, optFns...)
}

func (m *mockSSOOIDCClient) StartDeviceAuthorization(ctx context.Context, params *ssooidc.StartDeviceAuthorizationInput, optFns ...func(*ssooidc.Options)) (*ssooidc.StartDeviceAuthorizationOutput, error) {
	return m.startDeviceAuthorizationFn(ctx, params, optFns...)
}

func (m *mockSSOOIDCClient) CreateToken(ctx context.Context, params *ssooidc.CreateTokenInput, optFns ...func(*ssooidc.Options)) (*ssooidc.CreateTokenOutput, error) {
	return m.createTokenFn(ctx, params, optFns...)
}

type mockSTSClient struct {
	getCallerIdentityFn func(ctx context.Context, params *sts.GetCallerIdentityInput, optFns ...func(*sts.Options)) (*sts.GetCallerIdentityOutput, error)
}

func (m *mockSTSClient) GetCallerIdentity(ctx context.Context, params *sts.GetCallerIdentityInput, optFns ...func(*sts.Options)) (*sts.GetCallerIdentityOutput, error) {
	return m.getCallerIdentityFn(ctx, params, optFns...)
}

type mockSSOClient struct {
	getRoleCredentialsFn func(ctx context.Context, params *sso.GetRoleCredentialsInput, optFns ...func(*sso.Options)) (*sso.GetRoleCredentialsOutput, error)
}

func (m *mockSSOClient) GetRoleCredentials(ctx context.Context, params *sso.GetRoleCredentialsInput, optFns ...func(*sso.Options)) (*sso.GetRoleCredentialsOutput, error) {
	return m.getRoleCredentialsFn(ctx, params, optFns...)
}

// --- apiError for smithy.APIError mock ---

type apiError struct {
	code    string
	message string
}

func (e *apiError) ErrorCode() string    { return e.code }
func (e *apiError) ErrorMessage() string { return e.message }
func (e *apiError) ErrorFault() smithy.ErrorFault { return smithy.FaultUnknown }
func (e *apiError) Error() string        { return e.code + ": " + e.message }

// --- Tests ---

func TestSSOParseSSOProfile(t *testing.T) {
	// Create a temp AWS config file.
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config")

	configContent := `[default]
region = us-west-2

[profile my-sso]
sso_start_url = https://my-org.awsapps.com/start
sso_account_id = 123456789012
sso_role_name = AdministratorAccess
sso_region = us-east-1
region = us-east-1
`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("failed to write config: %v", err)
	}

	t.Setenv("AWS_CONFIG_FILE", configPath)

	t.Run("valid profile", func(t *testing.T) {
		profile, err := ParseSSOProfile("my-sso")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if profile.SSOStartURL != "https://my-org.awsapps.com/start" {
			t.Errorf("SSOStartURL = %q, want %q", profile.SSOStartURL, "https://my-org.awsapps.com/start")
		}
		if profile.SSOAccountID != "123456789012" {
			t.Errorf("SSOAccountID = %q, want %q", profile.SSOAccountID, "123456789012")
		}
		if profile.SSORoleName != "AdministratorAccess" {
			t.Errorf("SSORoleName = %q, want %q", profile.SSORoleName, "AdministratorAccess")
		}
		if profile.SSORegion != "us-east-1" {
			t.Errorf("SSORegion = %q, want %q", profile.SSORegion, "us-east-1")
		}
	})

	t.Run("profile not found", func(t *testing.T) {
		_, err := ParseSSOProfile("nonexistent")
		if err == nil {
			t.Fatal("expected error for nonexistent profile")
		}
	})

	t.Run("missing required fields", func(t *testing.T) {
		incomplete := filepath.Join(tmpDir, "config-incomplete")
		content := `[profile incomplete]
sso_start_url = https://example.com/start
`
		if err := os.WriteFile(incomplete, []byte(content), 0644); err != nil {
			t.Fatalf("failed to write config: %v", err)
		}
		t.Setenv("AWS_CONFIG_FILE", incomplete)

		_, err := ParseSSOProfile("incomplete")
		if err == nil {
			t.Fatal("expected error for incomplete profile")
		}
	})
}

func TestSSOGeneratePollID(t *testing.T) {
	ids := make(map[string]bool)
	for i := 0; i < 100; i++ {
		id, err := generatePollID()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(id) != 32 { // 16 bytes = 32 hex chars
			t.Errorf("poll ID length = %d, want 32", len(id))
		}
		if ids[id] {
			t.Errorf("duplicate poll ID: %s", id)
		}
		ids[id] = true
	}
}

func TestSSOCacheSSOToken(t *testing.T) {
	// Override home directory for test.
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)

	startURL := "https://my-org.awsapps.com/start"
	err := cacheSSOToken(startURL, "us-east-1", "test-access-token",
		"test-client-id", "test-client-secret", 3600)
	if err != nil {
		t.Fatalf("cacheSSOToken failed: %v", err)
	}

	// Verify file exists with correct name.
	h := sha1.New()
	h.Write([]byte(startURL))
	expectedFile := hex.EncodeToString(h.Sum(nil)) + ".json"
	cachePath := filepath.Join(tmpHome, ".aws", "sso", "cache", expectedFile)

	info, err := os.Stat(cachePath)
	if err != nil {
		t.Fatalf("cache file not found: %v", err)
	}

	// Verify file permissions are 0600.
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Errorf("file permissions = %o, want 0600", perm)
	}

	// Verify JSON content.
	data, err := os.ReadFile(cachePath)
	if err != nil {
		t.Fatalf("failed to read cache file: %v", err)
	}

	var token ssoCacheToken
	if err := json.Unmarshal(data, &token); err != nil {
		t.Fatalf("failed to unmarshal cache token: %v", err)
	}

	if token.StartURL != startURL {
		t.Errorf("startUrl = %q, want %q", token.StartURL, startURL)
	}
	if token.Region != "us-east-1" {
		t.Errorf("region = %q, want %q", token.Region, "us-east-1")
	}
	if token.AccessToken != "test-access-token" {
		t.Errorf("accessToken = %q, want %q", token.AccessToken, "test-access-token")
	}
	if token.ClientID != "test-client-id" {
		t.Errorf("clientId = %q, want %q", token.ClientID, "test-client-id")
	}
	if token.ClientSecret != "test-client-secret" {
		t.Errorf("clientSecret = %q, want %q", token.ClientSecret, "test-client-secret")
	}
	if token.ExpiresAt == "" {
		t.Error("expiresAt should not be empty")
	}
}

func TestSSOStartDeviceAuth(t *testing.T) {
	// Set up temp AWS config.
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config")
	configContent := `[profile test-sso]
sso_start_url = https://test.awsapps.com/start
sso_account_id = 111122223333
sso_role_name = TestRole
sso_region = us-west-2
`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("failed to write config: %v", err)
	}
	t.Setenv("AWS_CONFIG_FILE", configPath)

	// Install mock SSOOIDC client.
	origFactory := newSSOOIDCClient
	defer func() { newSSOOIDCClient = origFactory }()

	clientID := "mock-client-id"
	clientSecret := "mock-client-secret"
	deviceCode := "mock-device-code"
	verificationURI := "https://device.sso.us-west-2.amazonaws.com/"
	verificationURIComplete := "https://device.sso.us-west-2.amazonaws.com/?user_code=ABCD-EFGH"
	userCode := "ABCD-EFGH"

	newSSOOIDCClient = func(region string) ssooidcAPI {
		return &mockSSOOIDCClient{
			registerClientFn: func(ctx context.Context, params *ssooidc.RegisterClientInput, optFns ...func(*ssooidc.Options)) (*ssooidc.RegisterClientOutput, error) {
				if *params.ClientName != "polywave-web" {
					t.Errorf("ClientName = %q, want %q", *params.ClientName, "polywave-web")
				}
				return &ssooidc.RegisterClientOutput{
					ClientId:     &clientID,
					ClientSecret: &clientSecret,
				}, nil
			},
			startDeviceAuthorizationFn: func(ctx context.Context, params *ssooidc.StartDeviceAuthorizationInput, optFns ...func(*ssooidc.Options)) (*ssooidc.StartDeviceAuthorizationOutput, error) {
				return &ssooidc.StartDeviceAuthorizationOutput{
					DeviceCode:              &deviceCode,
					VerificationUri:         &verificationURI,
					VerificationUriComplete: &verificationURIComplete,
					UserCode:                &userCode,
					ExpiresIn:               600,
					Interval:                5,
				}, nil
			},
		}
	}

	resp, err := StartSSODeviceAuth(context.Background(), SSOStartRequest{Profile: "test-sso"})
	if err != nil {
		t.Fatalf("StartSSODeviceAuth failed: %v", err)
	}

	if resp.VerificationURI != verificationURI {
		t.Errorf("VerificationURI = %q, want %q", resp.VerificationURI, verificationURI)
	}
	if resp.UserCode != userCode {
		t.Errorf("UserCode = %q, want %q", resp.UserCode, userCode)
	}
	if resp.PollID == "" {
		t.Error("PollID should not be empty")
	}
	if resp.ExpiresIn != 600 {
		t.Errorf("ExpiresIn = %d, want 600", resp.ExpiresIn)
	}
	if resp.Interval != 5 {
		t.Errorf("Interval = %d, want 5", resp.Interval)
	}

	// Verify pending auth was stored.
	val, ok := pendingAuths.Load(resp.PollID)
	if !ok {
		t.Fatal("pending auth not stored")
	}
	pending := val.(*pendingAuth)
	if pending.SSOAccountID != "111122223333" {
		t.Errorf("SSOAccountID = %q, want %q", pending.SSOAccountID, "111122223333")
	}

	// Clean up.
	pendingAuths.Delete(resp.PollID)
}

func TestSSOStartDeviceAuth_EmptyProfile(t *testing.T) {
	_, err := StartSSODeviceAuth(context.Background(), SSOStartRequest{})
	if err == nil {
		t.Fatal("expected error for empty profile")
	}
}

func TestSSOPollDeviceAuth_Pending(t *testing.T) {
	// Store a pending auth.
	pollID := "test-pending-poll"
	pendingAuths.Store(pollID, &pendingAuth{
		DeviceCode:   "dc",
		ClientID:     "cid",
		ClientSecret: "cs",
		SSORegion:    "us-east-1",
		SSOAccountID: "111122223333",
		SSORoleName:  "TestRole",
		SSOStartURL:  "https://test.awsapps.com/start",
		ExpiresAt:    time.Now().Add(10 * time.Minute),
	})
	defer pendingAuths.Delete(pollID)

	// Mock SSOOIDC client to return AuthorizationPendingException.
	origFactory := newSSOOIDCClient
	defer func() { newSSOOIDCClient = origFactory }()

	newSSOOIDCClient = func(region string) ssooidcAPI {
		return &mockSSOOIDCClient{
			createTokenFn: func(ctx context.Context, params *ssooidc.CreateTokenInput, optFns ...func(*ssooidc.Options)) (*ssooidc.CreateTokenOutput, error) {
				return nil, &apiError{code: "AuthorizationPendingException", message: "waiting for user"}
			},
		}
	}

	resp, err := PollSSODeviceAuth(context.Background(), SSOPollRequest{PollID: pollID})
	if err != nil {
		t.Fatalf("PollSSODeviceAuth failed: %v", err)
	}
	if resp.Status != "pending" {
		t.Errorf("Status = %q, want %q", resp.Status, "pending")
	}
}

func TestSSOPollDeviceAuth_Complete(t *testing.T) {
	pollID := "test-complete-poll"
	pendingAuths.Store(pollID, &pendingAuth{
		DeviceCode:   "dc",
		ClientID:     "cid",
		ClientSecret: "cs",
		SSORegion:    "us-east-1",
		SSOAccountID: "111122223333",
		SSORoleName:  "TestRole",
		SSOStartURL:  "https://test.awsapps.com/start",
		ExpiresAt:    time.Now().Add(10 * time.Minute),
	})
	// Don't defer delete; PollSSODeviceAuth should clean it up.

	// Override HOME for cache write.
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)

	origOIDC := newSSOOIDCClient
	origSTS := newSTSClient
	origSSO := newSSOClient
	defer func() {
		newSSOOIDCClient = origOIDC
		newSTSClient = origSTS
		newSSOClient = origSSO
	}()

	accessToken := "mock-access-token"
	accessKeyID := "AKIAIOSFODNN7EXAMPLE"
	secretAccessKey := "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
	sessionToken := "mock-session-token"
	arn := "arn:aws:sts::111122223333:assumed-role/TestRole/session"

	newSSOOIDCClient = func(region string) ssooidcAPI {
		return &mockSSOOIDCClient{
			createTokenFn: func(ctx context.Context, params *ssooidc.CreateTokenInput, optFns ...func(*ssooidc.Options)) (*ssooidc.CreateTokenOutput, error) {
				return &ssooidc.CreateTokenOutput{
					AccessToken: &accessToken,
					ExpiresIn:   3600,
				}, nil
			},
		}
	}

	newSSOClient = func(region string) ssoAPI {
		return &mockSSOClient{
			getRoleCredentialsFn: func(ctx context.Context, params *sso.GetRoleCredentialsInput, optFns ...func(*sso.Options)) (*sso.GetRoleCredentialsOutput, error) {
				return &sso.GetRoleCredentialsOutput{
					RoleCredentials: &ssotypes.RoleCredentials{
						AccessKeyId:     &accessKeyID,
						SecretAccessKey: &secretAccessKey,
						SessionToken:    &sessionToken,
					},
				}, nil
			},
		}
	}

	newSTSClient = func(region string, akid, sk, st string) stsAPI {
		return &mockSTSClient{
			getCallerIdentityFn: func(ctx context.Context, params *sts.GetCallerIdentityInput, optFns ...func(*sts.Options)) (*sts.GetCallerIdentityOutput, error) {
				return &sts.GetCallerIdentityOutput{
					Arn: &arn,
				}, nil
			},
		}
	}

	resp, err := PollSSODeviceAuth(context.Background(), SSOPollRequest{PollID: pollID})
	if err != nil {
		t.Fatalf("PollSSODeviceAuth failed: %v", err)
	}
	if resp.Status != "complete" {
		t.Errorf("Status = %q, want %q", resp.Status, "complete")
	}
	if resp.Identity != arn {
		t.Errorf("Identity = %q, want %q", resp.Identity, arn)
	}

	// Verify pending auth was cleaned up.
	if _, ok := pendingAuths.Load(pollID); ok {
		t.Error("pending auth should have been cleaned up")
	}
}

func TestSSOPollDeviceAuth_NotFound(t *testing.T) {
	resp, err := PollSSODeviceAuth(context.Background(), SSOPollRequest{PollID: "nonexistent"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Status != "expired" {
		t.Errorf("Status = %q, want %q", resp.Status, "expired")
	}
}

func TestSSOPollDeviceAuth_Expired(t *testing.T) {
	pollID := "test-expired-poll"
	pendingAuths.Store(pollID, &pendingAuth{
		DeviceCode:   "dc",
		ClientID:     "cid",
		ClientSecret: "cs",
		SSORegion:    "us-east-1",
		ExpiresAt:    time.Now().Add(-1 * time.Minute), // Already expired.
	})
	defer pendingAuths.Delete(pollID)

	resp, err := PollSSODeviceAuth(context.Background(), SSOPollRequest{PollID: pollID})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Status != "expired" {
		t.Errorf("Status = %q, want %q", resp.Status, "expired")
	}

	// Verify it was cleaned up.
	if _, ok := pendingAuths.Load(pollID); ok {
		t.Error("expired auth should have been cleaned up")
	}
}

func TestSSOPollDeviceAuth_EmptyPollID(t *testing.T) {
	_, err := PollSSODeviceAuth(context.Background(), SSOPollRequest{})
	if err == nil {
		t.Fatal("expected error for empty poll_id")
	}
}

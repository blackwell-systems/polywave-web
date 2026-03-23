package service

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sso"
	"github.com/aws/aws-sdk-go-v2/service/ssooidc"
	ssooidctypes "github.com/aws/aws-sdk-go-v2/service/ssooidc/types"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/aws/smithy-go"
)

// SSOStartRequest is the input for starting SSO device authorization.
type SSOStartRequest struct {
	Profile string `json:"profile"`
	Region  string `json:"region,omitempty"`
}

// SSOStartResponse is the output of starting SSO device authorization.
type SSOStartResponse struct {
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	UserCode                string `json:"user_code"`
	DeviceCode              string `json:"device_code"`
	ClientID                string `json:"client_id"`
	ClientSecret            string `json:"client_secret"`
	ExpiresIn               int32  `json:"expires_in"`
	Interval                int32  `json:"interval"`
	PollID                  string `json:"poll_id"`
}

// SSOPollRequest is the input for polling SSO device authorization status.
type SSOPollRequest struct {
	PollID string `json:"poll_id"`
}

// SSOPollResponse is the output of polling SSO device authorization status.
type SSOPollResponse struct {
	Status   string `json:"status"`
	Identity string `json:"identity,omitempty"`
	Error    string `json:"error,omitempty"`
}

// SSOProfile holds parsed AWS SSO profile configuration fields.
type SSOProfile struct {
	SSOStartURL string
	SSOAccountID string
	SSORoleName  string
	SSORegion    string
}

// pendingAuth holds the state for an in-progress SSO device authorization.
type pendingAuth struct {
	DeviceCode   string
	ClientID     string
	ClientSecret string
	SSORegion    string
	SSOAccountID string
	SSORoleName  string
	SSOStartURL  string
	ExpiresAt    time.Time
}

// pendingAuths stores in-progress SSO device authorizations keyed by PollID.
var pendingAuths sync.Map

// ssooidcAPI is the interface for the SSOOIDC client operations we use.
// This allows mocking in tests.
type ssooidcAPI interface {
	RegisterClient(ctx context.Context, params *ssooidc.RegisterClientInput, optFns ...func(*ssooidc.Options)) (*ssooidc.RegisterClientOutput, error)
	StartDeviceAuthorization(ctx context.Context, params *ssooidc.StartDeviceAuthorizationInput, optFns ...func(*ssooidc.Options)) (*ssooidc.StartDeviceAuthorizationOutput, error)
	CreateToken(ctx context.Context, params *ssooidc.CreateTokenInput, optFns ...func(*ssooidc.Options)) (*ssooidc.CreateTokenOutput, error)
}

// stsAPI is the interface for the STS client operations we use.
type stsAPI interface {
	GetCallerIdentity(ctx context.Context, params *sts.GetCallerIdentityInput, optFns ...func(*sts.Options)) (*sts.GetCallerIdentityOutput, error)
}

// ssoAPI is the interface for the SSO client operations we use.
type ssoAPI interface {
	GetRoleCredentials(ctx context.Context, params *sso.GetRoleCredentialsInput, optFns ...func(*sso.Options)) (*sso.GetRoleCredentialsOutput, error)
}

// clientFactory creates real AWS SDK clients. Overridden in tests.
var newSSOOIDCClient func(region string) ssooidcAPI = func(region string) ssooidcAPI {
	return ssooidc.New(ssooidc.Options{Region: region, RetryMaxAttempts: 1})
}

var newSTSClient func(region string, accessKeyID, secretKey, sessionToken string) stsAPI = func(region string, accessKeyID, secretKey, sessionToken string) stsAPI {
	creds := credentials.NewStaticCredentialsProvider(accessKeyID, secretKey, sessionToken)
	return sts.New(sts.Options{
		Region:           region,
		Credentials:      creds,
		RetryMaxAttempts: 1,
	})
}

var newSSOClient func(region string) ssoAPI = func(region string) ssoAPI {
	return sso.New(sso.Options{Region: region, RetryMaxAttempts: 1})
}

// awsConfigDir returns the AWS config directory, honoring AWS_CONFIG_FILE env.
func awsConfigDir() string {
	if v := os.Getenv("AWS_CONFIG_FILE"); v != "" {
		return filepath.Dir(v)
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".aws")
}

// awsConfigFile returns the path to the AWS config file.
func awsConfigFile() string {
	if v := os.Getenv("AWS_CONFIG_FILE"); v != "" {
		return v
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".aws", "config")
}

// ParseSSOProfile reads ~/.aws/config and extracts SSO fields from the given profile.
func ParseSSOProfile(profile string) (*SSOProfile, error) {
	configPath := awsConfigFile()
	f, err := os.Open(configPath)
	if err != nil {
		return nil, fmt.Errorf("cannot open AWS config: %w", err)
	}
	defer f.Close()

	// Determine the section header to look for.
	// The default profile is [default]; named profiles are [profile <name>].
	var targetSection string
	if profile == "default" {
		targetSection = "[default]"
	} else {
		targetSection = "[profile " + profile + "]"
	}

	scanner := bufio.NewScanner(f)
	inSection := false
	fields := make(map[string]string)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines and comments.
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		// Check for section headers.
		if strings.HasPrefix(line, "[") {
			if inSection {
				break // We've moved past our section.
			}
			if strings.EqualFold(line, targetSection) {
				inSection = true
			}
			continue
		}

		if inSection {
			if idx := strings.Index(line, "="); idx > 0 {
				key := strings.TrimSpace(line[:idx])
				val := strings.TrimSpace(line[idx+1:])
				fields[key] = val
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading AWS config: %w", err)
	}

	if !inSection {
		return nil, fmt.Errorf("profile %q not found in %s", profile, configPath)
	}

	// Validate required fields.
	required := []string{"sso_start_url", "sso_account_id", "sso_role_name", "sso_region"}
	for _, key := range required {
		if fields[key] == "" {
			return nil, fmt.Errorf("profile %q missing required field %q", profile, key)
		}
	}

	return &SSOProfile{
		SSOStartURL:  fields["sso_start_url"],
		SSOAccountID: fields["sso_account_id"],
		SSORoleName:  fields["sso_role_name"],
		SSORegion:    fields["sso_region"],
	}, nil
}

// generatePollID creates a cryptographically random hex string for use as a poll ID.
func generatePollID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate poll ID: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// StartSSODeviceAuth initiates the AWS SSO OIDC device authorization flow.
func StartSSODeviceAuth(ctx context.Context, req SSOStartRequest) (*SSOStartResponse, error) {
	if req.Profile == "" {
		return nil, fmt.Errorf("profile is required")
	}

	profile, err := ParseSSOProfile(req.Profile)
	if err != nil {
		return nil, fmt.Errorf("failed to parse SSO profile: %w", err)
	}

	region := profile.SSORegion
	if req.Region != "" {
		region = req.Region
	}

	client := newSSOOIDCClient(region)

	// Step 1: Register a public OIDC client.
	regOut, err := client.RegisterClient(ctx, &ssooidc.RegisterClientInput{
		ClientName: strPtr("saw-web"),
		ClientType: strPtr("public"),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to register OIDC client: %w", err)
	}

	// Step 2: Start device authorization.
	authOut, err := client.StartDeviceAuthorization(ctx, &ssooidc.StartDeviceAuthorizationInput{
		ClientId:     regOut.ClientId,
		ClientSecret: regOut.ClientSecret,
		StartUrl:     &profile.SSOStartURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to start device authorization: %w", err)
	}

	// Step 3: Generate a poll ID and store pending state.
	pollID, err := generatePollID()
	if err != nil {
		return nil, err
	}

	pendingAuths.Store(pollID, &pendingAuth{
		DeviceCode:   derefStr(authOut.DeviceCode),
		ClientID:     derefStr(regOut.ClientId),
		ClientSecret: derefStr(regOut.ClientSecret),
		SSORegion:    region,
		SSOAccountID: profile.SSOAccountID,
		SSORoleName:  profile.SSORoleName,
		SSOStartURL:  profile.SSOStartURL,
		ExpiresAt:    time.Now().Add(time.Duration(authOut.ExpiresIn) * time.Second),
	})

	// Schedule cleanup of expired pending auth.
	time.AfterFunc(time.Duration(authOut.ExpiresIn)*time.Second, func() {
		pendingAuths.Delete(pollID)
	})

	return &SSOStartResponse{
		VerificationURI:         derefStr(authOut.VerificationUri),
		VerificationURIComplete: derefStr(authOut.VerificationUriComplete),
		UserCode:                derefStr(authOut.UserCode),
		DeviceCode:              derefStr(authOut.DeviceCode),
		ClientID:                derefStr(regOut.ClientId),
		ClientSecret:            derefStr(regOut.ClientSecret),
		ExpiresIn:               authOut.ExpiresIn,
		Interval:                authOut.Interval,
		PollID:                  pollID,
	}, nil
}

// PollSSODeviceAuth polls for completion of an SSO device authorization flow.
func PollSSODeviceAuth(ctx context.Context, req SSOPollRequest) (*SSOPollResponse, error) {
	if req.PollID == "" {
		return nil, fmt.Errorf("poll_id is required")
	}

	val, ok := pendingAuths.Load(req.PollID)
	if !ok {
		return &SSOPollResponse{Status: "expired", Error: "no pending authorization found"}, nil
	}

	pending := val.(*pendingAuth)

	if time.Now().After(pending.ExpiresAt) {
		pendingAuths.Delete(req.PollID)
		return &SSOPollResponse{Status: "expired", Error: "authorization has expired"}, nil
	}

	client := newSSOOIDCClient(pending.SSORegion)

	grantType := "urn:ietf:params:oauth:grant-type:device_code"
	tokenOut, err := client.CreateToken(ctx, &ssooidc.CreateTokenInput{
		ClientId:     &pending.ClientID,
		ClientSecret: &pending.ClientSecret,
		GrantType:    &grantType,
		DeviceCode:   &pending.DeviceCode,
	})
	if err != nil {
		// Check for specific error types.
		var apiErr smithy.APIError
		if ok := errorAs(err, &apiErr); ok {
			code := apiErr.ErrorCode()
			switch code {
			case "AuthorizationPendingException":
				return &SSOPollResponse{Status: "pending"}, nil
			case "SlowDownException":
				return &SSOPollResponse{Status: "pending"}, nil
			case "ExpiredTokenException":
				pendingAuths.Delete(req.PollID)
				return &SSOPollResponse{Status: "expired", Error: "device code has expired"}, nil
			}
		}
		// Also check for typed SDK exceptions.
		var authPending *ssooidctypes.AuthorizationPendingException
		if errorAs(err, &authPending) {
			return &SSOPollResponse{Status: "pending"}, nil
		}
		var slowDown *ssooidctypes.SlowDownException
		if errorAs(err, &slowDown) {
			return &SSOPollResponse{Status: "pending"}, nil
		}
		var expired *ssooidctypes.ExpiredTokenException
		if errorAs(err, &expired) {
			pendingAuths.Delete(req.PollID)
			return &SSOPollResponse{Status: "expired", Error: "device code has expired"}, nil
		}
		return &SSOPollResponse{Status: "error", Error: "token creation failed"}, nil
	}

	// Success: cache the SSO token.
	accessToken := derefStr(tokenOut.AccessToken)
	if err := cacheSSOToken(pending.SSOStartURL, pending.SSORegion, accessToken,
		pending.ClientID, pending.ClientSecret, int(tokenOut.ExpiresIn)); err != nil {
		// Log cache error but don't fail the flow.
		_ = err
	}

	// Get role credentials using the SSO access token.
	ssoClient := newSSOClient(pending.SSORegion)
	roleCreds, err := ssoClient.GetRoleCredentials(ctx, &sso.GetRoleCredentialsInput{
		AccessToken: &accessToken,
		AccountId:   &pending.SSOAccountID,
		RoleName:    &pending.SSORoleName,
	})
	if err != nil {
		return &SSOPollResponse{Status: "error", Error: "failed to get role credentials"}, nil
	}

	// Validate with STS GetCallerIdentity.
	rc := roleCreds.RoleCredentials
	stsClient := newSTSClient(pending.SSORegion,
		derefStr(rc.AccessKeyId), derefStr(rc.SecretAccessKey), derefStr(rc.SessionToken))
	identity, err := stsClient.GetCallerIdentity(ctx, &sts.GetCallerIdentityInput{})
	if err != nil {
		return &SSOPollResponse{Status: "error", Error: "failed to verify identity"}, nil
	}

	// Clean up pending state.
	pendingAuths.Delete(req.PollID)

	arn := ""
	if identity.Arn != nil {
		arn = *identity.Arn
	}

	return &SSOPollResponse{
		Status:   "complete",
		Identity: arn,
	}, nil
}

// ssoCacheToken is the JSON structure for cached SSO tokens,
// compatible with the `aws sso login` cache format.
type ssoCacheToken struct {
	StartURL               string `json:"startUrl"`
	Region                 string `json:"region"`
	AccessToken            string `json:"accessToken"`
	ExpiresAt              string `json:"expiresAt"`
	ClientID               string `json:"clientId"`
	ClientSecret           string `json:"clientSecret"`
	RegistrationExpiresAt  string `json:"registrationExpiresAt"`
}

// cacheSSOToken writes an SSO token to the AWS SSO cache directory in a format
// compatible with `aws sso login`.
func cacheSSOToken(startURL, region, accessToken, clientID, clientSecret string, expiresInSec int) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot determine home directory: %w", err)
	}

	cacheDir := filepath.Join(home, ".aws", "sso", "cache")
	if err := os.MkdirAll(cacheDir, 0700); err != nil {
		return fmt.Errorf("cannot create SSO cache directory: %w", err)
	}

	// File name: SHA1 hash of sso_start_url (matches aws cli convention).
	h := sha1.New()
	h.Write([]byte(startURL))
	fileName := hex.EncodeToString(h.Sum(nil)) + ".json"

	expiresAt := time.Now().Add(time.Duration(expiresInSec) * time.Second)
	// Registration expiry is typically 90 days.
	registrationExpiresAt := time.Now().Add(90 * 24 * time.Hour)

	token := ssoCacheToken{
		StartURL:              startURL,
		Region:                region,
		AccessToken:           accessToken,
		ExpiresAt:             expiresAt.UTC().Format("2006-01-02T15:04:05UTC"),
		ClientID:              clientID,
		ClientSecret:          clientSecret,
		RegistrationExpiresAt: registrationExpiresAt.UTC().Format("2006-01-02T15:04:05UTC"),
	}

	data, err := json.MarshalIndent(token, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal SSO cache token: %w", err)
	}

	cachePath := filepath.Join(cacheDir, fileName)
	if err := os.WriteFile(cachePath, data, 0600); err != nil {
		return fmt.Errorf("failed to write SSO cache token: %w", err)
	}

	return nil
}

// errorAs is a helper that wraps errors.As for use in this package.
// It exists so tests can verify error-handling paths.
func errorAs(err error, target interface{}) bool {
	type asIface interface {
		As(interface{}) bool
	}
	// Use smithy-go's standard error unwrapping.
	if e, ok := err.(asIface); ok {
		return e.As(target)
	}
	// Fall back to standard errors.As behavior.
	switch t := target.(type) {
	case *smithy.APIError:
		if ae, ok := err.(smithy.APIError); ok {
			*t = ae
			return true
		}
	}
	return false
}

// strPtr returns a pointer to the given string.
func strPtr(s string) *string {
	return &s
}

// derefStr safely dereferences a string pointer, returning "" for nil.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

# Agent D Brief - Wave 2

**IMPL Doc:** /Users/dayna.blackwell/code/scout-and-wave/docs/IMPL/IMPL-bedrock-sso-device-auth.yaml

## Files Owned

- `pkg/api/server.go`
- `web/src/components/SettingsScreen.tsx`


## Task

## Agent D - Integration (Route Registration + UI Wiring)

**What to implement:**
Wire SSO handler routes into server.go and integrate SSOLoginButton into
the Bedrock section of SettingsScreen.tsx.

**Files:** `pkg/api/server.go`, `web/src/components/SettingsScreen.tsx`

**Implementation details:**

1. **server.go route registration:**
   - In the `New()` function, add `s.RegisterSSORoutes()` near the existing
     provider validation route (around line 176):
     ```go
     s.mux.HandleFunc("POST /api/config/providers/{provider}/validate", s.handleValidateProvider)
     s.RegisterSSORoutes() // AWS SSO device auth flow
     ```

2. **SettingsScreen.tsx integration:**
   - Import SSOLoginButton from './SSOLoginButton'
   - In the Bedrock ProviderCard section (around line 362-369), add SSOLoginButton
     BELOW the existing ProviderCard, inside the same container
   - Pass props:
     ```tsx
     <SSOLoginButton
       profile={providers.bedrock.profile || ''}
       region={providers.bedrock.region || ''}
       onComplete={(identity) => { /* show success toast or trigger validation */ }}
       onError={(error) => { /* display error */ }}
     />
     ```
   - Add a visual separator (border-t) between ProviderCard and SSO button
   - Add helper text: "Use SSO Login when your AWS profile is configured for
     SSO in ~/.aws/config"

**Verification gate:**
```
cd /Users/dayna.blackwell/code/scout-and-wave-web && go build ./... && cd web && npx tsc --noEmit
```

**Constraints:**
- Only modify files listed in your file ownership
- Do not change existing ProviderCard behavior or Bedrock field definitions
- Keep SSO button visually secondary to existing profile/credentials flow



## Interface Contracts

### SSODeviceAuthStart

Initiates AWS SSO OIDC device authorization flow by reading SSO profile config, registering a client, and starting device authorization.

```
// In pkg/service/sso_service.go
type SSOStartRequest struct {
    Profile string `json:"profile"`
    Region  string `json:"region,omitempty"`
}

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

func StartSSODeviceAuth(ctx context.Context, req SSOStartRequest) (*SSOStartResponse, error)

```

### SSODeviceAuthPoll

Polls AWS SSO OIDC CreateToken until authentication completes or times out. Caches the resulting SSO token.

```
// In pkg/service/sso_service.go
type SSOPollRequest struct {
    PollID string `json:"poll_id"`
}

type SSOPollResponse struct {
    Status   string `json:"status"`
    Identity string `json:"identity,omitempty"`
    Error    string `json:"error,omitempty"`
}

func PollSSODeviceAuth(ctx context.Context, req SSOPollRequest) (*SSOPollResponse, error)

```

### HandleSSOStart

HTTP handler for POST /api/config/providers/bedrock/sso/start

```
func (s *Server) handleSSOStart(w http.ResponseWriter, r *http.Request)

```

### HandleSSOPoll

HTTP handler for POST /api/config/providers/bedrock/sso/poll

```
func (s *Server) handleSSOPoll(w http.ResponseWriter, r *http.Request)

```

### SSOLoginButton

React component rendering SSO Login button and device auth flow UI

```
interface SSOLoginButtonProps {
  profile: string
  region: string
  onComplete: (identity: string) => void
  onError: (error: string) => void
}
export default function SSOLoginButton(props: SSOLoginButtonProps): JSX.Element

```



## Quality Gates

Level: standard

- **build**: `cd /Users/dayna.blackwell/code/scout-and-wave-web && go build ./...` (required: true)
- **lint**: `cd /Users/dayna.blackwell/code/scout-and-wave-web && go vet ./...` (required: true)
- **test**: `cd /Users/dayna.blackwell/code/scout-and-wave-web && go test ./pkg/service/ ./pkg/api/` (required: true)
- **build**: `cd /Users/dayna.blackwell/code/scout-and-wave-web/web && npx tsc --noEmit` (required: true)


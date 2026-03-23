import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { Button } from './ui/button'

interface SSOLoginButtonProps {
  profile: string
  region: string
  onComplete: (identity: string) => void
  onError: (error: string) => void
}

interface SSOStartResponse {
  verification_uri: string
  verification_uri_complete: string
  user_code: string
  device_code: string
  client_id: string
  client_secret: string
  expires_in: number
  interval: number
  poll_id: string
}

interface SSOPollResponse {
  status: string
  identity?: string
  error?: string
}

type AuthState = 'idle' | 'starting' | 'awaiting' | 'complete' | 'error' | 'expired'

export default function SSOLoginButton({
  profile,
  region,
  onComplete,
  onError,
}: SSOLoginButtonProps): JSX.Element {
  const [state, setState] = useState<AuthState>('idle')
  const [startResponse, setStartResponse] = useState<SSOStartResponse | null>(null)
  const [identity, setIdentity] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  async function handleStart() {
    cleanup()
    setState('starting')
    setErrorMessage('')

    try {
      const resp = await fetch('/api/config/providers/bedrock/sso/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, region: region || undefined }),
      })

      if (!resp.ok) {
        const body = await resp.text()
        throw new Error(body || `HTTP ${resp.status}`)
      }

      const data: SSOStartResponse = await resp.json()
      setStartResponse(data)
      setRemainingSeconds(data.expires_in)
      setState('awaiting')

      startPolling(data.poll_id, (data.interval || 5) * 1000)
      startCountdown(data.expires_in)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start SSO login'
      setErrorMessage(msg)
      setState('error')
      onError(msg)
    }
  }

  function startPolling(pollId: string, intervalMs: number) {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const resp = await fetch('/api/config/providers/bedrock/sso/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poll_id: pollId }),
        })

        if (!resp.ok) {
          const body = await resp.text()
          throw new Error(body || `HTTP ${resp.status}`)
        }

        const data: SSOPollResponse = await resp.json()

        if (data.status === 'complete') {
          cleanup()
          setIdentity(data.identity ?? '')
          setState('complete')
          onComplete(data.identity ?? '')
        } else if (data.status === 'expired') {
          cleanup()
          setState('expired')
          onError('Session expired')
        } else if (data.status === 'error') {
          cleanup()
          const msg = data.error ?? 'Authentication failed'
          setErrorMessage(msg)
          setState('error')
          onError(msg)
        }
        // status === 'pending' -> keep polling
      } catch (err) {
        cleanup()
        const msg = err instanceof Error ? err.message : 'Polling failed'
        setErrorMessage(msg)
        setState('error')
        onError(msg)
      }
    }, intervalMs)
  }

  function startCountdown(seconds: number) {
    let remaining = seconds
    countdownRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
        }
        setRemainingSeconds(0)
      } else {
        setRemainingSeconds(remaining)
      }
    }, 1000)
  }

  function handleRetry() {
    cleanup()
    setState('idle')
    setStartResponse(null)
    setErrorMessage('')
    setIdentity('')
    setRemainingSeconds(0)
  }

  const isDisabled = !profile.trim() || state === 'starting' || state === 'awaiting'

  if (state === 'idle') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleStart}
        disabled={!profile.trim()}
        className="text-xs h-6 px-2"
      >
        SSO Login
      </Button>
    )
  }

  if (state === 'starting') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="text-xs h-6 px-2"
      >
        <Loader2 size={12} className="animate-spin mr-1" />
        Starting...
      </Button>
    )
  }

  if (state === 'awaiting' && startResponse) {
    const minutes = Math.floor(remainingSeconds / 60)
    const secs = remainingSeconds % 60
    const timeDisplay = `${minutes}:${secs.toString().padStart(2, '0')}`

    return (
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin shrink-0" />
          <span>Waiting for authentication... ({timeDisplay})</span>
        </div>

        <div className="rounded-md border border-border bg-muted/50 p-2 flex flex-col gap-1.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Verification URL
            </span>
            <a
              href={startResponse.verification_uri_complete || startResponse.verification_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              {startResponse.verification_uri}
              <ExternalLink size={10} className="shrink-0" />
            </a>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              User Code
            </span>
            <span className="text-sm font-mono font-bold text-foreground select-all tracking-widest">
              {startResponse.user_code}
            </span>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Open the URL above and enter the code to authenticate
          </p>
        </div>
      </div>
    )
  }

  if (state === 'complete') {
    return (
      <div className="flex items-start gap-1.5 text-xs mt-1 text-green-600 dark:text-green-400">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        <span>
          Authenticated{identity ? ` as ${identity}` : ''}
        </span>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="text-xs h-6 px-2 w-fit"
        >
          Retry
        </Button>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span>Session expired</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="text-xs h-6 px-2 w-fit"
        >
          Retry
        </Button>
      </div>
    )
  }

  // Fallback (should not reach)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleStart}
      disabled={isDisabled}
      className="text-xs h-6 px-2"
    >
      SSO Login
    </Button>
  )
}

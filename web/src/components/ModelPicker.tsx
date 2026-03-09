import { useState, useEffect } from 'react'

interface ModelPickerProps {
  value: string
  onChange: (value: string) => void
  label: string
  id: string
}

const PROVIDERS = [
  { value: 'cli', label: 'CLI (Bedrock or Max Plan)' },
  { value: 'bedrock', label: 'Bedrock API (direct)' },
  { value: 'anthropic', label: 'Anthropic API (Max Plan)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'lmstudio', label: 'LM Studio (local)' },
]

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  cli: ['claude-sonnet-4-5', 'claude-opus-4-6', 'claude-haiku-4-5'],
  bedrock: ['claude-sonnet-4-5', 'claude-opus-4-6', 'claude-haiku-4-5'],
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'],
  ollama: ['qwen2.5-coder:32b', 'qwen2.5-coder:14b', 'deepseek-coder-v2', 'llama3.1:70b', 'granite3.1-dense:8b'],
  lmstudio: ['local-model'],
}

export default function ModelPicker({ value, onChange, label, id }: ModelPickerProps): JSX.Element {
  // Parse the value into provider and model
  const [provider, modelName] = value.includes(':')
    ? value.split(':', 2)
    : ['anthropic', value] // default to anthropic if no prefix

  const [selectedProvider, setSelectedProvider] = useState(provider)
  const [selectedModel, setSelectedModel] = useState(modelName)

  // Update internal state when external value changes
  useEffect(() => {
    const [p, m] = value.includes(':') ? value.split(':', 2) : ['anthropic', value]
    setSelectedProvider(p)
    setSelectedModel(m)
  }, [value])

  function handleProviderChange(newProvider: string) {
    setSelectedProvider(newProvider)
    // Keep the same model name, but update the full value
    const fullValue = newProvider === 'anthropic' && !selectedModel.includes(':')
      ? selectedModel // anthropic is the default, no prefix needed
      : `${newProvider}:${selectedModel}`
    onChange(fullValue)
  }

  function handleModelChange(newModel: string) {
    setSelectedModel(newModel)
    // Update the full value with current provider
    const fullValue = selectedProvider === 'anthropic' && !newModel.includes(':')
      ? newModel
      : `${selectedProvider}:${newModel}`
    onChange(fullValue)
  }

  const suggestions = MODEL_SUGGESTIONS[selectedProvider] || []

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2">
        <select
          value={selectedProvider}
          onChange={e => handleProviderChange(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer w-48"
        >
          {PROVIDERS.map(p => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="flex-1">
          <input
            id={id}
            list={`${id}-suggestions`}
            value={selectedModel}
            onChange={e => handleModelChange(e.target.value)}
            className="w-full text-sm px-3 py-1.5 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Model name"
          />
          <datalist id={`${id}-suggestions`}>
            {suggestions.map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  )
}

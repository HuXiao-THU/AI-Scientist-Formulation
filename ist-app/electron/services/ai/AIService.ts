import type { AIConfig } from '@shared/types'

export interface AIService {
  generateTitle(description: string): Promise<string>
  summarize(context: { pathFromRoot: string[]; subtreeNodes: string[] }): Promise<string>
}

export function createAIService(config: AIConfig): AIService {
  switch (config.provider) {
    case 'openai':
      return createOpenAIAdapter(config)
    case 'anthropic':
      return createAnthropicAdapter(config)
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}

function createOpenAIAdapter(config: AIConfig): AIService {
  return {
    async generateTitle(description: string): Promise<string> {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a research assistant. Generate a concise title (under 50 characters) for the following research idea description. Return only the title, no quotes or extra formatting.'
            },
            { role: 'user', content: description }
          ],
          max_tokens: 100,
          temperature: 0.7
        })
      })
      const data = (await response.json()) as {
        choices: { message: { content: string } }[]
      }
      return data.choices[0]?.message?.content?.trim() ?? ''
    },

    async summarize(context): Promise<string> {
      const prompt = buildSummarizePrompt(context)
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a research assistant. Summarize the research idea path and its sub-ideas/experiments concisely. Write in the same language as the input.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000,
          temperature: 0.5
        })
      })
      const data = (await response.json()) as {
        choices: { message: { content: string } }[]
      }
      return data.choices[0]?.message?.content?.trim() ?? ''
    }
  }
}

function createAnthropicAdapter(config: AIConfig): AIService {
  return {
    async generateTitle(description: string): Promise<string> {
      const response = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: `Generate a concise title (under 50 characters) for the following research idea description. Return only the title, no quotes or extra formatting.\n\n${description}`
            }
          ]
        })
      })
      const data = (await response.json()) as {
        content: { type: string; text: string }[]
      }
      return data.content?.[0]?.text?.trim() ?? ''
    },

    async summarize(context): Promise<string> {
      const prompt = buildSummarizePrompt(context)
      const response = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `Summarize the following research idea path and its sub-ideas/experiments concisely. Write in the same language as the input.\n\n${prompt}`
            }
          ]
        })
      })
      const data = (await response.json()) as {
        content: { type: string; text: string }[]
      }
      return data.content?.[0]?.text?.trim() ?? ''
    }
  }
}

function buildSummarizePrompt(context: {
  pathFromRoot: string[]
  subtreeNodes: string[]
}): string {
  const parts: string[] = []
  parts.push('## Idea Path (from root to current node):')
  context.pathFromRoot.forEach((text, i) => {
    parts.push(`${i + 1}. ${text}`)
  })
  parts.push('')
  parts.push('## All sub-nodes under this idea:')
  context.subtreeNodes.forEach((text) => {
    parts.push(`- ${text}`)
  })
  return parts.join('\n')
}

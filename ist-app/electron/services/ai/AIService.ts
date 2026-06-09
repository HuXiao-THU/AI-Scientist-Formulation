import type { AIConfig } from '@shared/types'
import { request } from '../../utils/httpClient'
import { safeErrorMessage, truncateText } from '../../utils/truncate'

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

function readHttpError(status: number, body: string): string {
  return truncateText(body || `HTTP ${status}`, 300)
}

function createOpenAIAdapter(config: AIConfig): AIService {
  return {
    async generateTitle(description: string): Promise<string> {
      try {
        const response = await request(`${config.baseUrl}/chat/completions`, {
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
        if (response.status < 200 || response.status >= 300) {
          throw new Error(
            `OpenAI request failed (${response.status}): ${readHttpError(response.status, response.body)}`
          )
        }
        const data = JSON.parse(response.body) as {
          choices: { message: { content: string } }[]
        }
        return data.choices[0]?.message?.content?.trim() ?? ''
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    },

    async summarize(context): Promise<string> {
      try {
        const prompt = buildSummarizePrompt(context)
        const response = await request(`${config.baseUrl}/chat/completions`, {
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
        if (response.status < 200 || response.status >= 300) {
          throw new Error(
            `OpenAI request failed (${response.status}): ${readHttpError(response.status, response.body)}`
          )
        }
        const data = JSON.parse(response.body) as {
          choices: { message: { content: string } }[]
        }
        return data.choices[0]?.message?.content?.trim() ?? ''
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    }
  }
}

function createAnthropicAdapter(config: AIConfig): AIService {
  return {
    async generateTitle(description: string): Promise<string> {
      try {
        const response = await request(`${config.baseUrl}/messages`, {
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
        if (response.status < 200 || response.status >= 300) {
          throw new Error(
            `Anthropic request failed (${response.status}): ${readHttpError(response.status, response.body)}`
          )
        }
        const data = JSON.parse(response.body) as {
          content: { type: string; text: string }[]
        }
        return data.content?.[0]?.text?.trim() ?? ''
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
    },

    async summarize(context): Promise<string> {
      try {
        const prompt = buildSummarizePrompt(context)
        const response = await request(`${config.baseUrl}/messages`, {
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
        if (response.status < 200 || response.status >= 300) {
          throw new Error(
            `Anthropic request failed (${response.status}): ${readHttpError(response.status, response.body)}`
          )
        }
        const data = JSON.parse(response.body) as {
          content: { type: string; text: string }[]
        }
        return data.content?.[0]?.text?.trim() ?? ''
      } catch (err) {
        throw new Error(safeErrorMessage(err))
      }
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

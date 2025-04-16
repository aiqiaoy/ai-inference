import * as core from '@actions/core'
import ModelClient, { isUnexpected } from '@azure-rest/ai-inference'
import { AzureKeyCredential } from '@azure/core-auth'
import * as fs from 'fs'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const promptFile: string = core.getInput('prompt-file')
    let prompt: string = core.getInput('prompt')

    if (promptFile !== undefined && promptFile !== '') {
      if (!fs.existsSync(promptFile)) {
        throw new Error(`Prompt file not found: ${promptFile}`)
      }
      prompt = fs.readFileSync(promptFile, 'utf-8')
    }

    if (prompt === undefined || prompt === '') {
      throw new Error('prompt is not set')
    }

    const systemPrompt: string = core.getInput('system-prompt')
    const modelName: string = core.getInput('model')
    const maxTokens: number = parseInt(core.getInput('max-tokens'), 10)

    const token = core.getInput('token') || process.env['GITHUB_TOKEN']
    if (token === undefined) {
      throw new Error('GITHUB_TOKEN is not set')
    }

    const endpoint = core.getInput('endpoint')

    const client = ModelClient(endpoint, new AzureKeyCredential(token), {
      userAgentOptions: { userAgentPrefix: 'github-actions-ai-inference' }
    })

    const response = await client.path('/chat/completions').post({
      body: {
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        model: modelName
      }
    })

    if (isUnexpected(response)) {
      if (response.body.error) {
        throw response.body.error
      }
      throw new Error(
        'An error occurred while fetching the response (' +
          response.status +
          '): ' +
          response.body
      )
    }

    const modelResponse: string | null =
      response.body.choices[0].message.content

    // Set outputs for other workflow steps to use
    core.setOutput('response', modelResponse || '')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  }
}

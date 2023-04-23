import { getInput, saveState } from '@actions/core'
import stateHelper from 'utils/state-helper'

const getState = (name: string): string | undefined => process.env[`STATE_${name}`]
export const [isPost, setIsPost] = stateHelper<boolean>('is-post', {
  toValue: (val: string) => !!val,
  fromValue: (val: boolean) => `${val}`,
  defaultValue: false,
  useFromInput: false,
  saveState: saveState,
  getState: getState,
})
// Setting this does not update `isPost`, it merely makes sure that we can detect if we're in the post action.
setIsPost(true)

// This is a bit of a hack: we want to be able to detect if we've run before or not, so we force the value to be
// `true`
export const [hasRunBefore, setHasRunBefore] = stateHelper<boolean>('has-run-before', {
  toValue: (val: string) => !!val,
  fromValue: () => `true`,
  defaultValue: false,
})
// This does not update hasRunBefore
setHasRunBefore(true)

export const [slackToken, setSlackToken] = stateHelper('slack-token', { isSensitive: true })
export const [githubToken, setGithubToken] = stateHelper('github-token', { required: true, isSensitive: true })
export const [matrix, setMatrix] = stateHelper<Record<string, string>>('matrix', {
  toValue: (val: string) => JSON.parse(val),
  fromValue: (val: Record<string, string>) => JSON.stringify(val),
  defaultValue: {},
})

export const status = getInput('job-status') as 'success' | 'failure' | 'cancelled' | 'skipped'
export const channelName = getInput('channel-name')
export const [channelId, setChannelId] = stateHelper('channel-id', { output: true })

export const [messageId, setMessageId] = stateHelper('message-id', { output: true })

export const [customMessage, setCustomMessage] = stateHelper('message-custom')
export const [summary, setSummary] = stateHelper('message-summary')
export const [text, setText] = stateHelper('message-text')

export const currentState = (): Record<string, unknown> => {
  // Instead of just dumping the entire state, we sanitize it a bit, adding some more descriptive names.
  return {
    'is-post-processing': isPost,
    'slack-token-provided': Boolean(slackToken),
    'github-token-provided': Boolean(githubToken),
    matrix,
    status,
    'has-run-before': hasRunBefore,
    'channel-name': channelName,
    'channel-id': channelId,
    'message-id': messageId,
    'message-custom': customMessage,
    'message-summary': summary,
    'message-text': text,
  }
}

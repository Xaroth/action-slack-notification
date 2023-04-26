import { getInput, saveState } from '@actions/core'
import stateHelper, { StateHelperOptions, StateHelper } from 'utils/state-helper'

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

const jsonStateHelper = <T>(name: string, options: StateHelperOptions<T>): StateHelper<T> =>
  stateHelper<T>(name, {
    ...options,
    toValue: <T>(val: string): T => {
      if (typeof val !== 'string') return val
      return JSON.parse(val)
    },
    fromValue: <T>(val: T): string => JSON.stringify(val),
  })

export const [slackToken, setSlackToken] = stateHelper('slack-token', { isSensitive: true })
export const [githubToken, setGithubToken] = stateHelper('github-token', { required: true, isSensitive: true })
export const [matrix, setMatrix] = jsonStateHelper<Record<string, string>>('matrix', { defaultValue: {} })

export const [jobNames, setJobNames] = jsonStateHelper<Record<string, string>>('job-names', {
  defaultValue: {},
  useFromInput: false,
})
export const channelName = getInput('channel-name')
export const [channelId, setChannelId] = stateHelper('channel-id', { output: true })

export const [messageId, setMessageId] = stateHelper('message-id', { output: true })

export const [messageTitle, setMessageTitle] = stateHelper('message-title')
export const [messageLink, setMessageLink] = stateHelper('message-link')
export const [showFooter, setShowFooter] = jsonStateHelper<boolean>('show-footer', { defaultValue: true })
export const [messageType, setMessageType] = stateHelper<'rich' | 'plain'>('message-type', { defaultValue: 'rich' })
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
    'channel-name': channelName,
    'channel-id': channelId,
    'message-id': messageId,
    'message-title': messageTitle,
    'message-link': messageLink,
    'message-custom': customMessage,
    'message-summary': summary,
    'message-text': text,
    'show-footer': showFooter,
  }
}

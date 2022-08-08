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

export const [slackToken, setSlackToken] = stateHelper('slack-token')
export const [githubToken, setGithubToken] = stateHelper('github-token', { required: true })
export const [matrix, setMatrix] = stateHelper<Record<string, string>>('matrix', {
  toValue: (val: string) => JSON.parse(val),
  fromValue: (val: Record<string, string>) => JSON.stringify(val),
  defaultValue: {},
})

export const channelName = getInput('channel-name')
export const [channelId, setChannelId] = stateHelper('channel-id', { output: true })

export const [messageId, setMessageId] = stateHelper('message-id', { output: true })

export const [customMessage, setCustomMessage] = stateHelper('message-custom')
export const [summary, setSummary] = stateHelper('message-summary')
export const [text, setText] = stateHelper('message-text')

import { setFailed } from '@actions/core'
import { context } from '@actions/github'
import { ChatPostMessageArguments, ChatUpdateArguments, WebClient } from '@slack/web-api'
import { inspect } from 'util'

import * as github from 'utils/github'
import * as log from 'utils/log'
import * as state from 'utils/state'

import { buildAttachmentsMessage, lookupChannel } from 'utils/slack'

type ChatType = 'update' | 'postMessage'
type ChatArgs = ChatUpdateArguments & ChatPostMessageArguments

const run = async (): Promise<void> => {
  const currentJob = await github.getCurrentJobForWorkflowRun()

  // Store our GitHub token for later use.
  state.setGithubToken(state.githubToken)

  // If 'token' is set, it means we likely want to send the initial message (or update it)
  if (state.slackToken) {
    const slack = new WebClient(state.slackToken)

    // Ensure that either channel-id or channel-name is set
    if (!state.channelId && !state.channelName) {
      return setFailed(`Either 'channel-id' or 'channel-name' must be sedt.`)
    }

    // Get our channel ID. If specified as a name, see if we can look it up.
    const channel = state.channelId || (await lookupChannel(slack, state.channelName))
    // If channel is undefined, it means we used a channel name and could not find it.
    if (!channel) {
      return setFailed(`Channel ${state.channelName} could not be found`)
    } else {
      // Ensure the channel ID is saved to state
      state.setChannelId(channel)
    }

    let apiMethod: ChatType = 'postMessage'
    let extraArgs: Partial<ChatArgs> = {}

    if (state.messageId) {
      apiMethod = 'update'
      extraArgs = {
        ts: state.messageId,
      }
    }

    const status = state.hasRunBefore ? 'in_progress' : 'started'
    const attachments = buildAttachmentsMessage({
      status,
      jobId: currentJob?.id,
    })

    const args: Partial<ChatArgs> = {
      channel,
      attachments,
      ...extraArgs,
    }

    try {
      const response = await slack.chat[apiMethod](args as ChatArgs)
      if (response.ts) {
        // We received our message ID, save it to state so we can update it later.
        state.setMessageId(response.ts)
      }
    } catch (error) {
      setFailed(error as Error)
    }
  }
}

/**
 * Set a promise to resolve after a certain time, making it a crude sleepms implementation
 * @param ms the time to sleep
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const cleanup = async (): Promise<void> => {
  // We wait for a few seconds to ensure that all our API calls will reflect the most current data.
  // Occasionally we are so fast with polling the API that it has not yet caught up on the current state
  // giving us outdated information (sometimes even leading to false success runs)
  await sleep(5000)
  const currentJob = await github.getCurrentJobForWorkflowRun()

  if (state.messageId && state.githubToken && state.slackToken && state.channelId) {
    const slack = new WebClient(state.slackToken)
    const attachments = buildAttachmentsMessage({
      status: state.status,
      jobId: currentJob?.id,
    })

    const args: ChatUpdateArguments = {
      channel: state.channelId,
      attachments,
      ts: state.messageId,
    }

    try {
      await slack.chat.update(args)
    } catch (error) {
      setFailed(error as Error)
    }
  } else {
    // TODO: Notify user we never sent a message.
  }
}

async function main(): Promise<void> {
  if (log.isDebug) {
    log.startGroup('State information')
    log.debug(inspect(state.currentState(), false, null))
    log.endGroup()
    log.startGroup('Job information')
    log.debug(inspect(context, false, null))
    log.endGroup()
  }

  if (state.isPost) {
    await log.group('Cleaning up...', cleanup)
  } else {
    await log.group('Processing', run)
  }
}
main()

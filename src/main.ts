import { setFailed } from '@actions/core'
import { ChatPostMessageArguments, ChatUpdateArguments, WebClient } from '@slack/web-api'

import * as state from 'utils/state'
import * as github from 'utils/github'

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

    const status = (await github.getJobJustStarted(currentJob)) ? 'started' : 'in_progress'
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

const cleanup = async (): Promise<void> => {
  const currentJob = await github.getCurrentJobForWorkflowRun()

  if (state.messageId && state.githubToken && state.slackToken && state.channelId) {
    const status = await github.getCurrentJobConclusion(currentJob)

    const slack = new WebClient(state.slackToken)
    const attachments = buildAttachmentsMessage({
      status,
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

if (!state.isPost) {
  console.log('Posting message')
  run()
} else {
  console.log('Post-action cleanup')
  cleanup()
}

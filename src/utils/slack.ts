import { context } from '@actions/github'
import { ConversationsListResponse, MessageAttachment, WebClient } from '@slack/web-api'
import * as state from './state'

export const ensureChannelName = (channelName: string): string => channelName.replace(/[#@]/g, '')

export const lookupChannel = async (slack: WebClient, channelName: string): Promise<string | undefined> => {
  const name = ensureChannelName(channelName)

  for await (const page of slack.paginate('conversations.list', {
    types: 'public_channel, private_channel',
  }) as AsyncIterable<ConversationsListResponse>) {
    const match = page?.channels?.find((x) => x.name === name)
    if (match) {
      return match.id as string
    }
  }
  return undefined
}

const capitalize = (text: string): string => text.slice(0, 1).toUpperCase() + text.slice(1, text.length)
const snakeToPascal = (word: string): string => {
  return word.split('_').map(capitalize).join(' ')
}

const { payload, ref, workflow, eventName, serverUrl, runId, sha, actor, job } = context
const { owner, repo } = context.repo

const branchName = ref.replace('refs/heads/', '')
const eventTitle = snakeToPascal(eventName)

const repository = `${owner}/${repo}`
const repoUrl = `${serverUrl}/${repository}`

const repoField = {
  title: 'Repo',
  value: `<${repoUrl} | ${repository}>`,
  short: true,
}

const workflowField = {
  title: 'Workflow',
  value: `<${repoUrl}/actions/runs/${runId} | ${workflow}>`,
  short: true,
}

const buildTitle = (): Partial<MessageAttachment> => {
  switch (eventName) {
    case 'pull_request':
      return {
        title: `${eventTitle} [${payload.action}]: ${payload.pull_request?.title}`,
        title_link: payload.pull_request?.html_url,
      }
    case 'release':
      return {
        title: `${eventTitle}: ${payload.release.name} [${payload.release.tag_name}]`,
        title_link: payload.release.html_url,
      }
    case 'push':
      return {
        title: `${eventTitle}: ${payload.head_commit.message} [${branchName}]`,
        title_link: payload.compare,
      }
    default:
      return {
        title: `${eventTitle}: ${branchName}`,
        title_link: `${repoUrl}/commit/${sha}`,
      }
  }
}

const statusColors = {
  started: '#c0c0c0',
  skipped: '#c0c0c0',
  unknown: '#800080',
  cancelled: 'warning',
  in_progress: '#0000cc',
  completed: 'warning',
  success: 'good',
  failure: 'danger',
}

type StatusType = keyof typeof statusColors

interface MessageAttachmentField {
  title: string
  value: string
  short: boolean
}

const buildStatusField = (status: StatusType): MessageAttachmentField => {
  return {
    title: 'Status',
    value: capitalize(status),
    short: true,
  }
}
const buildJobField = (jobId: number): MessageAttachmentField => {
  return {
    title: 'Job',
    value: `<${repoUrl}/runs/${jobId}?check_suite_focus=true | ${job}>`,
    short: true,
  }
}

const buildMatrixField = (matrix: Record<string, string>): MessageAttachmentField => {
  return {
    title: 'Matrix',
    value: Object.entries(matrix)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', '),
    short: true,
  }
}

const buildCustomMessageField = (message: string): MessageAttachmentField => {
  return {
    title: 'Extra',
    value: message,
    short: true,
  }
}

interface MessageProps {
  status: StatusType
  jobId?: number
}

export const buildAttachmentsMessage = ({ status, jobId }: MessageProps): MessageAttachment[] => {
  const color = statusColors[status]
  const fields = [repoField, buildStatusField(status), workflowField]
  if (jobId) fields.push(buildJobField(jobId))
  if (state.matrix && Object.entries(state.matrix).length) fields.push(buildMatrixField(state.matrix))
  if (state.customMessage) fields.push(buildCustomMessageField(state.customMessage))

  return [
    {
      color,
      fields: state.messageType === 'rich' ? fields : undefined,
      author_name: actor,
      author_link: `${serverUrl}/${actor}`,
      footer_icon: 'https://github.githubassets.com/favicon.ico',
      footer: `<${repoUrl} | ${repository}>`,
      ts: `${Math.floor(Date.now() / 1000)}`,
      mrkdwn_in: ['pretext', 'text'],
      pretext: state.text || undefined,
      text: state.summary || undefined,
      ...buildTitle(),
    },
  ]
}

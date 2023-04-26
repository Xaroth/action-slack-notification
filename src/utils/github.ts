import { context, getOctokit as getOctokitBase } from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'
import type { OctokitOptions } from '@octokit/core/dist-types/types'
import type { components } from '@octokit/openapi-types/types'
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types'
import { inspect } from 'util'
import { load } from 'js-yaml'
import { readFileSync } from 'fs'

import * as state from './state'
import * as log from './log'

const {
  apiUrl: baseUrl,
  job,
  payload: { workflow },
} = context

interface Workflow {
  [key: string]: unknown
  name?: string
  jobs: Record<
    string,
    {
      name?: string
    }
  >
}

if (Object.entries(state.jobNames).length === 0) {
  log.debug(`No job names found in state, attempting to parse workflow file ${workflow}`)
  try {
    const contents = readFileSync(workflow, 'utf8')
    const data = load(contents) as Workflow

    for (const [jobKey, jobItem] of Object.entries(data.jobs)) {
      state.jobNames[jobKey] = jobItem.name ?? jobKey
    }
    state.setJobNames(state.jobNames)
  } catch (e) {
    log.error(`Unable to parse workflow file ${workflow}: ${e}`)
    log.warning('Be sure to run actions/checkout@v3 _before_ this action.')
  }
}
const jobName = state.jobNames[job] ?? job

if (jobName.indexOf('${{') !== -1) {
  log.warning('Job name contains a matrix variable. This is not supported.')
}

const attempt_number = parseInt(process.env.GITHUB_RUN_ATTEMPT || '1', 10)

export const getOctokit = (options?: Partial<OctokitOptions>): InstanceType<typeof GitHub> =>
  getOctokitBase(state.githubToken, { baseUrl, ...(options || {}) })

export const listCurrentJobsForWorkflowRun = async (): Promise<
  RestEndpointMethodTypes['actions']['listJobsForWorkflowRun']['response']
> => {
  const octokit = getOctokit()
  const {
    runId: run_id,
    repo: { owner, repo },
  } = context
  return await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id,
    attempt_number,
  })
}

const jobMatcher = /(?<name>\w+) \((?<matrix>[^()]+)\)/

const getMatrixData = (): string[] | undefined => {
  const values = Object.values(state.matrix)
  if (values.length === 0) return
  return values.flat()
}

/**
 * GitHub does not provide the matrix information or a _full_ job name if you are
 * running inside a matrix. We work around this by passing the matrix data as json
 * as an input, and doing some matching magic in this function.
 *
 * If there is no matrix data, we simply match on the name of the job.
 * If there is matrix data, we extract the name and the matrix data from the
 * full name, and see if that matches.
 *
 * @param jobItem The item to match
 * @returns True if the job is the current one based on matrix data
 */
export const matchJobByName = (jobItem: components['schemas']['job']): boolean => {
  if (jobItem.name === jobName) return true

  const matrixData = getMatrixData()
  log.debug(`Matrix fields: ${inspect(matrixData, false, null)}`)
  if (matrixData) {
    const { name = '', matrix = '' } = jobItem.name.match(jobMatcher)?.groups || {}

    log.debug(`Job name: '${name.trim()}'`)
    log.debug(`Expected job name: ${jobName}`)

    if (name.trim().localeCompare(jobName, undefined, { sensitivity: 'base' }) !== 0) return false

    const matrixParts = matrix.split(', ') as string[]
    log.debug(`Job matrix fields: ${inspect(matrixParts, false, null)}`)

    return matrixParts.every((x) => matrixData.indexOf(x) !== -1)
  }

  return false
}

type CurrentJob = components['schemas']['job']

export const getCurrentJobForWorkflowRun = async (): Promise<CurrentJob | undefined> => {
  const {
    data: { jobs },
    status,
  } = await listCurrentJobsForWorkflowRun()

  if (status != 200) {
    log.warning(`Failed to get current job for workflow run: ${status}`)
    if (status === 403) {
      log.warning(`Make sure the token has the 'actions:read' scope, and that a valid token is provided.`)
    }
    return undefined
  }

  const found = jobs.find(matchJobByName)
  if (!found) {
    log.startGroup('Current job not found')
    log.info(inspect(jobs, false, null))
    log.info('Matrix data:')
    log.info(inspect(getMatrixData(), false, null))
    log.endGroup()
  }
  return found
}

type Conclusion = 'success' | 'failure' | 'unknown' | 'skipped' | 'cancelled'

export const getCurrentJobConclusion = async (currentJob?: CurrentJob): Promise<Conclusion> => {
  const job = currentJob ?? (await getCurrentJobForWorkflowRun())

  log.startGroup('Current job')
  log.info(inspect(job?.steps || [], false, null))
  log.endGroup()

  // Since we are checking the current running job, we can not trust
  // the `conclusion` field as it will remain `null` until the job has
  // completed.
  // Instead, we need to iterate over the current steps, and check if
  // there are any failed steps.

  // To make it easier, we check only the completed steps, more
  // specifically, those that have not been skipped.
  const steps = (job?.steps || []).filter((x) => x.status === 'completed' && x.conclusion !== 'skipped')

  if (steps.find((x) => x.conclusion === 'failure')) return 'failure'
  if (steps.find((x) => x.conclusion === 'cancelled')) return 'cancelled'

  // There should always be a 'Set up job' task, so we should always
  // have at least one success conclusion in our list of completed
  // steps.
  if (steps.filter((x) => x.conclusion === 'success').length > 0) return 'success'

  // If we don't, we try to use the job conclusion, or fall back to 'unknown'
  return (job?.conclusion as Conclusion | undefined) ?? 'unknown'
}

export const getJobJustStarted = async (currentJob?: CurrentJob): Promise<boolean> => {
  // Here we check how many tasks have already been completed
  // to check if we have just started or not.
  // Ideally we would want this action to be called
  // as early as possible to notify the start of the workflow.
  const job = currentJob ?? (await getCurrentJobForWorkflowRun())

  // To make it easier, we check only the completed steps, more
  // specifically, those that have not been skipped.
  const steps = (job?.steps || []).filter((x) => x.status === 'completed' && x.conclusion !== 'skipped')

  // There should always be a 'Set up job' task at the start of
  // the tasks list. We compare against 2 because in some cases,
  // like our own repo, we must checkout before we can run the
  // action.
  return steps.length <= 2
}

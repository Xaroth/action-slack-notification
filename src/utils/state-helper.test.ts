import stateHelper from 'utils/state-helper'
import * as coreCommand from '@actions/core/lib/command'

describe('state tests', () => {
  const name = 'testValue'
  const value = 'test'

  it('stateHelper picks up on process.env variables', () => {
    const [unset] = stateHelper(name)

    // This env variable was never set, so we should expect it to be undefined
    expect(unset).toBeUndefined()
    process.env[`STATE_${name}`] = value

    // While we may have set it now, stateHelper has already done its thing
    // so this variable should still be undefined
    expect(unset).toBeUndefined()

    const [withValue] = stateHelper(name)
    // Now that we called it after setting the env var, it should pick up on the value.
    expect(withValue).toEqual(value)
  })

  it('calls issueCommand when setting states', () => {
    const issueCommand = jest.spyOn(coreCommand, 'issueCommand').mockImplementation(jest.fn())

    const [, setValue] = stateHelper(name)
    setValue(value)
    expect(issueCommand).toHaveBeenCalled()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env[`STATE_${name}`]
  })
})

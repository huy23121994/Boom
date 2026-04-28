import { describe, it, expect, beforeEach, vi } from 'vitest'

const storageMocks = {
  saveTranscript: vi.fn(),
  savePrefs: vi.fn(),
  clearTranscript: vi.fn(),
  clearAll: vi.fn(),
  loadPrefs: vi.fn(),
  loadTranscript: vi.fn(),
  clearPrefs: vi.fn(),
}

vi.mock('@/lib/storage', () => storageMocks)

const themeMocks = {
  applyTheme: vi.fn(),
  resolveTheme: vi.fn(() => 'light' as const),
  subscribeSystemTheme: vi.fn(() => () => {}),
}

vi.mock('@/lib/theme', () => themeMocks)

let store: typeof import('@/state/conversation').useConversationStore
type StoreModule = typeof import('@/state/conversation')

beforeEach(async () => {
  vi.resetAllMocks()
  vi.resetModules()
  const mod: StoreModule = await import('@/state/conversation')
  store = mod.useConversationStore
})

describe('initial state', () => {
  it('starts with empty turns, thinking bubble (booting), default prefs', () => {
    const s = store.getState()
    expect(s.turns).toEqual([])
    expect(s.bubbleState).toBe('thinking')
    expect(s.activeError).toBeUndefined()
    expect(s.prefs).toEqual({ persistEnabled: false, theme: 'system', version: 1 })
  })
})

describe('boot', () => {
  it('hydrates turns and prefs and calls applyTheme', () => {
    const turn = {
      id: 't1',
      speaker: 'learner' as const,
      text: 'hi',
      timestamp: 1,
    }
    store.getState().boot({
      persistedTurns: [turn],
      prefs: { persistEnabled: true, theme: 'dark', version: 1 },
    })
    expect(store.getState().turns).toEqual([turn])
    expect(store.getState().prefs.theme).toBe('dark')
    expect(themeMocks.applyTheme).toHaveBeenCalledWith('dark')
  })
})

describe('setBubble — state machine validation', () => {
  it('allows listening → thinking', () => {
    store.setState({ bubbleState: 'listening' })
    store.getState().setBubble('thinking')
    expect(store.getState().bubbleState).toBe('thinking')
  })

  it('allows thinking → speaking', () => {
    store.setState({ bubbleState: 'thinking' })
    store.getState().setBubble('speaking')
    expect(store.getState().bubbleState).toBe('speaking')
  })

  it('allows speaking → listening', () => {
    store.setState({ bubbleState: 'speaking' })
    store.getState().setBubble('listening')
    expect(store.getState().bubbleState).toBe('listening')
  })

  it('allows thinking → listening (error recovery)', () => {
    store.setState({ bubbleState: 'thinking' })
    store.getState().setBubble('listening')
    expect(store.getState().bubbleState).toBe('listening')
  })

  it('REJECTS listening → speaking direct', () => {
    store.setState({ bubbleState: 'listening' })
    store.getState().setBubble('speaking')
    expect(store.getState().bubbleState).toBe('listening')
  })

  it('REJECTS speaking → thinking', () => {
    store.setState({ bubbleState: 'speaking' })
    store.getState().setBubble('thinking')
    expect(store.getState().bubbleState).toBe('speaking')
  })
})

describe('appendTurn', () => {
  it('appends to turns and calls saveTranscript', () => {
    const turn = {
      id: 't1',
      speaker: 'learner' as const,
      text: 'hi',
      timestamp: 1,
    }
    store.getState().appendTurn(turn)
    expect(store.getState().turns).toEqual([turn])
    expect(storageMocks.saveTranscript).toHaveBeenCalledWith([turn], expect.objectContaining({
      persistEnabled: false,
    }))
  })
})

describe('clearAll', () => {
  it('empties turns, resets prefs to default, calls storage.clearAll then savePrefs and applyTheme', () => {
    store.setState({
      turns: [
        { id: 'x', speaker: 'learner', text: 'a', timestamp: 1 },
      ],
      prefs: { persistEnabled: true, theme: 'dark', version: 1 },
      activeError: 'transport',
    })
    store.getState().clearAll()
    expect(store.getState().turns).toEqual([])
    expect(store.getState().prefs).toEqual({ persistEnabled: false, theme: 'system', version: 1 })
    expect(store.getState().activeError).toBeUndefined()
    expect(storageMocks.clearAll).toHaveBeenCalled()
    expect(storageMocks.savePrefs).toHaveBeenCalledWith({
      persistEnabled: false,
      theme: 'system',
      version: 1,
    })
    expect(themeMocks.applyTheme).toHaveBeenCalledWith('system')
  })
})

describe('togglePersist', () => {
  it('on true → false: calls clearTranscript then savePrefs in that order', () => {
    store.setState({
      prefs: { persistEnabled: true, theme: 'system', version: 1 },
      turns: [{ id: 'a', speaker: 'learner', text: 'x', timestamp: 1 }],
    })
    const callOrder: string[] = []
    storageMocks.clearTranscript.mockImplementation(() => { callOrder.push('clearTranscript') })
    storageMocks.savePrefs.mockImplementation(() => { callOrder.push('savePrefs') })

    store.getState().togglePersist(false)
    expect(store.getState().prefs.persistEnabled).toBe(false)
    expect(callOrder).toEqual(['clearTranscript', 'savePrefs'])
  })

  it('on false → true: calls savePrefs and saveTranscript', () => {
    store.setState({
      prefs: { persistEnabled: false, theme: 'system', version: 1 },
      turns: [{ id: 'a', speaker: 'learner', text: 'x', timestamp: 1 }],
    })
    store.getState().togglePersist(true)
    expect(store.getState().prefs.persistEnabled).toBe(true)
    expect(storageMocks.saveTranscript).toHaveBeenCalled()
    expect(storageMocks.savePrefs).toHaveBeenCalled()
    expect(storageMocks.clearTranscript).not.toHaveBeenCalled()
  })
})

describe('setTheme', () => {
  it("setTheme('dark') calls applyTheme then savePrefs", () => {
    const callOrder: string[] = []
    themeMocks.applyTheme.mockImplementation(() => { callOrder.push('applyTheme') })
    storageMocks.savePrefs.mockImplementation(() => { callOrder.push('savePrefs') })
    store.getState().setTheme('dark')
    expect(store.getState().prefs.theme).toBe('dark')
    expect(callOrder).toEqual(['applyTheme', 'savePrefs'])
  })
})

describe('setError', () => {
  it('sets and clears the active error', () => {
    store.getState().setError('mic-denied')
    expect(store.getState().activeError).toBe('mic-denied')
    store.getState().setError(undefined)
    expect(store.getState().activeError).toBeUndefined()
  })
})

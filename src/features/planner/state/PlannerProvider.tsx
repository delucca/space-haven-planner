import { useReducer, useCallback, type ReactNode, type Dispatch } from 'react'
import { PlannerContext } from './PlannerContext'
import { historyReducer, createInitialHistoryState } from './history'
import type { PlannerAction } from './types'

interface PlannerProviderProps {
  children: ReactNode
}

export function PlannerProvider({ children }: PlannerProviderProps) {
  const [historyState, historyDispatch] = useReducer(
    historyReducer,
    undefined,
    createInitialHistoryState
  )

  // Wrap dispatch to pass actions to the history reducer
  const dispatch: Dispatch<PlannerAction> = useCallback(
    (action: PlannerAction) => {
      historyDispatch(action)
    },
    [historyDispatch]
  )

  return (
    <PlannerContext.Provider value={{ state: historyState.state, dispatch }}>
      {children}
    </PlannerContext.Provider>
  )
}

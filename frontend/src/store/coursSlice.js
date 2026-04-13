import { createSlice } from '@reduxjs/toolkit'

const coursSlice = createSlice({
  name: 'cours',
  initialState: {
    matieres:   [],
    modules:    [],
    uas:        [],
    currentUA:  null,
    exercices:  [],
    loading:    false,
    error:      null,
  },
  reducers: {
    setMatieres(state, action)  { state.matieres  = action.payload },
    setModules(state, action)   { state.modules   = action.payload },
    setUAs(state, action)       { state.uas       = action.payload },
    setCurrentUA(state, action) { state.currentUA = action.payload },
    setExercices(state, action) { state.exercices = action.payload },
    setLoading(state, action)   { state.loading   = action.payload },
    setError(state, action)     { state.error     = action.payload },
  }
})

export const {
  setMatieres, setModules, setUAs,
  setCurrentUA, setExercices, setLoading, setError
} = coursSlice.actions
export default coursSlice.reducer
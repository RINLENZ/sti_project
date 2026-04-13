import { createSlice } from '@reduxjs/toolkit'

const saved = localStorage.getItem('sti_user')

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:  saved ? JSON.parse(saved) : null,
    token: localStorage.getItem('sti_token') || null,
    loading: false,
  },
  reducers: {
    loginSuccess(state, action) {
      state.user  = action.payload.user
      state.token = action.payload.token
      localStorage.setItem('sti_token', action.payload.token)
      localStorage.setItem('sti_user',  JSON.stringify(action.payload.user))
    },
    logout(state) {
      state.user  = null
      state.token = null
      localStorage.removeItem('sti_token')
      localStorage.removeItem('sti_user')
    },
  }
})

export const { loginSuccess, logout } = authSlice.actions
export default authSlice.reducer
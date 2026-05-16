import { createSlice } from '@reduxjs/toolkit'

let savedUser = null
try {
  const saved = localStorage.getItem('sti_user')
  if (saved) savedUser = JSON.parse(saved)
} catch {
  localStorage.removeItem('sti_user')
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:         savedUser,
    token:        localStorage.getItem('sti_token') || null,
    refreshToken: localStorage.getItem('sti_refresh_token') || null,
    loading: false,
  },
  reducers: {
    loginSuccess(state, action) {
      state.user         = action.payload.user
      state.token        = action.payload.token
      state.refreshToken = action.payload.refreshToken || null
      localStorage.setItem('sti_token', action.payload.token)
      localStorage.setItem('sti_user',  JSON.stringify(action.payload.user))
      if (action.payload.refreshToken) {
        localStorage.setItem('sti_refresh_token', action.payload.refreshToken)
      }
    },
    tokenRefreshed(state, action) {
      state.token        = action.payload.token
      state.refreshToken = action.payload.refreshToken
      localStorage.setItem('sti_token',         action.payload.token)
      localStorage.setItem('sti_refresh_token', action.payload.refreshToken)
    },
    logout(state) {
      state.user         = null
      state.token        = null
      state.refreshToken = null
      localStorage.removeItem('sti_token')
      localStorage.removeItem('sti_refresh_token')
      localStorage.removeItem('sti_user')
    },
  }
})

export const { loginSuccess, tokenRefreshed, logout } = authSlice.actions
export default authSlice.reducer
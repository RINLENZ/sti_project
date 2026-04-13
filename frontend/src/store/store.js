import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import coursReducer from './coursSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cours: coursReducer,
  }
})
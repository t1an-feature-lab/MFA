import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BaseStyles} from '@primer/react'
import {ThemeProvider} from '@primer/react/next'
import '@primer/primitives/dist/css/functional/themes/light.css'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider colorMode="day" dayScheme="light">
      <BaseStyles>
        <App />
      </BaseStyles>
    </ThemeProvider>
  </StrictMode>,
)

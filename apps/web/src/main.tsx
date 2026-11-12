import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router'
import {BaseStyles} from '@primer/react'
import {ThemeProvider} from '@primer/react/next'
import '@primer/primitives/dist/css/primitives.css'
import '@primer/primitives/dist/css/functional/themes/light.css'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider colorMode="day" dayScheme="light">
      <BaseStyles>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </BaseStyles>
    </ThemeProvider>
  </StrictMode>,
)

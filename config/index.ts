import devConfig from './index.dev'
import prodConfig from './index.prod'

export const getConfig = () => {
  const config = process.env.NODE_ENV == 'production' ? prodConfig : devConfig
  return config
}

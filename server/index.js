import app from './app.js'
import redis from './utils/redis.js'

app.listen(3000, () => {
  console.log('Server is running on port 3000')
  console.log('ENV:', process.env.NODE_ENV)
})

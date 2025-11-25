import dotenv from 'dotenv'
process.env.NODE_ENV === 'production' && dotenv.config({ path: `.env.production` })
process.env.NODE_ENV === 'development' && dotenv.config({ path: `.env.local` }) && dotenv.config({ path: `.env.development` })
dotenv.config({ path: `.env` })
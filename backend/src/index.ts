import express from 'express'
import cors from 'cors'
import path from 'path'
import routes from './routes'
import seedData from './seed'

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

app.use('/api', routes)

seedData()

app.listen(PORT, () => {
  console.log(`影像社区服务已启动: http://localhost:${PORT}`)
})

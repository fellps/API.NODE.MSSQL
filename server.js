import express from 'express'
import swaggerExpress from 'swagger-express-mw'
import bodyParser from 'body-parser'
import cors from 'cors'
import 'dotenv/config'

const swaggerConfig = {
  appRoot: __dirname, // required config
  // swaggerSecurityHandlers: {
  //   Bearer: auth.verifyToken
  // }
}

const app = express()

//Enable CORS for all HTTP methods
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use((req, res, next) => {
  console.log(`Request coming => ${req.originalUrl}`)
  next() //this will invoke next middleware function
})

swaggerExpress.create(swaggerConfig, (err, middleware) => {
  if (err) {
    throw err
  }

  // install middleware
  middleware.register(app)

  // listen on port 3001
  app.listen(process.env.API_PORT, () => {
    console.log(`Server is listening on port ${process.env.API_PORT}!`)
  })
})
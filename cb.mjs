import express from 'express'

const app = express()
app.listen(4000, () => console.log(`App available on http://localhost:4000`))
app.use(express.json())

app.post("/feedback", (req, res) => {
    console.log(req.body)
})

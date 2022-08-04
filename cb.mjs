import express from 'express'
import axios from 'axios'

const app = express()
app.listen(4000, () => console.log(`App available on http://localhost:4000`))
app.use(express.json())

app.post("/reupload", (req, res) => {
    console.log(req.body)
    req.body.status === "uploaded" ? console.log(req.body.url) : res.send("reupload")
})

import express from "express"

const app = express()

app.listen(4000, () => console.log(`App available on http://localhost:4000`))
app.use(express.json()) // using middleware to get json req body

app.post("/ipfs-upload-feedback", (req) => {
    console.log(req.body)
})

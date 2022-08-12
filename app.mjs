import express from 'express'
import { v4 } from 'uuid'
import 'dotenv/config'
import DbGen from './pg.mjs'
import formidable from 'formidable'

const app = express()
const DbClient = DbGen()

DbClient.connect()
DbClient.on("connect", () => console.log("connection with DB established through port 5432"))

app.set("view engine", "ejs")
app.listen(3000, () => console.log(`App available on http://localhost:3000`))

const insert = (filename, guid, status, CbUrl, url, retries) => {
    DbClient.query(`INSERT INTO jobs (filename,guid,file_url,status,callback,retries)
                VALUES($1,$2,$3,$4,$5,$6) RETURNING*`, [filename, guid, url, status, CbUrl, retries], (err, result) => { err ? console.log(err) : console.log(result.rows) })
}

app.post("/upload", (req, res) => {
    const auth = req.headers.authorization
    const key = auth.split(" ")[1]
    const callback = req.headers.callback
    if (key === null) {
        res.sendStatus(401)
    } else {
        if (key !== process.env.ApiKey) {
            res.sendStatus(403)
        } else {
            let formData = new formidable.IncomingForm()
            formData.parse(req, async (err, fields) => {
                insert(fields.filename, v4(), "pending", callback, fields.url, 3)
            })
            res.sendStatus(200)
        }
    }
})